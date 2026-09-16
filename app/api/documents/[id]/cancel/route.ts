import { env } from "@/lib/runtime";
import { auditHash } from "@/lib/security";
import { requireDocumentSession } from "@/lib/access";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actorId: string;
  try { actorId = await requireDocumentSession(request); } catch { return Response.json({ error: "يلزم تسجيل الدخول." }, { status: 401 }); }
  if (!env.DB) return Response.json({ error: "قاعدة البيانات غير متاحة." }, { status: 500 });
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT lifecycle_status FROM order_documents WHERE id = ?").bind(id).first<{ lifecycle_status: string }>();
  if (!row) return Response.json({ error: "المستند غير موجود." }, { status: 404 });
  if (row.lifecycle_status === "cancelled") return Response.json({ status: "cancelled", idempotent: true });
  const previous = await env.DB.prepare("SELECT event_hash FROM document_audit_logs WHERE document_id = ? ORDER BY created_at DESC, id DESC LIMIT 1").bind(id).first<{ event_hash: string }>();
  const createdAt = new Date().toISOString();
  const audit = { documentId: id, eventType: "document_cancelled", result: "success", actorId, previousHash: previous?.event_hash ?? "", createdAt };
  const eventHash = await auditHash(audit);
  await env.DB.batch([
    env.DB.prepare("UPDATE order_documents SET lifecycle_status = 'cancelled' WHERE id = ? AND lifecycle_status != 'cancelled'").bind(id),
    env.DB.prepare("INSERT INTO document_audit_logs (id, document_id, event_type, result, actor_id, previous_hash, event_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, audit.eventType, audit.result, actorId, audit.previousHash, eventHash, createdAt),
  ]);
  return Response.json({ status: "cancelled" });
}
