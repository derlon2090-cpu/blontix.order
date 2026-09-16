# Deployment on Vercel

The Vercel build uses native Next.js through `npm run build:vercel`; `vercel.json` selects `.next`. It applies pending Turso migrations before building and stops deployment if they fail. Vercel environments must have both Turso variables configured. The separate vinext build remains available for Cloudflare.

1. Create a Turso database and a database-scoped authentication token. Connect a **private** Vercel Blob store to the Vercel project.
2. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `DOCUMENTS_ACCESS_PASSWORD_HASH` and `SESSION_SECRET` in Vercel for the intended environments. The access hash must be Argon2id; keep `$` characters intact when pasting the value into the dashboard. Never use the plaintext access code as an environment variable or commit secrets.
3. With the same database credentials configured locally, run `npm run db:migrate:vercel`. The migration ledger makes repeated execution safe. Redeploy the GitHub `main` branch.
4. Check two-stage login, document creation, private PDF download, public verification and the three-failure browser ban on the deployed instance.

The code creates the existing SQLite schema on Turso. It does **not** automatically copy existing D1 rows or R2 objects. If existing production data is present, export it and copy all referenced objects with their original paths and bytes before switching production traffic; verify stored SHA-256 hashes afterward. Retain the source storage until the import is checked.

PDFs, images and render snapshots use private Blob storage. Blob writes reject existing paths; audit and metadata remain in the database. Downloads pass through authenticated or verification-token routes. R2-specific custom object metadata is replaced by the existing database snapshots and render-input JSON.

Three combined incorrect code/email attempts permanently mark the server-issued browser identifier as banned in the database. Browsers do not expose a reliable physical hardware ID; clearing cookies or using a different browser can produce another identifier.

Integration QA uses local libSQL and a private Blob emulator. Live provider connectivity requires the production credentials and must be checked after deployment.
