import { env } from "@/lib/runtime";
import { accessDevice, clearedPreAuthCookie, constantTimeTextEqual, consumePreAuthChallenge, createDocumentSession, ipLoginLocked, preAuthChallenge, recordAccessFailure, resetAccessFailures } from "@/lib/access";

const ADMIN_EMAIL = "blontix.official@gmail.com";
const responseHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const failure = (blocked = false) => Response.json({ error: blocked ? "تم حظر هذا المتصفح بعد ثلاث محاولات فاشلة. تواصل مع مسؤول المنصة." : "تعذر تسجيل الدخول. تحقق من البيانات المدخلة.", blocked }, { status: blocked ? 403 : 401, headers: responseHeaders });

export async function POST(request: Request) {
  try {
    if (!env.DB) return failure();
    const device = await accessDevice(request);
    if (device?.banned) return failure(true);
    if (await ipLoginLocked(request)) return failure();
    const challenge = await preAuthChallenge(request);
    if (!challenge) return failure();
    const body = await request.json().catch(() => ({})) as { email?: unknown };
    const email = typeof body.email === "string" && body.email.length <= 254 ? body.email.trim().toLowerCase() : "";
    if (!constantTimeTextEqual(email, ADMIN_EMAIL)) return failure(await recordAccessFailure(request, challenge.deviceHash));
    if (!await consumePreAuthChallenge(challenge.tokenHash)) return failure();
    await resetAccessFailures(request, challenge.deviceHash);
    const sessionCookie = await createDocumentSession(challenge.deviceHash);
    const headers = new Headers(responseHeaders);
    headers.append("Set-Cookie", sessionCookie);
    headers.append("Set-Cookie", clearedPreAuthCookie());
    return Response.json({ ok: true }, { headers });
  } catch { return failure(); }
}
