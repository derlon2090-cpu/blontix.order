import {accessDevice, clearedPreAuthCookie, ipLoginLocked, preAuthChallenge} from '@/lib/access';
import {verifyTotpLogin} from '@/lib/totp-access';
const responseHeaders = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'};
export async function POST(request: Request) {
  try {
    const device = await accessDevice(request);
    if (device?.banned) return Response.json({blocked: true, error: 'تم حظر هذا المتصفح بعد ثلاث محاولات فاشلة.'}, {status: 403, headers: responseHeaders});
    if (await ipLoginLocked(request)) return Response.json({error: 'تم إيقاف المحاولات مؤقتًا.'}, {status: 429, headers: responseHeaders});
    const challenge = await preAuthChallenge(request);
    if (!challenge) return Response.json({error: 'انتهت جلسة الدخول. ابدأ من الخطوة الأولى.'}, {status: 401, headers: responseHeaders});
    const body = await request.json().catch(() => ({})) as {code?: unknown};
    const code = typeof body.code === 'string' && body.code.length <= 16 ? body.code.trim() : '';
    const outcome = await verifyTotpLogin(request, challenge, code);
    if (outcome.result !== 'verified') {
      const blocked = outcome.result === 'blocked';
      const error = blocked ? 'تم حظر هذا المتصفح بعد ثلاث محاولات فاشلة.' : outcome.result === 'replayed' ? 'استُخدم هذا الرمز مسبقًا. انتظر الرمز التالي في التطبيق.' : outcome.result === 'expired' ? 'انتهت جلسة الدخول أو لم تكتمل خطوة البريد. ابدأ من الخطوة الأولى.' : 'رمز المصادقة غير صحيح. تحقق من الوقت والرمز في التطبيق.';
      return Response.json({error, blocked}, {status: blocked ? 403 : 401, headers: responseHeaders});
    }
    const headers = new Headers(responseHeaders);
    headers.append('Set-Cookie', outcome.cookie!);
    headers.append('Set-Cookie', clearedPreAuthCookie());
    return Response.json({ok: true}, {headers});
  } catch {
    return Response.json({error: 'خدمة المصادقة الثنائية غير متاحة. تحقق من إعدادها لدى مسؤول المنصة.'}, {status: 503, headers: responseHeaders});
  }
}
