import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import {totpAtStep} from '../lib/totp.ts';

const base = process.env.QA_BASE_URL || "http://127.0.0.1:5174";
const password = process.env.QA_PASSWORD;
if (!password) throw new Error("QA_PASSWORD must be provided in the process environment.");
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => nativeFetch(input, { ...init, signal: init.signal || AbortSignal.timeout(120_000) });

const ip = `qa-legitimate-${randomUUID()}`;
const deviceResponse = await fetch(`${base}/api/access/device`, { headers: { "cf-connecting-ip": ip } });
assert.equal(deviceResponse.status, 200);
const deviceCookie = deviceResponse.headers.get("set-cookie")?.split(";")[0];
assert.match(deviceCookie || "", /__Host-blontix_device=/);
const phaseOne = await fetch(`${base}/api/access/login`, {
  method: "POST", headers: { "content-type": "application/json", cookie: deviceCookie, "cf-connecting-ip": ip },
  body: JSON.stringify({ password }),
});
assert.equal(phaseOne.status, 200, "new password must pass first stage");
const preAuth = phaseOne.headers.get("set-cookie") || "";
assert.match(preAuth, /HttpOnly/);
assert.match(preAuth, /Secure/);
assert.match(preAuth, /SameSite=Strict/);
assert.match(preAuth, /Max-Age=300/);
const preAuthCookie = preAuth.split(";")[0];
assert.equal((await fetch(`${base}/api/documents`, { headers: { cookie: `${deviceCookie}; ${preAuthCookie}` } })).status, 401, "password alone must not grant access");
const phaseTwo = await fetch(`${base}/api/access/email`, {
  method: "POST", headers: { "content-type": "application/json", cookie: `${deviceCookie}; ${preAuthCookie}`, "cf-connecting-ip": ip },
  body: JSON.stringify({ email: "blontix.official@gmail.com" }),
});
assert.equal(phaseTwo.status, 200, "admin email must pass second stage");
assert.equal(phaseTwo.headers.getSetCookie().length,0,'email must not issue a session');
const phaseThree = await fetch(`${base}/api/access/2fa`, {
  method: 'POST', headers: {'content-type':'application/json',cookie:`${deviceCookie}; ${preAuthCookie}`,'cf-connecting-ip':ip},
  body: JSON.stringify({code:totpAtStep(process.env.AUTH_TOTP_SECRET,Math.floor(Date.now()/30000))}),
});
assert.equal(phaseThree.status,200,'authenticator code must pass third stage');
const sessionCookie = phaseThree.headers.getSetCookie().find((value) => value.startsWith("__Host-blontix_session="));
assert.match(sessionCookie || "", /Max-Age=86400/);
const auth = { cookie: `${deviceCookie}; ${sessionCookie.split(";")[0]}`, "cf-connecting-ip": ip };
console.log("QA: three-stage login passed.");

const bannedIp = `qa-banned-${randomUUID()}`;
const bannedDeviceResponse = await fetch(`${base}/api/access/device`, { headers: { "cf-connecting-ip": bannedIp } });
assert.equal(bannedDeviceResponse.status, 200);
const bannedDevice = bannedDeviceResponse.headers.get("set-cookie")?.split(";")[0];
for (let attempt = 1; attempt <= 3; attempt++) {
  const response = await fetch(`${base}/api/access/login`, {
    method: "POST", headers: { "content-type": "application/json", cookie: bannedDevice, "cf-connecting-ip": bannedIp },
    body: JSON.stringify({ password: "intentionally-wrong-password" }),
  });
  assert.equal(response.status, attempt === 3 ? 403 : 401, `attempt ${attempt}: ${await response.text()}`);
}
assert.equal((await fetch(`${base}/api/access/login`, {
  method: "POST", headers: { "content-type": "application/json", cookie: bannedDevice, "cf-connecting-ip": bannedIp }, body: JSON.stringify({ password }),
})).status, 403, "banned browser cannot sign in with valid password");
console.log("QA: three-failure browser ban passed.");

const mixedIp = `qa-mixed-${randomUUID()}`;
const mixedDeviceResponse = await fetch(`${base}/api/access/device`, { headers: { "cf-connecting-ip": mixedIp } });
assert.equal(mixedDeviceResponse.status, 200);
const mixedDevice = mixedDeviceResponse.headers.get("set-cookie")?.split(";")[0];
const mixedHeaders = { "content-type": "application/json", cookie: mixedDevice, "cf-connecting-ip": mixedIp };
const mixedWrong = await fetch(`${base}/api/access/login`, { method: "POST", headers: mixedHeaders, body: JSON.stringify({ password: "wrong" }) });
assert.equal(mixedWrong.status, 401, `mixed password failure: ${await mixedWrong.text()}`);
const mixedPassword = await fetch(`${base}/api/access/login`, { method: "POST", headers: mixedHeaders, body: JSON.stringify({ password }) });
assert.equal(mixedPassword.status, 200);
const mixedPreAuth = mixedPassword.headers.get("set-cookie")?.split(";")[0];
for (let attempt = 2; attempt <= 3; attempt++) {
  const response = await fetch(`${base}/api/access/email`, {
    method: "POST", headers: { ...mixedHeaders, cookie: `${mixedDevice}; ${mixedPreAuth}` }, body: JSON.stringify({ email: "wrong@example.com" }),
  });
  assert.equal(response.status, attempt === 3 ? 403 : 401, "password and email failures must share the three-attempt limit");
}
assert.equal((await fetch(`${base}/api/access/email`, {
  method: "POST", headers: { ...mixedHeaders, cookie: `${mixedDevice}; ${mixedPreAuth}` }, body: JSON.stringify({ email: "blontix.official@gmail.com" }),
})).status, 403, "banned browser cannot complete second stage");
console.log("QA: combined password/email failures passed.");

const orderNumber = `QA_BLONTIX_${Date.now()}`;
const logo = readFileSync(resolve("public/blontix-logo-v1.png"));
const createdAt = new Date();
const deliveredAt = new Date(createdAt.getTime() + 60_000);
const customerPhone = "0551234821";

async function createDocument(reason = "") {
  const form = new FormData();
  const fields = {
    idempotencyKey: randomUUID(), orderNumber, customerName: "عميل اختبار", customerPhone,
    productName: "منتج رقمي للاختبار", price: "24.99", orderApprovedAt: createdAt.toISOString(),
    deliveredAt: deliveredAt.toISOString(), deliveryMethod: "واتساب", termsVersion: "QA-V1",
    productDescriptionText: "صورة اختبار؛ ليست بيانات عميل حقيقية.", reissueReason: reason,
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set("image", new Blob([logo], { type: "image/png" }), "qa-description.png");
  const response = await fetch(`${base}/api/documents`, { method: "POST", headers: auth, body: form });
  const result = await response.json();
  assert.equal(response.status, 201, `create failed: ${result.error || "unknown"}`);
  return result.document;
}

async function publicVerification(document) {
  const response = await fetch(document.verificationUrl.replace("/verify/", "/api/verify/"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.documentReference, document.documentReference);
  assert.equal(data.documentVersion, document.documentVersion);
  assert.equal(data.customerName, undefined);
  assert.equal(data.customerPhone, undefined);
  assert.equal(data.maskedPhone, undefined);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  return data;
}

const v1 = await createDocument();
console.log("QA: V1 PDF created.");
assert.match(v1.documentReference, /^bl-ORD-.*-V1$/);
const search = await fetch(`${base}/api/documents?reference=${encodeURIComponent(v1.documentReference.slice(0, -2))}`, { headers: auth });
assert.equal(search.status, 200);
assert.ok((await search.json()).documents.some((document) => document.id === v1.id), "reference search must return document");
const snapshotResponse = await fetch(`${base}/api/documents/${v1.id}`, { headers: auth });
assert.equal(snapshotResponse.status, 200);
const snapshot = await snapshotResponse.json();
assert.equal(snapshot.snapshot.customerPhone, customerPhone);
assert.equal(snapshot.snapshot.logoAssetId, "blontix-logo-v1");
const pdfResponse = await fetch(`${base}/api/documents/${v1.id}/pdf?download=1`, { headers: auth });
assert.equal(pdfResponse.status, 200);
assert.match(pdfResponse.headers.get("content-disposition") || "", new RegExp(`${v1.documentReference}\\.pdf`));
const pdf = new Uint8Array(await pdfResponse.arrayBuffer());
assert.equal(createHash("sha256").update(pdf).digest("hex"), v1.pdfSha256);
assert.equal(String.fromCharCode(...pdf.slice(0, 4)), "%PDF");
mkdirSync(resolve("tmp"), { recursive: true });
writeFileSync(resolve("tmp/qa-blontix-v1.pdf"), pdf);
const v1Public = await publicVerification(v1);
assert.equal(v1Public.status, "original");
const masterResponse = await fetch(v1.verificationUrl.replace("/verify/", "/api/verify/") + "/master");
assert.equal(masterResponse.status, 200);
assert.match(masterResponse.headers.get("content-disposition") || "", new RegExp(`${v1.documentReference}\\.pdf`));
assert.equal(createHash("sha256").update(new Uint8Array(await masterResponse.arrayBuffer())).digest("hex"), v1.pdfSha256);

async function compareFile(bytes, expected) {
  const form = new FormData();
  form.set("file", new Blob([bytes], { type: "application/pdf" }), "check.pdf");
  const response = await fetch(`${v1.verificationUrl.replace("/verify/", "/api/verify/")}/file`, { method: "POST", body: form });
  const data = await response.json();
  assert.equal(data.result, expected, `file comparison failed: ${JSON.stringify(data)}`);
}
await compareFile(pdf, "match");
const changed = pdf.slice(); changed[changed.length - 30] ^= 1;
await compareFile(changed, "mismatch");

const v2 = await createDocument("تصحيح تجريبي");
assert.equal(v2.documentVersion, 2);
assert.equal((await publicVerification(v1)).status, "superseded");
assert.equal((await publicVerification(v2)).status, "original");
const cancel = await fetch(`${base}/api/documents/${v2.id}/cancel`, { method: "POST", headers: auth });
assert.equal(cancel.status, 200);
assert.equal((await publicVerification(v2)).status, "cancelled");
const invalid = await fetch(`${base}/api/verify/${"x".repeat(43)}`);
assert.equal(invalid.status, 404);
const logout = await fetch(`${base}/api/access/logout`, { method: "POST", headers: auth });
assert.equal(logout.status, 200);
assert.equal((await fetch(`${base}/api/documents`, { headers: auth })).status, 401);

console.log(JSON.stringify({ result: "pass", cases: ["two-stage login", "password-only denied", "secure cookies", "three-failure browser ban", "combined password/email attempt count", "bl reference", "reference search", "reference PDF filename", "V1 final", "snapshot full phone", "stored PDF SHA-256", "public verification privacy", "public Master download", "PDF match", "PDF tamper mismatch", "V2 supersedes V1", "cancelled", "invalid token", "logout revocation"], qaPdf: resolve("tmp/qa-blontix-v1.pdf") }));
