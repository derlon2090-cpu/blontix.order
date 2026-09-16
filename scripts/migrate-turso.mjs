import nextEnv from '@next/env';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.TURSO_DATABASE_URL) throw new Error('Set TURSO_DATABASE_URL before migrating.');
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
  console.log('Turso schema migrations completed.');
} finally { client.close(); }
