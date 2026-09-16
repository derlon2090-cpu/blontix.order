import { healthCheck } from '@/lib/providers.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { const health = await healthCheck(); return Response.json(health, { status: health.status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }); }
  catch { return Response.json({ status: 'unavailable', database: 'unavailable', storage: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
