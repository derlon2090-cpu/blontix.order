import nextEnv from '@next/env';
import { spawn, spawnSync } from 'node:child_process';
import { startupCheck, closeProviders } from '../lib/providers.mjs';
const suppliedEnvironment={...process.env};
if(process.env.NODE_ENV!=='production') nextEnv.loadEnvConfig(process.cwd());
Object.assign(process.env,suppliedEnvironment);
try {
  const port=process.env.PORT || (process.env.NODE_ENV==='production' || process.env.RENDER==='true' ? '' : '3000');
  if(!/^\d+$/.test(port) || Number(port)<1 || Number(port)>65535) throw new Error('Invalid environment variable: PORT');
  await startupCheck();
  await closeProviders();
  const migrations=spawnSync(process.execPath,['scripts/migrate-postgres.mjs'],{stdio:'inherit',env:process.env});
  if(migrations.error || migrations.status!==0) process.exit(1);
  console.log('Starting Next.js Node server on 0.0.0.0 using PORT');
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',port],{stdio:'inherit',env:process.env});
  server.on('error',()=>{console.error('Next.js process failed to start');process.exit(1);});
  for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.kill(signal));
  server.on('exit',code=>process.exit(code ?? 1));
} catch(error) {
  const message=error instanceof Error ? error.message : '';
  console.error(/^(Missing required environment variable:|Invalid environment variable:|Database connection failed|Storage connection failed)/.test(message) ? message : 'Production startup failed');
  await closeProviders(); process.exitCode=1;
}
