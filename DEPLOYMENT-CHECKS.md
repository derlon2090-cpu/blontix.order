# Node deployment checks — 2026-09-16

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
