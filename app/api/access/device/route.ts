import { ensureAccessDevice } from "@/lib/access";

export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  try {
    const device = await ensureAccessDevice(request);
    if (device.cookie) headers.append("Set-Cookie", device.cookie);
    return Response.json({ ready: !device.banned, blocked: device.banned }, { status: device.banned ? 403 : 200, headers });
  } catch {
    // Log configuration presence only; never log credentials or database URLs.
    console.error("ACCESS_DEVICE_UNAVAILABLE", { databaseConfigured: Boolean(process.env.DATABASE_URL), sessionConfigured: Boolean(process.env.SESSION_SECRET) });
    return Response.json({ ready: false, error: "خدمة الدخول غير متاحة مؤقتًا. يرجى التواصل مع مسؤول المنصة." }, { status: 503, headers });
  }
}
