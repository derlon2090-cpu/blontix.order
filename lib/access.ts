import { env } from "cloudflare:workers";
import { argon2id } from "@noble/hashes/argon2.js";

const COOKIE_NAME = "__Host-blontix_session";
const SESSION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

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

export function verifyAccessPassword(password: string) {
  const hash = accessPasswordHash();
  const parts = hash.split("$");
  if (parts.length !== 6 || parts[1] !== "argon2id" || parts[2] !== "v=19") throw new Error("ACCESS_HASH_INVALID");
  const cost = Object.fromEntries(parts[3].split(",").map((pair) => pair.split("=")));
  const m = Number(cost.m), t = Number(cost.t), p = Number(cost.p);
  if (!Number.isInteger(m) || m < 8192 || m > 32768 || !Number.isInteger(t) || t < 2 || t > 4 || p !== 1) throw new Error("ACCESS_HASH_INVALID");
  const salt = fromBase64Url(parts[4]);
  const expected = fromBase64Url(parts[5]);
  if (salt.length < 16 || expected.length !== 32) throw new Error("ACCESS_HASH_INVALID");
  const actual = argon2id(encoder.encode(password), salt, { m, t, p, dkLen: 32, maxmem: 48 * 1024 * 1024 });
  return constantTimeEqual(actual, expected);
}

async function hmac(value: string) {
  const secret = env.SESSION_SECRET;
  if (!secret || fromBase64Url(secret).length < 32) throw new Error("SESSION_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey("raw", fromBase64Url(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function cookieFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) ?? "";
}

export async function sessionIsValid(request: Request) {
  if (!env.DB) return false;
  const token = cookieFromRequest(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const tokenHash = await hmac(`session:${token}`);
  const row = await env.DB.prepare("SELECT password_hash_fingerprint FROM access_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?").bind(tokenHash, new Date().toISOString()).first<{ password_hash_fingerprint: string }>();
  return Boolean(row && row.password_hash_fingerprint === await hmac(`password-hash:${accessPasswordHash()}`));
}

export async function requireDocumentSession(request: Request) {
  if (!await sessionIsValid(request)) throw new Error("AUTH_REQUIRED");
  return "internal";
}

export async function createDocumentSession() {
  if (!env.DB) throw new Error("DB_UNAVAILABLE");
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
  await env.DB.prepare("INSERT INTO access_sessions (token_hash, password_hash_fingerprint, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(await hmac(`session:${token}`), await hmac(`password-hash:${accessPasswordHash()}`), createdAt.toISOString(), expiresAt.toISOString()).run();
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`;
}

export async function revokeDocumentSession(request: Request) {
  if (!env.DB) return;
  const token = cookieFromRequest(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await env.DB.prepare("UPDATE access_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(new Date().toISOString(), await hmac(`session:${token}`)).run();
}

export function clearedSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function loginSubjectHash(request: Request) {
  const address = request.headers.get("cf-connecting-ip") || "anonymous";
  return hmac(`login-ip:${address}`);
}
