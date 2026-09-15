import { env } from "cloudflare:workers";
import { clientAddressHashSource } from "./security";
import { sha256Hex } from "./order-document";

export async function enforceVerificationRateLimit(request: Request, scope: string, maximum: number) {
  if (!env.DB) throw new Error("خدمة التحقق غير متاحة.");
  const subjectHash = await sha256Hex(`${scope}:${clientAddressHashSource(request)}`);
  const windowStart = Math.floor(Date.now() / 60_000);
  await env.DB.prepare(
    `INSERT INTO verification_rate_limits (subject_hash, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT(subject_hash, window_start) DO UPDATE SET count = count + 1`
  ).bind(subjectHash, windowStart).run();
  const row = await env.DB.prepare(
    "SELECT count FROM verification_rate_limits WHERE subject_hash = ? AND window_start = ?"
  ).bind(subjectHash, windowStart).first<{ count: number }>();
  if (Number(row?.count ?? 0) > maximum) throw new Error("RATE_LIMITED");
}

export async function recordVerification(documentId: string | null, result: string) {
  if (!env.DB) return;
  await env.DB.prepare(
    "INSERT INTO verification_events (id, document_id, result, created_at) VALUES (?, ?, ?, ?)"
  ).bind(crypto.randomUUID(), documentId, result, new Date().toISOString()).run();
}
