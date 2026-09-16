import {createHmac, timingSafeEqual} from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function encodeTotpSecret(bytes: Uint8Array) {
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; result += alphabet[(value >>> bits) & 31]; }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
export function decodeTotpSecret(secret: string) {
  if (!/^[A-Z2-7]{32,104}$/.test(secret)) throw new Error('TOTP_NOT_CONFIGURED');
  let bits = 0, value = 0;
  const bytes: number[] = [];
  for (const character of secret) {
    value = (value << 5) | alphabet.indexOf(character); bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  const decoded = Buffer.from(bytes);
  if (decoded.length < 20 || encodeTotpSecret(decoded) !== secret) throw new Error('TOTP_NOT_CONFIGURED');
  return decoded;
}
export function totpAtStep(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeTotpSecret(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}
export function matchingTotpStep(secret: string, code: string, now = Date.now()) {
  decodeTotpSecret(secret);
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    if (step >= 0 && timingSafeEqual(Buffer.from(totpAtStep(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}
