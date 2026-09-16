# Frontend on Vercel

Deploy this repository's main branch with the existing vercel.json. Vercel builds with npm run build:vercel, which selects APP_ROLE=frontend. Vercel runtime selects frontend automatically from VERCEL=1. Build output remains native Next.js in .next.

The frontend serves the existing UI and verification page. Its /api/* requests use a beforeFiles reverse proxy to https://blontix-order.onrender.com. SSR login checks call the backend's minimal /api/access/status endpoint and forward cookies only. PostgreSQL, Argon2 verification, R2 and all persistent operations execute on Render; frontend runtime refuses to access database/storage providers.

BACKEND_URL is an optional non-secret HTTPS origin when changing the backend hostname. Its default is the existing Render service URL. Do not set APP_ROLE=frontend or VERCEL=1 on Render. Do not put DATABASE_URL, access-password hash, session/encryption/audit keys, or R2 credentials on Vercel. Remove old Turso/Blob/hash/session credentials from the existing Vercel environment after the Render backend is configured; source changes cannot remove dashboard variables.

Browser requests remain same-origin on Vercel. Backend Set-Cookie responses use the existing host-only HttpOnly, Secure, SameSite=Strict cookies. No wildcard CORS, cross-domain cookie relaxation, client secrets, or direct browser R2 access is introduced. The public verification URLs and PDF generation rules remain unchanged.

Deploy Render first, verify its /api/health, then deploy Vercel. A successful frontend build does not prove live backend connectivity. npm run start:vercel provides a local frontend-only Next.js start command and does not migrate or connect to PostgreSQL.
