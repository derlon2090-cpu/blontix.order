import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { decodeKey, validateEnvironment } from './environment.mjs';
export function encryptData(value: string, context: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', decodeKey(validateEnvironment().DATA_ENCRYPTION_KEY, 'DATA_ENCRYPTION_KEY'), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['enc', 'v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':');
}
export function decryptData(value: string, context: string) {
  const [marker, version, nonce, tag, ciphertext, extra] = value.split(':');
  if (marker !== 'enc' || version !== 'v1' || extra !== undefined || !nonce || !tag || !ciphertext) throw new Error('Encrypted data invalid');
  try {
    const decipher = createDecipheriv('aes-256-gcm', decodeKey(validateEnvironment().DATA_ENCRYPTION_KEY, 'DATA_ENCRYPTION_KEY'), Buffer.from(nonce, 'base64url'));
    decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch { throw new Error('Encrypted data integrity failed'); }
}
