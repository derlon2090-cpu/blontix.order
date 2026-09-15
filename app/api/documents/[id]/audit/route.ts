import { env } from "cloudflare:workers";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const actorId = request.headers.get("oai-authenticated-user-id");
  if (!actorId) return Response.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });
  if (!env.DB) return Response.json({ error: "قاعدة البيانات غير متاحة." }, { status: 500 });
  const { id } = await context.params;
  const document = await env.DB.prepare("SELECT id FROM order_documents WHERE id = ?").bind(id).first();
  if (!document) return Response.json({ error: "المستند غير موجود." }, { status: 404 });
  const result = await env.DB.prepare(
    "SELECT id, event_type, result, actor_id, previous_hash, event_hash, created_at FROM document_audit_logs WHERE document_id = ? ORDER BY created_at DESC, id DESC LIMIT 100",
  ).bind(id).all();
  return Response.json({ events: result.results }, { headers: { "Cache-Control": "private, no-store" } });
}
