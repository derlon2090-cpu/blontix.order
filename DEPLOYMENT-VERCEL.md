# Vercel deployment transition

Production now targets the existing Render web service with PostgreSQL and Cloudflare R2. Follow [DEPLOYMENT-RENDER.md](./DEPLOYMENT-RENDER.md). Turso and Vercel Blob are no longer production providers; their environment variables are not used.

The native Next.js build remains compatible with Vercel, but a frontend on another origin needs an explicit same-origin proxy to Render before authentication can use the required Strict cookies. Do not point browser API calls directly across unrelated domains or enable wildcard administrative CORS. Serve the whole app on Render for the configured deployment.
