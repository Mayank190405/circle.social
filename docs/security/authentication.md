# Authentication and security

Passkeys are primary. Registration requires a resident credential and user verification. Login verifies challenge, exact origin, relying-party hash, signature, user-presence/verification flags, credential owner user handle and signature counter. The implementation delegates cryptographic validation to SimpleWebAuthn rather than implementing its own verifier. Test-only software authenticators generate real P-256 registrations/assertions, including invalid origin, missing UV, and counter rollback cases.

Challenges use 256-bit identifiers, separate registration/login namespaces, five-minute Redis expiration, HttpOnly SameSite=Strict browser cookies, and atomic GETDEL consumption before verification. A failed attempt consumes the challenge. Expired or replayed responses are rejected. Existing-user enrollment is tied to the authenticated session and requires authentication within five minutes. Establishing a new identity does not prove uniqueness or humanity.

Sessions use independent 256-bit opaque tokens; only SHA-256 hashes are stored. Default absolute expiration is seven days. Production cookies use `__Host-` naming, Secure, HttpOnly, SameSite=Strict and Path=/ with no Domain. Mutating authentication endpoints require the exact configured Origin in addition to cookies. CORS allows only that origin. Credentials and signed assertions are not logged. Session queries re-check user status; suspended/deactivated users cannot use old sessions. Counter updates use a compare-and-swap to prevent stale concurrent updates.

Authentication is throttled by IP in Redis, and general application requests have an additional shared 120/minute bound. Health/metrics are exempt and must remain internal at the ingress. The API binds loopback by default and does not trust proxy-provided IP headers. Before deployment behind a proxy, configure an exact trusted proxy boundary and rate-limit there; do not enable unrestricted trust proxy. Rate limits fail closed if Redis is unavailable.

## Ownership and recovery

Users should register at least two passkeys on independent devices. Additional keys can be enrolled through a recently authenticated session; revoke lost device sessions and remove the affected key after adding a replacement. The final key cannot be deleted through the API. Existing credentials, private keys, full session tokens and assertion bodies must never be exported to support.

When every passkey and valid session is lost, automated recovery is **not available**. Pseudonymous identity has no verified email/phone ownership authority in this schema. Liveness, selfies, knowledge of a handle, community membership, or a support claim alone do not establish ownership. Future recovery requires a documented independent possession factor (for example pre-enrolled offline recovery secrets), delayed high-risk changes, notifications and auditability. No admin bypass or liveness-only takeover endpoint is implemented.

## Secrets and data access

Local `.env` files are mode 600 and Git-ignored. Examples contain placeholders. `pnpm env:setup` avoids overwrites and prints no credentials. Never publish expanded `docker compose config` output; use `config --quiet`. Production should use a secrets manager and a runtime database role without migration/admin privileges. The development `circle_admin` role is not a production permission model.

Public APIs expose only community summaries. Session/key operations are filtered by authenticated user ownership. DB credentials, session tokens, private keys, raw WebAuthn payloads and connection URLs stay out of structured logs. Audit events record security event kinds and user UUIDs; define retention and deletion policy before real users. Metrics use bounded method/status labels. Sentry and OTLP export are disabled until explicitly configured and send sanitized, identifier-free data.

Security tests cover replay, cryptographic invalidity, wrong origin, user-handle mismatch, UV enforcement, expiration, revocation, suspended accounts, last-key protection and HTTP throttling. Before production, obtain an independent authentication/security review, exercise real browsers and physical passkeys, and decide recovery policy and mobile associated domains.
