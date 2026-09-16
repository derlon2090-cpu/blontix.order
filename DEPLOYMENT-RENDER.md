# Production on Render

Deploy this repository's `main` branch to the existing Node web service at https://blontix-order.onrender.com.

- Node: 22.x.
- Build command: `npm ci --include=dev && npm run build`.
- Start command: `npm start`.
- Health check path: `/api/health`.

The stylesheet/TypeScript build toolchain is included in `dependencies`, so a production-only npm installation still has `@tailwindcss/postcss`, Tailwind CSS, animation CSS, TypeScript and required type packages. Development-only ESLint and Drizzle schema generation remain in `devDependencies`. The schema-generator config is excluded from the application's TypeScript build; migration execution and database files are unchanged. Keep the documented build command with `--include=dev` for the service.

Set the private variables in [.env.example](.env.example) on the web service, including AUTH_TOTP_SECRET for three-step sign-in. Add the same Base32 key to your authenticator; see [TWO-FACTOR-AUTH.md](./TWO-FACTOR-AUTH.md). Use the external Neon PostgreSQL connection URL with its required TLS settings. No Render Database or Disk is created or required. Keep the R2 bucket private and grant its S3 credentials object read/write/delete and bucket-head access. No secrets belong in Git, frontend variables, or deployment command arguments. Paste the Argon2id PHC hash literally into Render; do not escape its `$` characters there.

`npm start` validates configuration, performs a real PostgreSQL `SELECT 1` and R2 `HeadBucket`, applies PostgreSQL migrations under a session advisory lock, and then starts Next.js. An unavailable provider prevents startup. `npm run db:migrate` also applies migrations explicitly; re-running it is safe. The old SQLite migrations are historical only; `drizzle-postgres` is the production migration folder. Existing SQLite data is not automatically imported into PostgreSQL.

Vercel serves the frontend; Render runs the backend. The frontend proxies /api/* to Render and checks login status through the backend. Browser cookies remain same-origin with HttpOnly; Secure; SameSite=Strict. Vercel requires no database, password-hash or R2 secrets. See DEPLOYMENT-VERCEL.md.

PostgreSQL stores versions, encrypted snapshots and phone numbers, token lookup hashes, object metadata, sessions, bans and HMAC audit events. PDFs, original images, logo assets and encrypted render inputs live in R2. Each final version has separate keys; conditional writes reject overwrites. Downloads retrieve and check the stored master rather than regenerate it. A database trigger rejects final-content updates and deletions. Creating a new version preserves the old master.

Generation jobs record intended object keys before upload. A final database transaction commits the document, four asset records, audit event and job status together. Known failures clean up uploaded objects; an uncertain commit leaves objects tracked by the job until PostgreSQL is reachable, avoiding deletion of a possibly committed master. `npm run storage:cleanup-failed` cleans failed jobs older than one hour, under row locks and after checking that no asset record references their keys. It never selects generating or final jobs. Investigate aged generating jobs and confirm no active process or committed document before marking them failed; do not delete referenced objects.

Do not rotate the encryption key without re-encrypting existing records and render inputs. Do not rotate the audit key without a planned audit-chain migration. Rotating the session secret invalidates existing authenticated cookies. A password-hash change affects new login checks; rotate the session secret too if all existing sessions must be revoked.

## Verification

`/api/health` returns HTTP 200 only after both live providers respond; otherwise HTTP 503. It exposes provider states only. A healthy bucket check alone does not prove document upload permissions.

To prove production persistence, create a clearly labelled test document, inspect its PostgreSQL row and four R2 objects, save the downloaded master SHA-256, restart the existing service, and confirm the same document, public QR and identical master remain. Check both an unchanged and modified PDF using public file verification. Use the authenticated audit endpoint to verify the HMAC chain. Do not report these checks as successful solely because environment variables are present.

`node tests/production-workflow.mjs` is an isolated automated check requiring a PostgreSQL connection with schema-create permission and Node 24 for test hooks. It creates fresh QA schemas and uses the real AWS SDK through a test-only local S3 transport. It checks migrations, authentication, encrypted storage, immutable records, audit tampering and restart persistence. It is **not** evidence of live R2 connectivity. No test hooks are loaded by production scripts.

## workerd deployment timeout recovery

The supplied Runtime Logs show Cloudflare workerd RPC failures and a Render deploy timeout. This confirms a failing Cloudflare worker process; it does not identify a PostgreSQL or R2 failure. The Node start path does not launch workerd. Verify the deployed commit and Settings on the existing service: branch main, Node runtime, build command above, and npm start. An existing dashboard Start Command is not replaced merely by editing package.json or committing render.yaml; apply the Blueprint to the existing service or update its settings directly. Then choose Clear build cache & deploy from Manual Deploy. Keep the existing nine secrets, including the Neon URL; do not replace them with QA values. Expected logs include PostgreSQL migrations applied and Starting Next.js Node server on 0.0.0.0 using PORT. Production requires Render's PORT and refuses missing or invalid values. Production checks remain pending.

## Free service configuration

render.yaml declares one Node web service on plan free, branch main, autoDeployTrigger commit, the documented Build/Start commands and /api/health. It declares no workspace, paid resource, database, disk, autoscaling or pre-deploy hook. Render attaches the service to the account existing workspace; this application does not require a paid workspace. Apply the Blueprint to the existing named service once; committing YAML alone does not link a manually configured service to a Blueprint. Secret entries use sync false so values are supplied privately on Render and existing values are preserved. Render supplies PORT. Startup uses 0.0.0.0 and applies the existing migrations directly at startup, without a paid pre-deploy feature.

Free services sleep after idle traffic and can take about one minute to wake. Frontend SSR authentication waits up to eight seconds, then displays a retry page without granting access or deleting cookies. Visitors without an authentication token go directly to login. Login device preparation runs in the browser with a 90-second timeout and a reconnect button. No keep-alive job, paid workspace feature or additional service is used. See https://render.com/docs/free.

The backend uses a standard Node HTTP server with native Next.js request handling. Its socket listens on `0.0.0.0` using `process.env.PORT`. Render's automatically supplied `RENDER_EXTERNAL_URL` provides the public HTTPS origin for existing document and QR links behind TLS termination; no extra secret or fixed listening port is required. See https://render.com/docs/environment-variables.
