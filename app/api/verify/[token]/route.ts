import { env } from "cloudflare:workers";
import { enforceVerificationRateLimit, recordVerification } from "@/lib/verification";
import { shortFingerprint } from "@/lib/security";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const headers = {
    "Cache-Control": "no-store, private",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  try {
    if (!env.DB) throw new Error("خدمة التحقق غير متاحة.");
    await enforceVerificationRateLimit(request, "verify-page", 30);
    const { token } = await context.params;
    if (token.length < 32 || token.length > 128) {
      await recordVerification(null, "not_found");
      return Response.json({ status: "not_found" }, { status: 404, headers });
    }
    const row = await env.DB.prepare(
      `SELECT id, order_number, product_name, price, masked_phone, document_reference,
        document_version, finalized_at, lifecycle_status, verification_id, pdf_sha256,
        signature_status, timestamp_status
       FROM order_documents WHERE verification_token = ?`
    ).bind(token).first<Record<string, unknown>>();
    if (!row) {
      await recordVerification(null, "not_found");
      return Response.json({ status: "not_found" }, { status: 404, headers });
    }
    const latest = await env.DB.prepare(
      "SELECT MAX(document_version) AS latest_version FROM order_documents WHERE order_number = ? AND lifecycle_status != 'cancelled'"
    ).bind(row.order_number).first<{ latest_version: number }>();
    const lifecycle = String(row.lifecycle_status);
    const status = lifecycle === "cancelled" ? "cancelled" : Number(latest?.latest_version ?? row.document_version) > Number(row.document_version) ? "superseded" : "original";
    await recordVerification(String(row.id), status);
    return Response.json({
      status,
      documentReference: row.document_reference,
      orderNumber: row.order_number,
      productName: row.product_name,
      price: row.price,
      currency: "SAR",
      documentVersion: row.document_version,
      latestVersion: latest?.latest_version ?? row.document_version,
      issuedAt: row.finalized_at,
      maskedPhone: row.masked_phone,
      verificationId: row.verification_id,
      documentFingerprint: shortFingerprint(String(row.pdf_sha256)),
      signatureStatus: row.signature_status,
      timestampStatus: row.timestamp_status,
    }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json({ status: message === "RATE_LIMITED" ? "rate_limited" : "unavailable" }, { status: message === "RATE_LIMITED" ? 429 : 503, headers });
  }
}
