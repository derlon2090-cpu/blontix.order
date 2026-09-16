import pg from 'pg';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { validateEnvironment } from './environment.mjs';
let pool;
let storage;
export function getPool() {
  const env = validateEnvironment();
  if (!pool) {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 8, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 30000 });
    pool.on('error', () => console.error('Database connection failed'));
  }
  return pool;
}
export function getStorage() {
  const env = validateEnvironment();
  return storage ??= new S3Client({ region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY }, maxAttempts: 2, requestHandler: { connectionTimeout: 10000, requestTimeout: 30000 } });
}
export async function healthCheck() {
  validateEnvironment();
  const checks = await Promise.allSettled([getPool().query('SELECT 1'), getStorage().send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }), { abortSignal: AbortSignal.timeout(10000) })]);
  return { status: checks.every(check => check.status === 'fulfilled') ? 'ok' : 'unavailable', database: checks[0].status === 'fulfilled' ? 'connected' : 'unavailable', storage: checks[1].status === 'fulfilled' ? 'connected' : 'unavailable' };
}
export async function startupCheck() {
  const health = await healthCheck();
  if (health.database !== 'connected') throw new Error('Database connection failed');
  if (health.storage !== 'connected') throw new Error('Storage connection failed');
}
export async function closeProviders() { if (pool) { await pool.end(); pool = undefined; } if (storage) { storage.destroy(); storage = undefined; } }
