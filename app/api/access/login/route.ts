import { env } from "cloudflare:workers";
import { createDocumentSession, loginSubjectHash, verifyAccessPassword } from "@/lib/access";

const responseHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

export async function POST(request: Request) {
  const failure = () => Response.json({ error: "تعذر تسجيل الدخول. تحقق من الرقم السري." }, { status: 401, headers: responseHeaders });
  try {
    if (!env.DB) return failure();
    const subjectHash = await loginSubjectHash(request);
    const now = new Date();
    const row = await env.DB.prepare("SELECT failed_count, locked_until, updated_at FROM access_login_attempts WHERE subject_hash = ?").bind(subjectHash).first<{ failed_count: number; locked_until: string | null; updated_at: string }>();
    if (row?.locked_until && new Date(row.locked_until) > now) return failure();
    const body = await request.json().catch(() => ({})) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length > 256) return failure();
    const accepted = verifyAccessPassword(password);
    if (!accepted) {
      const withinWindow = row && now.getTime() - new Date(row.updated_at).getTime() < 15 * 60 * 1000;
      const failedCount = (withinWindow ? row.failed_count : 0) + 1;
      const delaySeconds = failedCount >= 5 ? Math.min(3600, 60 * 2 ** Math.min(failedCount - 5, 6)) : 0;
      const lockedUntil = delaySeconds ? new Date(now.getTime() + delaySeconds * 1000).toISOString() : null;
      await env.DB.prepare("INSERT INTO access_login_attempts (subject_hash, failed_count, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(subject_hash) DO UPDATE SET failed_count = excluded.failed_count, locked_until = excluded.locked_until, updated_at = excluded.updated_at").bind(subjectHash, failedCount, lockedUntil, now.toISOString()).run();
      return failure();
    }
    await env.DB.prepare("DELETE FROM access_login_attempts WHERE subject_hash = ?").bind(subjectHash).run();
    const cookie = await createDocumentSession();
    return Response.json({ ok: true }, { headers: { ...responseHeaders, "Set-Cookie": cookie } });
  } catch { return failure(); }
}
