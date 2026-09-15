import { clearedSessionCookie, revokeDocumentSession } from "@/lib/access";

export async function POST(request: Request) {
  await revokeDocumentSession(request).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie(), "Cache-Control": "no-store" } });
}
