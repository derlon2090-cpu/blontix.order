import { canonicalStringify, sha256Hex } from "./order-document";

export function secureToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function verificationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `VRF-${value.slice(0, 4)}-${value.slice(4)}`;
}

export function shortFingerprint(hash: string) {
  return hash.slice(0, 16).toUpperCase().match(/.{1,4}/g)?.join("-") ?? hash.slice(0, 16).toUpperCase();
}

export async function auditHash(input: {
  documentId: string;
  eventType: string;
  result: string;
  actorId: string | null;
  previousHash: string;
  createdAt: string;
}) {
  return sha256Hex(canonicalStringify(input));
}

export function clientAddressHashSource(request: Request) {
  if (process.env.VERCEL === "1") return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const raw = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  return raw;
}
