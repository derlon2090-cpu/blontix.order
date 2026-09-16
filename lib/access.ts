import { env } from "@/lib/runtime";
import { argon2idAsync } from "@noble/hashes/argon2.js";
import { clientAddressHashSource } from "./security";

const SESSION_COOKIE_NAME = "__Host-blontix_session";
const DEVICE_COOKIE_NAME = "__Host-blontix_device";
const PREAUTH_COOKIE_NAME = "__Host-blontix_pre_auth";
const SESSION_SECONDS = 12 * 60 * 60;
const PREAUTH_SECONDS = 5 * 60;
const encoder = new TextEncoder();
let passwordVerificationQueue = Promise.resolve();

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function accessPasswordHash() {
  const hash = env.DOCUMENTS_ACCESS_PASSWORD_HASH;
  if (!hash?.startsWith("$argon2id$v=19$")) throw new Error("ACCESS_NOT_CONFIGURED");
  return hash;
}

export async function verifyAccessPassword(password: string) {
  const hash = accessPasswordHash();
  const parts = hash.split("$");
  if (parts.length !== 6 || parts[1] !== "argon2id" || parts[2] !== "v=19") throw new Error("ACCESS_HASH_INVALID");
  const cost = Object.fromEntries(parts[3].split(",").map((pair) => pair.split("=")));
  const m = Number(cost.m), t = Number(cost.t), p = Number(cost.p);
  if (!Number.isInteger(m) || m < 8192 || m > 32768 || !Number.isInteger(t) || t < 2 || t > 4 || p !== 1) throw new Error("ACCESS_HASH_INVALID");
  const salt = fromBase64Url(parts[4]);
  const expected = fromBase64Url(parts[5]);
  if (salt.length < 16 || expected.length !== 32) throw new Error("ACCESS_HASH_INVALID");
  // Limit the memory-heavy operation to one request per Worker isolate.
  const previous = passwordVerificationQueue;
  let release!: () => void;
  passwordVerificationQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    const actual = await argon2idAsync(encoder.encode(password), salt, { m, t, p, dkLen: 32, maxmem: 48 * 1024 * 1024 });
    return constantTimeEqual(actual, expected);
  } finally { release(); }
}

async function hmac(value: string) {
  const secret = env.SESSION_SECRET;
  if (!secret || fromBase64Url(secret).length < 32) throw new Error("SESSION_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey("raw", fromBase64Url(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function cookieFromRequest(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function validToken(value: string) { return /^[A-Za-z0-9_-]{43}$/.test(value); }
function freshToken() { return toBase64Url(crypto.getRandomValues(new Uint8Array(32))); }
function secureCookie(name: string, token: string, maxAge: number) {
  return `${name}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export async function accessDevice(request: Request) {
  if (!env.DB) return null;
  const token = cookieFromRequest(request, DEVICE_COOKIE_NAME);
  if (!validToken(token)) return null;
  const deviceHash = await hmac(`device:${token}`);
  const row = await env.DB.prepare("SELECT failed_count, banned_at FROM access_devices WHERE device_token_hash = ?")
    .bind(deviceHash).first<{ failed_count: number; banned_at: string | null }>();
  return row ? { deviceHash, failedCount: row.failed_count, banned: Boolean(row.banned_at) } : null;
}

export async function ensureAccessDevice(request: Request) {
  const existing = await accessDevice(request);
  if (existing) return { ...existing, cookie: null as string | null };
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  const token = freshToken();
  const deviceHash = await hmac(`device:${token}`);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO access_devices (device_token_hash, failed_count, banned_at, created_at, last_seen_at) VALUES (?, 0, NULL, ?, ?)")
    .bind(deviceHash, now, now).run();
  return { deviceHash, failedCount: 0, banned: false, cookie: secureCookie(DEVICE_COOKIE_NAME, token, 365 * 24 * 60 * 60) };
}

export async function recordAccessFailure(request: Request, deviceHash: string) {
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  const now = new Date().toISOString();
  await env.DB.prepare("UPDATE access_devices SET failed_count = failed_count + 1, banned_at = CASE WHEN failed_count + 1 >= 3 THEN ? ELSE banned_at END, last_seen_at = ? WHERE device_token_hash = ? AND banned_at IS NULL")
    .bind(now, now, deviceHash).run();
  const subjectHash = await loginSubjectHash(request);
  const previous = await env.DB.prepare("SELECT failed_count, updated_at FROM access_login_attempts WHERE subject_hash = ?")
    .bind(subjectHash).first<{ failed_count: number; updated_at: string }>();
  const inWindow = previous && Date.now() - new Date(previous.updated_at).getTime() < 60 * 60 * 1000;
  const failedCount = (inWindow ? previous.failed_count : 0) + 1;
  const lockedUntil = failedCount >= 3 ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
  await env.DB.prepare("INSERT INTO access_login_attempts (subject_hash, failed_count, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(subject_hash) DO UPDATE SET failed_count = excluded.failed_count, locked_until = excluded.locked_until, updated_at = excluded.updated_at")
    .bind(subjectHash, failedCount, lockedUntil, now).run();
  const current = await accessDevice(request);
  return Boolean(current?.banned);
}

export async function ipLoginLocked(request: Request) {
  if (!env.DB) return true;
  const row = await env.DB.prepare("SELECT locked_until FROM access_login_attempts WHERE subject_hash = ?")
    .bind(await loginSubjectHash(request)).first<{ locked_until: string | null }>();
  return Boolean(row?.locked_until && new Date(row.locked_until) > new Date());
}

export async function resetAccessFailures(request: Request, deviceHash: string) {
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  await env.DB.batch([
    env.DB.prepare("UPDATE access_devices SET failed_count = 0, last_seen_at = ? WHERE device_token_hash = ? AND banned_at IS NULL")
      .bind(new Date().toISOString(), deviceHash),
    env.DB.prepare("DELETE FROM access_login_attempts WHERE subject_hash = ?").bind(await loginSubjectHash(request)),
  ]);
}

export async function createPreAuthChallenge(deviceHash: string) {
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  const token = freshToken();
  const now = new Date();
  await env.DB.prepare("INSERT INTO access_login_challenges (token_hash, device_hash, password_hash_fingerprint, created_at, expires_at, consumed_at) VALUES (?, ?, ?, ?, ?, NULL)")
    .bind(await hmac(`preauth:${token}`), deviceHash, await hmac(`password-hash:${accessPasswordHash()}`), now.toISOString(), new Date(now.getTime() + PREAUTH_SECONDS * 1000).toISOString()).run();
  return secureCookie(PREAUTH_COOKIE_NAME, token, PREAUTH_SECONDS);
}

export async function preAuthChallenge(request: Request) {
  if (!env.DB) return null;
  const token = cookieFromRequest(request, PREAUTH_COOKIE_NAME);
  if (!validToken(token)) return null;
  const device = await accessDevice(request);
  if (!device || device.banned) return null;
  const tokenHash = await hmac(`preauth:${token}`);
  const row = await env.DB.prepare("SELECT device_hash, password_hash_fingerprint FROM access_login_challenges WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?")
    .bind(tokenHash, new Date().toISOString()).first<{ device_hash: string; password_hash_fingerprint: string }>();
  if (!row || row.device_hash !== device.deviceHash || row.password_hash_fingerprint !== await hmac(`password-hash:${accessPasswordHash()}`)) return null;
  return { tokenHash, deviceHash: device.deviceHash };
}

export async function consumePreAuthChallenge(tokenHash: string) {
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE access_login_challenges SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?")
    .bind(now, tokenHash, now).run();
  return result.meta.changes === 1;
}

export function clearedPreAuthCookie() { return secureCookie(PREAUTH_COOKIE_NAME, "", 0); }

export function constantTimeTextEqual(a: string, b: string) {
  return constantTimeEqual(encoder.encode(a), encoder.encode(b));
}

export async function sessionIsValid(request: Request) {
  if (!env.DB) return false;
  const token = cookieFromRequest(request, SESSION_COOKIE_NAME);
  if (!validToken(token)) return false;
  const device = await accessDevice(request);
  if (!device || device.banned) return false;
  const tokenHash = await hmac(`session:${token}`);
  const row = await env.DB.prepare("SELECT password_hash_fingerprint, device_hash FROM access_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?").bind(tokenHash, new Date().toISOString()).first<{ password_hash_fingerprint: string; device_hash: string }>();
  return Boolean(row && row.device_hash === device.deviceHash && row.password_hash_fingerprint === await hmac(`password-hash:${accessPasswordHash()}`));
}

export async function requireDocumentSession(request: Request) {
  if (!await sessionIsValid(request)) throw new Error("AUTH_REQUIRED");
  return "internal";
}

export async function createDocumentSession(deviceHash: string) {
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  const token = freshToken();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
  await env.DB.prepare("INSERT INTO access_sessions (token_hash, password_hash_fingerprint, device_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(await hmac(`session:${token}`), await hmac(`password-hash:${accessPasswordHash()}`), deviceHash, createdAt.toISOString(), expiresAt.toISOString()).run();
  return secureCookie(SESSION_COOKIE_NAME, token, SESSION_SECONDS);
}

export async function revokeDocumentSession(request: Request) {
  if (!env.DB) return;
  const token = cookieFromRequest(request, SESSION_COOKIE_NAME);
  if (!validToken(token)) return;
  await env.DB.prepare("UPDATE access_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(new Date().toISOString(), await hmac(`session:${token}`)).run();
}

export function clearedSessionCookie() {
  return secureCookie(SESSION_COOKIE_NAME, "", 0);
}

export async function loginSubjectHash(request: Request) {
  const address = clientAddressHashSource(request);
  return hmac(`login-ip:${address}`);
}
