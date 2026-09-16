# Production on Render

Deploy this repository's `main` branch to the existing Node web service at https://blontix-order.onrender.com.

- Node: 22.x.
- Build command: `npm ci --include=dev && npm run build`.
- Start command: `npm start`.
- Health check path: `/api/health`.

Set all nine variables in [.env.example](.env.example) on the web service. Use the PostgreSQL Internal Database URL in the same Render region. Keep the R2 bucket private and grant its S3 credentials object read/write/delete and bucket-head access. No secrets belong in Git, frontend variables, or deployment command arguments. Paste the Argon2id PHC hash literally into Render; do not escape its `$` characters there.

`npm start` validates configuration, performs a real PostgreSQL `SELECT 1` and R2 `HeadBucket`, applies PostgreSQL migrations under a session advisory lock, and then starts Next.js. An unavailable provider prevents startup. `npm run db:migrate` also applies migrations explicitly; re-running it is safe. The old SQLite migrations are historical only; `drizzle-postgres` is the production migration folder. Existing SQLite data is not automatically imported into PostgreSQL.

Serve the complete application from Render so its relative API requests and `HttpOnly; Secure; SameSite=Strict` cookies share one origin. This deployment does not require CORS or direct browser access to R2. An existing Vercel deployment with the old Turso configuration does not automatically become the Render backend: use the Render URL, or configure a same-origin reverse proxy separately before using the Vercel frontend. Never enable wildcard CORS for administrative APIs.

PostgreSQL stores versions, encrypted snapshots and phone numbers, token lookup hashes, object metadata, sessions, bans and HMAC audit events. PDFs, original images, logo assets and encrypted render inputs live in R2. Each final version has separate keys; conditional writes reject overwrites. Downloads retrieve and check the stored master rather than regenerate it. A database trigger rejects final-content updates and deletions. Creating a new version preserves the old master.

Generation jobs record intended object keys before upload. A final database transaction commits the document, four asset records, audit event and job status together. Known failures clean up uploaded objects; an uncertain commit leaves objects tracked by the job until PostgreSQL is reachable, avoiding deletion of a possibly committed master. `npm run storage:cleanup-failed` cleans failed jobs older than one hour, under row locks and after checking that no asset record references their keys. It never selects generating or final jobs. Investigate aged generating jobs and confirm no active process or committed document before marking them failed; do not delete referenced objects.

Do not rotate the encryption key without re-encrypting existing records and render inputs. Do not rotate the audit key without a planned audit-chain migration. Rotating the session secret invalidates existing authenticated cookies. A password-hash change affects new login checks; rotate the session secret too if all existing sessions must be revoked.

## Verification

`/api/health` returns HTTP 200 only after both live providers respond; otherwise HTTP 503. It exposes provider states only. A healthy bucket check alone does not prove document upload permissions.

To prove production persistence, create a clearly labelled test document, inspect its PostgreSQL row and four R2 objects, save the downloaded master SHA-256, restart the existing service, and confirm the same document, public QR and identical master remain. Check both an unchanged and modified PDF using public file verification. Use the authenticated audit endpoint to verify the HMAC chain. Do not report these checks as successful solely because environment variables are present.

`node tests/production-workflow.mjs` is an isolated automated check requiring a PostgreSQL connection with schema-create permission and Node 24 for test hooks. It creates fresh QA schemas and uses the real AWS SDK through a test-only local S3 transport. It checks migrations, authentication, encrypted storage, immutable records, audit tampering and restart persistence. It is **not** evidence of live R2 connectivity. No test hooks are loaded by production scripts.
