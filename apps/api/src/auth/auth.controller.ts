import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Res,
  Inject,
  HttpCode,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { z } from 'zod';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import {
  registrationCredentialSchema,
  authenticationCredentialSchema,
} from './credential-schemas.js';
import type { UserSummary } from '@circle/shared-types';
import { registrationOptionsSchema } from '@circle/validation';
import { AuthService } from './auth.service.js';
import { CacheService } from '../cache/cache.service.js';
import { DatabaseService } from '../database/database.service.js';
import { environment } from '../core/environment.js';
import { validate } from '../core/http.js';
export const sessionCookie =
  environment.NODE_ENV === 'production'
    ? '__Host-circle_session'
    : 'circle_session';
const challengeCookie = (kind: string) =>
  environment.NODE_ENV === 'production'
    ? `__Host-circle_${kind}`
    : `circle_${kind}`;
const cookieOptions = {
  httpOnly: true,
  secure: environment.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};
function cookie(req: Request, name: string): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : undefined;
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CacheService) private readonly cache: CacheService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}
  private async protect(req: Request): Promise<void> {
    if (req.headers.origin !== environment.WEB_ORIGIN)
      throw new ForbiddenException();
    if (
      !(await this.cache.rateLimit(
        `auth:${req.ip}`,
        environment.AUTH_RATE_LIMIT,
        60,
      ))
    )
      throw new HttpException('Too many requests', 429);
  }
  private setSession(
    res: Response,
    result: { token: string; expiresAt: Date },
  ) {
    res.cookie(sessionCookie, result.token, {
      ...cookieOptions,
      expires: result.expiresAt,
    });
    return { authenticated: true };
  }
  @ApiBody({
    schema: z.toJSONSchema(registrationOptionsSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @Post('registration/options')
  async registrationOptions(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.protect(req);
    const { handle } = validate(registrationOptionsSchema, body);
    const result = await this.auth.options(handle, cookie(req, sessionCookie));
    res.cookie(challengeCookie('registration'), result.id, {
      ...cookieOptions,
      maxAge: 300000,
    });
    return result.options;
  }
  @ApiBody({
    schema: z.toJSONSchema(registrationCredentialSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @Post('registration/verify')
  @HttpCode(200)
  async registrationVerify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.protect(req);
    const response = validate(
      registrationCredentialSchema,
      body,
    ) as unknown as RegistrationResponseJSON;
    const result = await this.auth.registration(
      cookie(req, challengeCookie('registration')),
      response,
      cookie(req, sessionCookie),
    );
    res.clearCookie(challengeCookie('registration'), cookieOptions);
    return this.setSession(res, result);
  }
  @Post('authentication/options') async authenticationOptions(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.protect(req);
    const result = await this.auth.loginOptions();
    res.cookie(challengeCookie('authentication'), result.id, {
      ...cookieOptions,
      maxAge: 300000,
    });
    return result.options;
  }
  @ApiBody({
    schema: z.toJSONSchema(authenticationCredentialSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @Post('authentication/verify')
  @HttpCode(200)
  async authenticationVerify(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.protect(req);
    const response = validate(
      authenticationCredentialSchema,
      body,
    ) as unknown as AuthenticationResponseJSON;
    const result = await this.auth.login(
      cookie(req, challengeCookie('authentication')),
      response,
    );
    res.clearCookie(challengeCookie('authentication'), cookieOptions);
    return this.setSession(res, result);
  }
  @Get('me') async me(@Req() req: Request): Promise<UserSummary> {
    const { user } = await this.auth.session(cookie(req, sessionCookie));
    return { id: user.id, handle: user.handle, status: user.status };
  }
  @Get('passkeys') async passkeys(@Req() req: Request) {
    const session = await this.auth.session(cookie(req, sessionCookie));
    return this.db.passkey.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        createdAt: true,
        deviceType: true,
        backedUp: true,
        transports: true,
      },
    });
  }
  @Delete('passkeys/:id') async removePasskey(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.protect(req);
    const session = await this.auth.session(cookie(req, sessionCookie));
    if (Date.now() - session.createdAt.getTime() > 300000)
      throw new ForbiddenException();
    validate(z.string().min(1).max(2048), id);
    await this.db.$transaction(
      async (tx) => {
        if (
          (await tx.passkey.count({ where: { userId: session.userId } })) <= 1
        )
          throw new ForbiddenException();
        await tx.passkey.deleteMany({ where: { id, userId: session.userId } });
        await tx.auditEvent.create({
          data: { userId: session.userId, kind: 'passkey.removed' },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return { removed: true };
  }
  @Get('sessions') async sessions(@Req() req: Request) {
    const session = await this.auth.session(cookie(req, sessionCookie));
    return this.db.session.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, createdAt: true, expiresAt: true },
    });
  }
  @Delete('sessions/:id') async revoke(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.protect(req);
    validate(z.uuid(), id);
    await this.auth.revoke(cookie(req, sessionCookie), id);
    return { revoked: true };
  }
  @Post('logout') @HttpCode(200) async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.protect(req);
    const current = await this.auth.session(cookie(req, sessionCookie));
    await this.auth.revoke(cookie(req, sessionCookie), current.id);
    res.clearCookie(sessionCookie, cookieOptions);
    return { revoked: true };
  }
  @Post('logout-all') @HttpCode(200) async logoutAll(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.protect(req);
    await this.auth.revoke(cookie(req, sessionCookie));
    res.clearCookie(sessionCookie, cookieOptions);
    return { revoked: true };
  }
}
