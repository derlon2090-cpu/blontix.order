# Three-step sign-in

Password → administrator email confirmation → authenticator TOTP. No email code is sent. The fixed email remains the existing administrator address; it is an identification step, not an independent authentication factor.

Set AUTH_TOTP_SECRET on Render only to the generated uppercase Base32 secret. Add the same key manually to your authenticator as a time-based entry: account blontix, SHA-1, six digits, 30-second period. Never put this value in source control, browser code, NEXT_PUBLIC variables or Vercel environment settings. The six-digit code changes; the secret is the stable enrollment key. Enrollment codes supplied in chat are not stored as fixed passwords.

The endpoint fails closed when the secret is absent or invalid. A correct password and email do not issue a session. The preauthentication challenge expires after five minutes and binds all steps to the device cookie. The final transaction locks the device and challenge, requires email confirmation, checks TOTP with one 30-second step of clock tolerance, prevents repeated use of an accepted time step across devices, consumes the challenge and creates the verified session atomically.

The additive 0003_totp_verification migration introduces authentication state only. Existing sessions lack totp_verified_at and require fresh three-step sign-in. Document tables, PDFs, storage, snapshots and encryption are unaffected. Startup applies this migration through the existing migrator. No live migration was performed during development.

Incorrect password, email and TOTP share the persistent device failure count. Intermediate successes do not reset it. The third incorrect attempt sets banned_at with no automatic expiry; existing sessions are rejected for banned devices. Only complete sign-in resets the failure count for a device that is not banned. Expired challenges, configuration/network failures and previously accepted codes do not count as incorrect guesses. The existing temporary IP lock remains an additional limit.

Device identity uses the server-issued secure HttpOnly cookie. This is a persistent browser identifier, not an unchangeable hardware fingerprint. Clearing browser data or using another browser can create a new identity. A web platform cannot honestly promise permanent physical-device exclusion using this mechanism.

## Verification

Run tests/totp-access.mjs with NODE_ENV=test, BLONTIX_ISOLATED_QA=1 and --import ./tests/support/register.mjs. The test checks published RFC 6238 vectors, required step ordering, session issuance only after TOTP, replay rejection, mixed-step three-attempt ban, concurrent single-use and missing-secret failure using in-memory fixtures. It sends no email and touches no live database or R2 resources.

Algorithm reference: https://www.rfc-editor.org/rfc/rfc6238
