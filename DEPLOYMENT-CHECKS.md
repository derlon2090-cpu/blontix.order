# Node deployment checks — 2026-09-16

## Authenticator third step

Email delivery was cancelled before publication. Three-step sign-in now requires a time-based authenticator code after password and administrator-email confirmation. The additive 0003 authentication migration preserves document tables and invalidates legacy sessions through the required totp_verified_at field. AUTH_TOTP_SECRET belongs on Render only; no real enrollment secret is committed.

The isolated tests/totp-access.mjs check passed RFC 6238 vectors, required step ordering, no session issuance at email confirmation, accepted TOTP session, rejection of legacy/banned sessions, replay prevention, a mixed-step three-incorrect-attempt ban, concurrent single-use and fail-closed missing configuration. Fixtures were in memory; no live PostgreSQL/R2 operations or email sends occurred. npm run build passed with TypeScript checks and the new /login/2fa and /api/access/2fa routes. The existing broader PostgreSQL workflow was updated for the third step but was not rerun for this change. Live deployment and enrollment remain unverified.

## Final-document integrity layer

This later update adds visible PDF notices, snapshot-bound references, faint reference watermarks, Info/XMP metadata and verification-page integrity details. See ANTI-TAMPER.md for the distinction between snapshot and final-file fingerprints. It does not change database schema/migrations, providers, encryption or audit implementation. Historical masters are not rewritten. Both npm run build and npm run build:vercel completed successfully with TypeScript checks.

The isolated PDF test passed metadata/reference checks and exercised the real verification/file/master handlers with an in-memory database and storage fixture: original bytes matched; a valid modified PDF retaining the same reference failed with the requested Arabic warning; original download retained the registered SHA-256. No live PostgreSQL or R2 resources were used. Poppler rendering was visually reviewed; all eight existing visual checks passed. Decoded metadata excluded the synthetic phone, XMP parsed as XML, the automation footer was extractable and 14 repeated reference watermarks were present. Backend production build and TypeScript passed. These checks do not establish live Render/Vercel availability.

Scope: deployment and request routing only. PostgreSQL migrations/schema, document handlers, QR generation, snapshots, R2 implementation, encryption, audit implementation and PDF design were not changed in this update.

- `npm ci`: passed.
- `npm run build`: passed with native Next.js webpack and TypeScript checks.
- `npm run build:vercel`: passed without backend secret environment variables. Frontend build declares the external `/api/*` proxy; backend build declares no such proxy.
- Changed deployment files: ESLint and Node syntax checks passed.
- `render.yaml`: parsed and checked for one free Node web service, branch `main`, required Build/Start/Health settings, commit auto-deploy and nine private environment placeholders. No database, disk or paid resource is declared.
- Production commands and installed dependency paths contain no Workerd, Wrangler, next-on-pages or OpenNext Cloudflare adapter. AWS S3 SDK is retained. Drizzle's optional Cloudflare worker type peer metadata is types-only and is not a production runtime dependency.
- No backend secret variable names were found in frontend browser bundles.

Local verification used bundled Node 24; Render targets Node 22.x as declared by package.json and render.yaml. These are build/configuration results, not live Render/Neon/R2 or document persistence verification. No database migrations or document/R2 test operations were run for this update.

Apply the Blueprint to the existing service once, preserving real environment values. A YAML commit alone does not replace an existing manual dashboard Start Command. Verify live `/api/health` after deployment. Existing Vercel dashboard secrets must be removed there; source changes cannot remove external environment settings.

## Page-load recovery

Frontend SSR previously waited up to 90 seconds for access status and threw on a timeout or failed upstream response. New visitors without authentication cookies now reach login without contacting Render. Token-bearing requests have an eight-second deadline and show a retry view on an unavailable backend. The email step shares one status request within the same page render. Failed status requests never grant access or clear cookies. Browser device preparation displays its pending state and supports reconnecting without submitting a password.

The isolated transport check passed for absent cookies (zero upstream calls), network failure, HTTP 502, invalid response types, permitted-cookie filtering and request-local status caching. It used a simulated fetch transport and no database/storage operations; it does not verify live backend availability. The updated backend and frontend builds passed; changed-file ESLint passed with one existing full-navigation warning in login-client.tsx.

## Render module resolution

The supplied Render build log fails to resolve `@/components/ui/button` and `@/components/ui/input`. Both files, their label/utils dependencies and tsconfig.json are already tracked in Git with exact lowercase paths. The webpack configuration now explicitly maps `@` to the project root; TypeScript also has an explicit root baseUrl with the existing paths mapping. This prevents webpack application aliases from depending only on implicit tsconfig discovery. A production-mode backend build and frontend build passed after the change. The supplied log alone does not establish which commit or dashboard build settings produced the original failure; deploy the latest main commit with the documented build command and clear the old build cache.

## Missing PostCSS in production installation

The next supplied Render log reports `Cannot find module '@tailwindcss/postcss'`. That package was classified as development-only. The CSS/TypeScript build requirements now belong to dependencies, retaining all package versions and lockfile package inventory. ESLint and Drizzle Kit remain development-only. Only the Drizzle generator config is excluded from the application TypeScript build; no schema, migration or provider implementation was changed.

Verification: `NODE_ENV=production npm ci --omit=dev --no-audit --no-fund` completed successfully, installing 332 packages. Required PostCSS/Tailwind/animation CSS/TypeScript packages were present, while ESLint and Drizzle Kit were absent. `NODE_ENV=production npm run build` passed with that installation. Local npm reported the known Node 24 versus target Node 22 engine warning and Windows cleanup warnings for unused optional WASM folders; the install exited zero. No database or storage operations were performed. This verifies the supplied build failure, not live Render startup or login.

## PDF text and generation latency

Mixed Arabic/Latin product text is now split into Unicode bidi runs, keeping logical Arabic text for fontkit shaping and Latin names/numbers intact. The font adapter explicitly shapes Arabic words RTL and numeric/Latin runs LTR, including Arabic-Indic digits. HTML previews isolate field values with bdi. Renderer metadata is now AP-PDF-ENGINE-1.2 for newly created documents; existing masters are never regenerated or overwritten.

Four independent R2 heads, uploads and read-back verifications execute concurrently within each phase. All uploads settle before any failure is returned, so cleanup cannot race a late successful upload. Conditional writes, generation-job tracking, full SHA-256 verification and atomic PostgreSQL finalization remain required. Static logo/font bytes are cached with failed loads evicted; text measurements and glyph layouts are cached within each PDF only.

Isolated PDF/transport checks passed: Latin product name and 18 preserved, Arabic digits shaped LTR, Arabic words shaped RTL, concurrent storage scheduling, and late-upload completion before failure cleanup. No live database or R2 operations were used. Before/after sample PDFs were rendered with Poppler and visually reviewed. Existing A4/logo/watermark/image/QR/phone/footer/overflow checks passed. Local PDF generation was about 8.6 seconds with simultaneous build activity; this is not a production timing or a claim of instant generation. Production build passed with the corrected renderer.
