import { env } from "cloudflare:workers";
import { sha256Bytes } from "@/lib/order-document";
import { enforceVerificationRateLimit, recordVerification } from "@/lib/verification";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  };
  try {
    if (!env.DB) throw new Error("UNAVAILABLE");
    await enforceVerificationRateLimit(request, "verify-file", 10);
    const { token } = await context.params;
    const row = await env.DB.prepare(
      "SELECT id, pdf_sha256 FROM order_documents WHERE verification_token = ?"
    ).bind(token).first<{ id: string; pdf_sha256: string }>();
    if (!row) return Response.json({ result: "not_found" }, { status: 404, headers });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ result: "invalid_file" }, { status: 400, headers });
    if (file.type !== "application/pdf") return Response.json({ result: "invalid_file" }, { status: 400, headers });
    if (file.size > 15 * 1024 * 1024) return Response.json({ result: "file_too_large" }, { status: 413, headers });
    const uploadedHash = await sha256Bytes(new Uint8Array(await file.arrayBuffer()));
    const result = uploadedHash === row.pdf_sha256 ? "match" : "mismatch";
    await recordVerification(row.id, result);
    return Response.json({ result }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json({ result: message === "RATE_LIMITED" ? "rate_limited" : "unavailable" }, { status: message === "RATE_LIMITED" ? 429 : 503, headers });
  }
}
