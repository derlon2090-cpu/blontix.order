import { env } from "@/lib/runtime";
import { appendDocumentAudit } from "@/lib/audit";
import { requireDocumentSession } from "@/lib/access";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireDocumentSession(request);
    if (!env.DB) throw new Error("قاعدة البيانات غير متاحة.");
    const { id } = await context.params;
    const row = await env.DB.prepare(
      "SELECT snapshot_json, snapshot_hash, document_reference, document_version, terms_version, created_at, generated_at, status FROM order_documents WHERE id = ?"
    ).bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "المستند غير موجود." }, { status: 404 });
    await appendDocumentAudit(env.DB, id, "snapshot_viewed", "success", actorId);
    const snapshot = JSON.parse(String(row.snapshot_json));
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
    const message = error instanceof Error ? error.message : "تعذر تحميل Snapshot.";
    return Response.json({ error: message === "AUTH_REQUIRED" ? "يلزم تسجيل الدخول." : message }, { status: message === "AUTH_REQUIRED" ? 401 : 500, headers: { "Cache-Control": "no-store" } });
  }
}
