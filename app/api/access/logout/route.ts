import { clearedPreAuthCookie, clearedSessionCookie, revokeDocumentSession } from "@/lib/access";

export async function POST(request: Request) {
  await revokeDocumentSession(request).catch(() => undefined);
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearedSessionCookie());
  headers.append("Set-Cookie", clearedPreAuthCookie());
  return Response.json({ ok: true }, { headers });
}
