import 'server-only';
import {createHmac,randomBytes} from 'node:crypto';
import {decodeKey,validateEnvironment} from './environment.mjs';
import { canonicalStringify } from "./order-document";

export function secureToken(byteLength = 32) { if(byteLength < 32) throw new Error('Token must contain at least 32 random bytes'); return randomBytes(byteLength).toString('base64url'); }

export function verificationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `VRF-${value.slice(0, 4)}-${value.slice(4)}`;
}

export function shortFingerprint(hash: string) {
  return hash.slice(0, 16).toUpperCase().match(/.{1,4}/g)?.join("-") ?? hash.slice(0, 16).toUpperCase();
}

export async function auditHash(input: {
  eventId: string;
  documentId: string;
  eventType: string;
  result: string;
  actorId: string | null;
  previousHash: string;
  createdAt: string;
  sequence: number;
}) {
  return createHmac("sha256", decodeKey(validateEnvironment().AUDIT_HMAC_KEY, "AUDIT_HMAC_KEY")).update(canonicalStringify(input)).digest("hex");
}

export function clientAddressHashSource(request: Request) {
  if (process.env.VERCEL === "1") return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const raw = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  return raw;
}
