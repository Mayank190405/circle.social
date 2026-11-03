import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { DatabaseService } from '../database/database.service.js';
import { CacheService } from '../cache/cache.service.js';
import { environment } from '../core/environment.js';
import { hashToken } from './tokens.js';
interface Pending {
  challenge: string;
  handle?: string;
  userId?: string;
  sessionId?: string;
}
@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}
  async audit(kind: string, userId?: string): Promise<void> {
    await this.db.auditEvent.create({ data: { kind, userId } });
  }
  async session(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException();
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE'
    )
      throw new UnauthorizedException();
    return session;
  }
  async options(handle: string, sessionToken?: string) {
    const existingSession = sessionToken
      ? await this.session(sessionToken)
      : null;
    if (
      existingSession &&
      Date.now() - existingSession.createdAt.getTime() > 300000
    )
      throw new UnauthorizedException();
    const userId = existingSession?.userId ?? randomUUID();
    if (
      !existingSession &&
      (await this.db.user.findUnique({ where: { handle } }))
    )
      throw new ConflictException();
    const credentials = existingSession
      ? await this.db.passkey.findMany({ where: { userId } })
      : [];
    const options = await generateRegistrationOptions({
      rpName: 'Circle.social',
      rpID: environment.WEBAUTHN_RP_ID,
      userName: existingSession?.user.handle ?? handle,
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      supportedAlgorithmIDs: [-7, -257],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      excludeCredentials: credentials.map((c) => ({ id: c.id })),
    });
    const id = randomBytes(32).toString('base64url');
    await this.cache.client.set(
      `challenge:registration:${id}`,
      JSON.stringify({
        challenge: options.challenge,
        userId,
        handle,
        sessionId: existingSession?.id,
      }),
      'EX',
      300,
    );
    return { id, options };
  }
  async registration(
    id: string | undefined,
    response: RegistrationResponseJSON,
    sessionToken?: string,
  ) {
    const raw = id
      ? await this.cache.take(`challenge:registration:${id}`)
      : null;
    if (!raw) throw new UnauthorizedException();
    const pending = JSON.parse(raw) as Pending;
    if (!pending.userId || !pending.handle) throw new UnauthorizedException();
    if (
      pending.sessionId &&
      (await this.session(sessionToken)).id !== pending.sessionId
    )
      throw new UnauthorizedException();
    let verified;
    try {
      verified = await verifyRegistrationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: environment.WEB_ORIGIN,
        expectedRPID: environment.WEBAUTHN_RP_ID,
        requireUserVerification: true,
        supportedAlgorithmIDs: [-7, -257],
      });
    } catch {
      await this.audit('passkey.registration.rejected');
      throw new UnauthorizedException();
    }
    if (!verified.verified) throw new UnauthorizedException();
    const info = verified.registrationInfo;
    try {
      await this.db.$transaction(async (tx) => {
        if (!pending.sessionId)
          await tx.user.create({
            data: { id: pending.userId!, handle: pending.handle! },
          });
        await tx.passkey.create({
          data: {
            id: info.credential.id,
            userId: pending.userId!,
            publicKey: Buffer.from(info.credential.publicKey),
            counter: BigInt(info.credential.counter),
            transports: info.credential.transports ?? [],
            deviceType: info.credentialDeviceType,
            backedUp: info.credentialBackedUp,
          },
        });
        await tx.auditEvent.create({
          data: { userId: pending.userId!, kind: 'passkey.registered' },
        });
      });
    } catch {
      throw new ConflictException();
    }
    return this.newSession(pending.userId);
  }
  async loginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: environment.WEBAUTHN_RP_ID,
      userVerification: 'required',
    });
    const id = randomBytes(32).toString('base64url');
    await this.cache.client.set(
      `challenge:authentication:${id}`,
      JSON.stringify({ challenge: options.challenge }),
      'EX',
      300,
    );
    return { id, options };
  }
  async login(id: string | undefined, response: AuthenticationResponseJSON) {
    const raw = id
      ? await this.cache.take(`challenge:authentication:${id}`)
      : null;
    if (!raw) throw new UnauthorizedException();
    const pending = JSON.parse(raw) as Pending;
    const credential = await this.db.passkey.findUnique({
      where: { id: response.id },
      include: { user: true },
    });
    if (!credential || credential.user.status !== 'ACTIVE')
      throw new UnauthorizedException();
    if (
      response.response.userHandle !==
      Buffer.from(credential.userId).toString('base64url')
    )
      throw new UnauthorizedException();
    let result;
    try {
      result = await verifyAuthenticationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: environment.WEB_ORIGIN,
        expectedRPID: environment.WEBAUTHN_RP_ID,
        requireUserVerification: true,
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(credential.publicKey),
          counter: Number(credential.counter),
        },
      });
    } catch {
      await this.audit('passkey.authentication.rejected', credential.userId);
      throw new UnauthorizedException();
    }
    if (!result.verified) throw new UnauthorizedException();
    // Compare-and-swap protects against parallel assertions overwriting counters.
    const updated = await this.db.passkey.updateMany({
      where: { id: credential.id, counter: credential.counter },
      data: {
        counter: BigInt(result.authenticationInfo.newCounter),
        backedUp: result.authenticationInfo.credentialBackedUp,
      },
    });
    if (updated.count !== 1) throw new UnauthorizedException();
    return this.newSession(credential.userId);
  }
  private async newSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + environment.SESSION_TTL_SECONDS * 1000,
    );
    await this.db.$transaction([
      this.db.session.create({
        data: { userId, tokenHash: hashToken(token), expiresAt },
      }),
      this.db.auditEvent.create({ data: { userId, kind: 'session.created' } }),
    ]);
    return { token, expiresAt };
  }
  async revoke(token: string | undefined, sessionId?: string): Promise<void> {
    const session = await this.session(token);
    await this.db.$transaction([
      this.db.session.updateMany({
        where: {
          userId: session.userId,
          ...(sessionId ? { id: sessionId } : {}),
        },
        data: { revokedAt: new Date() },
      }),
      this.db.auditEvent.create({
        data: { userId: session.userId, kind: 'session.revoked' },
      }),
    ]);
  }
}
