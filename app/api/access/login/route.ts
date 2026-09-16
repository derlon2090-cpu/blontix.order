import { env } from "@/lib/runtime";
import { accessDevice, createPreAuthChallenge, ipLoginLocked, recordAccessFailure, verifyAccessPassword } from "@/lib/access";

const responseHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const failure = (blocked = false) => Response.json({ error: blocked ? "تم حظر هذا المتصفح بعد ثلاث محاولات فاشلة. تواصل مع مسؤول المنصة." : "تعذر تسجيل الدخول. تحقق من البيانات المدخلة.", blocked }, { status: blocked ? 403 : 401, headers: responseHeaders });

export async function POST(request: Request) {
  try {
    if (!env.DB) return failure();
    const device = await accessDevice(request);
    if (!device) return Response.json({ error: "أعد تحميل صفحة الدخول قبل المحاولة." }, { status: 428, headers: responseHeaders });
    if (device.banned) return failure(true);
    if (await ipLoginLocked(request)) return failure();
    const body = await request.json().catch(() => ({})) as { password?: unknown };
    const password = typeof body.password === "string" && body.password.length <= 256 ? body.password : "";
    if (!await verifyAccessPassword(password)) return failure(await recordAccessFailure(request, device.deviceHash));
    const challengeCookie = await createPreAuthChallenge(device.deviceHash);
    return Response.json({ next: "/login/email" }, { headers: { ...responseHeaders, "Set-Cookie": challengeCookie } });
  } catch { return failure(); }
}
