import { env } from "@/lib/runtime";
import { accessDevice, constantTimeTextEqual, ipLoginLocked, preAuthChallenge, recordAccessFailure } from "@/lib/access";

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
    const now = new Date().toISOString();
    const marked = await env.DB.prepare('UPDATE access_login_challenges SET email_verified_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?').bind(now, challenge.tokenHash, now).run();
    if (marked.meta.changes !== 1) return failure();
    return Response.json({ next: '/login/2fa' }, { headers: responseHeaders });
  } catch { return failure(); }
}
