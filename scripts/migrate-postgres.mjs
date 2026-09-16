import nextEnv from '@next/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getPool, closeProviders } from '../lib/providers.mjs';
const suppliedEnvironment={...process.env};
if(process.env.NODE_ENV!=='production') nextEnv.loadEnvConfig(process.cwd());
Object.assign(process.env,suppliedEnvironment);
try {
  const pool=getPool();
  await pool.query('SELECT 1');
  // Serialize deployments using a dedicated session advisory lock.
  const client=await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(163492601)');
    const migrationsSchema=process.env.DATABASE_MIGRATIONS_SCHEMA || 'drizzle';
    if(!/^[a-z][a-z0-9_]{0,62}$/.test(migrationsSchema)) throw new Error('Invalid environment variable: DATABASE_MIGRATIONS_SCHEMA');
    await migrate(drizzle(client), {migrationsFolder:'drizzle-postgres',migrationsSchema});
    console.log('PostgreSQL migrations applied.');
  } finally { await client.query('SELECT pg_advisory_unlock(163492601)').catch(()=>undefined); client.release(); }
} catch(error) {
  const message=error instanceof Error ? error.message : '';
  console.error(message.startsWith('Missing required environment variable:') || message.startsWith('Invalid environment variable:') ? message : 'Database connection failed or migration failed');
  process.exitCode=1;
} finally {await closeProviders();}
