import { auditHash } from "@/lib/security";

export async function appendDocumentAudit(
  db: D1Database,
  documentId: string,
  eventType: string,
  result: string,
  actorId: string | null,
) {
  const previous = await db.prepare(
    "SELECT event_hash FROM document_audit_logs WHERE document_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
  ).bind(documentId).first<{ event_hash: string }>();
  const createdAt = new Date().toISOString();
  const previousHash = previous?.event_hash ?? "";
  const eventHash = await auditHash({ documentId, eventType, result, actorId, previousHash, createdAt });
  await db.prepare(
    "INSERT INTO document_audit_logs (id, document_id, event_type, result, actor_id, previous_hash, event_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), documentId, eventType, result, actorId, previousHash, eventHash, createdAt).run();
}
