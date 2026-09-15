import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:5174";
const password = process.env.QA_PASSWORD;
if (!password) throw new Error("QA_PASSWORD must be provided in the process environment.");

const login = await fetch(`${base}/api/access/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ password }),
});
assert.equal(login.status, 200, "new password must sign in");
const setCookie = login.headers.get("set-cookie") || "";
assert.match(setCookie, /HttpOnly/);
assert.match(setCookie, /Secure/);
assert.match(setCookie, /SameSite=Strict/);
assert.match(setCookie, /Max-Age=43200/);
const cookie = setCookie.split(";")[0];
const auth = { cookie };

const orderNumber = `QA-BLONTIX-${Date.now()}`;
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
const snapshotResponse = await fetch(`${base}/api/documents/${v1.id}`, { headers: auth });
assert.equal(snapshotResponse.status, 200);
const snapshot = await snapshotResponse.json();
assert.equal(snapshot.snapshot.customerPhone, customerPhone);
assert.equal(snapshot.snapshot.logoAssetId, "blontix-logo-v1");
const pdfResponse = await fetch(`${base}/api/documents/${v1.id}/pdf?download=1`, { headers: auth });
assert.equal(pdfResponse.status, 200);
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

console.log(JSON.stringify({ result: "pass", cases: ["argon2id login", "secure cookie", "V1 final", "snapshot full phone", "stored PDF SHA-256", "public verification privacy", "public Master download", "PDF match", "PDF tamper mismatch", "V2 supersedes V1", "cancelled", "invalid token", "logout revocation"], qaPdf: resolve("tmp/qa-blontix-v1.pdf") }));
