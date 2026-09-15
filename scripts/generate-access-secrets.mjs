import { argon2id } from "@noble/hashes/argon2.js";
import { randomBytes } from "node:crypto";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
if (password.length < 20 || password.length > 256) throw new Error("Use a strong 20-256 character passphrase.");
const salt = randomBytes(16);
const derived = argon2id(password, salt, { m: 19456, t: 2, p: 1, dkLen: 32, maxmem: 48 * 1024 * 1024 });
const base64url = (value) => Buffer.from(value).toString("base64url");
process.stdout.write(JSON.stringify({
  hash: `$argon2id$v=19$m=19456,t=2,p=1$${base64url(salt)}$${base64url(derived)}`,
  sessionSecret: base64url(randomBytes(32)),
}));
