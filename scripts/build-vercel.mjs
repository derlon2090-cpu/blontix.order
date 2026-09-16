import { spawnSync } from 'node:child_process';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
if (process.env.VERCEL === '1' && (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)) {
  throw new Error('Connect Turso to this Vercel environment before deployment.');
}
for (const args of [
  ...(process.env.TURSO_DATABASE_URL ? [['scripts/migrate-turso.mjs']] : []),
  ['node_modules/next/dist/bin/next', 'build', '--webpack'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
