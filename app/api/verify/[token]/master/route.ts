import { env } from "@/lib/runtime";
import { enforceVerificationRateLimit, recordVerification } from "@/lib/verification";

const secureHeaders = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    if (!env.DB || !env.BUCKET) throw new Error("UNAVAILABLE");
    await enforceVerificationRateLimit(request, "master-download", 12);
    const { token } = await context.params;
    if (token.length < 32 || token.length > 128) return new Response("المستند غير موجود.", { status: 404, headers: secureHeaders });
    const row = await env.DB.prepare(
      "SELECT id, pdf_key, document_reference FROM order_documents WHERE verification_token = ?"
    ).bind(token).first<{ id: string; pdf_key: string; document_reference: string }>();
    if (!row) return new Response("المستند غير موجود.", { status: 404, headers: secureHeaders });
    const object = await env.BUCKET.get(row.pdf_key);
    if (!object) throw new Error("UNAVAILABLE");
    await recordVerification(row.id, "master_pdf_downloaded");
    return new Response(object.body, { headers: {
      ...secureHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${row.document_reference}.pdf"`,
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return new Response(message === "RATE_LIMITED" ? "تم تجاوز حد التنزيل المؤقت." : "تعذر تحميل النسخة الأصلية.", { status: message === "RATE_LIMITED" ? 429 : 503, headers: secureHeaders });
  }
}
