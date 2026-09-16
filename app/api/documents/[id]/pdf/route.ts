import { env } from "@/lib/runtime";
import { appendDocumentAudit } from "@/lib/audit";
import { requireDocumentSession } from "@/lib/access";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actorId = await requireDocumentSession(request);
    if (!env.DB || !env.BUCKET) throw new Error("خدمة الملفات غير متاحة.");
    const { id } = await context.params;
    const row = await env.DB.prepare(
      "SELECT pdf_key, document_reference FROM order_documents WHERE id = ?"
    ).bind(id).first<{ pdf_key: string; document_reference: string }>();
    if (!row) return new Response("المستند غير موجود.", { status: 404 });
    const object = await env.BUCKET.get(row.pdf_key);
    if (!object) return new Response("ملف PDF غير موجود.", { status: 404 });
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    await appendDocumentAudit(env.DB, id, disposition === "attachment" ? "master_pdf_downloaded" : "master_pdf_viewed", "success", actorId);
    return new Response(object.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${row.document_reference}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحميل PDF.";
    return new Response(message === "AUTH_REQUIRED" ? "يلزم تسجيل الدخول." : message, { status: message === "AUTH_REQUIRED" ? 401 : 500, headers: { "Cache-Control": "no-store" } });
  }
}
