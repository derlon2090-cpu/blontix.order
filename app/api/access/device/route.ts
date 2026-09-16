import { ensureAccessDevice } from "@/lib/access";

export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
  try {
    const device = await ensureAccessDevice(request);
    if (device.cookie) headers.append("Set-Cookie", device.cookie);
    return Response.json({ ready: !device.banned, blocked: device.banned }, { status: device.banned ? 403 : 200, headers });
  } catch {
    return Response.json({ ready: false }, { status: 503, headers });
  }
}
