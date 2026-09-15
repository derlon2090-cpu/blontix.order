import { env } from "cloudflare:workers";
import { enforceVerificationRateLimit, recordVerification } from "@/lib/verification";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };
  try {
    if (!env.DB) throw new Error("خدمة التحقق غير متاحة.");
    await enforceVerificationRateLimit(request, "private-verification", 5);
    const { token } = await context.params;
    const row = await env.DB.prepare(
      "SELECT id, customer_phone, document_reference FROM order_documents WHERE verification_token = ? AND lifecycle_status IN ('final', 'superseded')"
    ).bind(token).first<{ id: string; customer_phone: string; document_reference: string }>();
    if (!row) return Response.json({ error: "تعذر بدء التحقق." }, { status: 404, headers });
    if (!env.PHONE_VERIFICATION_SERVICE_URL) {
      return Response.json({ error: "التحقق الخاص جاهز للربط ويحتاج إعداد مزود إثبات الهاتف الآمن." }, { status: 503, headers });
    }
    const response = await fetch(env.PHONE_VERIFICATION_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.PHONE_VERIFICATION_SERVICE_TOKEN ? { Authorization: `Bearer ${env.PHONE_VERIFICATION_SERVICE_TOKEN}` } : {}),
      },
      body: JSON.stringify({ phone: row.customer_phone, purpose: "document_customer_link", reference: row.document_reference }),
    });
    if (!response.ok) throw new Error("تعذر إرسال إثبات الهاتف.");
    await recordVerification(row.id, "private_challenge_started");
    return Response.json({ status: "challenge_sent" }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر بدء التحقق الخاص.";
    return Response.json({ error: message === "RATE_LIMITED" ? "تم تجاوز الحد المؤقت للمحاولات." : message }, { status: message === "RATE_LIMITED" ? 429 : 503, headers });
  }
}
