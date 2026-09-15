import { env } from "cloudflare:workers";
import { appendDocumentAudit } from "@/lib/audit";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = request.headers.get("oai-authenticated-user-id");
    if (!actorId) return Response.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });
    if (!env.DB) throw new Error("قاعدة البيانات غير متاحة.");
    const { id } = await context.params;
    const row = await env.DB.prepare(
      "SELECT snapshot_json, snapshot_hash, document_reference, document_version, terms_version, created_at, generated_at, status FROM order_documents WHERE id = ?"
    ).bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "المستند غير موجود." }, { status: 404 });
    await appendDocumentAudit(env.DB, id, "snapshot_viewed", "success", actorId);
    const snapshot = JSON.parse(String(row.snapshot_json));
    snapshot.customerPhone = snapshot.maskedPhone;
    return Response.json({
      snapshot,
      snapshotHash: row.snapshot_hash,
      documentReference: row.document_reference,
      documentVersion: row.document_version,
      termsVersion: row.terms_version,
      createdAt: row.created_at,
      generatedAt: row.generated_at,
      status: row.status,
      immutable: row.status === "final",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر تحميل Snapshot." }, { status: 500 });
  }
}
