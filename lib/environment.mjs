const required = ['DATABASE_URL', 'DOCUMENTS_ACCESS_PASSWORD_HASH', 'SESSION_SECRET', 'DATA_ENCRYPTION_KEY', 'AUDIT_HMAC_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
export function decodeKey(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) throw new Error(`Invalid environment variable: ${name}`);
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < 32 || (name !== 'SESSION_SECRET' && bytes.length !== 32)) throw new Error(`Invalid environment variable: ${name}`);
  return bytes;
}
export function validateEnvironment() {
  for (const name of required) if (!process.env[name]?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  let url;
  try { url = new URL(process.env.DATABASE_URL); } catch { throw new Error('Invalid environment variable: DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
  const keys = ['SESSION_SECRET', 'DATA_ENCRYPTION_KEY', 'AUDIT_HMAC_KEY'].map(name => decodeKey(process.env[name], name));
  if (new Set(keys.map(key => key.toString('hex'))).size !== keys.length) throw new Error('Environment keys must be independent');
  const hashParts=process.env.DOCUMENTS_ACCESS_PASSWORD_HASH.split('$');
  const costs=Object.fromEntries((hashParts[3] || '').split(',').map(part=>part.split('=')));
  if(hashParts.length!==6 || hashParts[1]!=='argon2id' || hashParts[2]!=='v=19' || Object.keys(costs).sort().join(',')!=='m,p,t' || !Object.values(costs).every(value=>/^\d+$/.test(value)) || Number(costs.m)<19456 || Number(costs.m)>262144 || Number(costs.t)<2 || Number(costs.t)>10 || Number(costs.p)<1 || Number(costs.p)>8 || !hashParts.slice(4).every(value=>/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) || Buffer.from(hashParts[4],'base64url').length<16 || Buffer.from(hashParts[5],'base64url').length<32) throw new Error('Invalid environment variable: DOCUMENTS_ACCESS_PASSWORD_HASH');
  if (!/^[a-f0-9]{32}$/i.test(process.env.R2_ACCOUNT_ID)) throw new Error('Invalid environment variable: R2_ACCOUNT_ID');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(process.env.R2_BUCKET_NAME)) throw new Error('Invalid environment variable: R2_BUCKET_NAME');
  return process.env;
}
