import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getPool, getStorage, closeProviders, startupCheck } from '../lib/providers.mjs';
// Explicit maintenance command. Never delete active, final, or referenced objects.
try {
  await startupCheck();
  const client=await getPool().connect();
  let cleaned=0;
  try {
    const jobs=await client.query("SELECT id FROM document_generation_jobs WHERE status='generation_failed' AND updated_at < $1 ORDER BY updated_at LIMIT 100",[new Date(Date.now()-3600000).toISOString()]);
    for(const job of jobs.rows){
      await client.query('BEGIN');
      try {
        const result=await client.query("SELECT object_keys FROM document_generation_jobs WHERE id=$1 AND status='generation_failed' FOR UPDATE",[job.id]);
        if(!result.rows[0]){await client.query('ROLLBACK');continue;}
        const keys=result.rows[0].object_keys;
        if(!Array.isArray(keys)||keys.some(key=>typeof key!=='string'||!key.startsWith('order-documents/')||!key.includes('/'+job.id+'/')||key.split('/').includes('..'))) throw new Error('Invalid generation job');
        for(const key of keys){
          const referenced=await client.query('SELECT 1 FROM document_assets WHERE object_key=$1 LIMIT 1',[key]);
          if(referenced.rowCount) throw new Error('Referenced generation asset');
        }
        for(const key of keys) await getStorage().send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key}),{abortSignal:AbortSignal.timeout(10000)});
        await client.query("UPDATE document_generation_jobs SET status='cleaned',updated_at=$1 WHERE id=$2",[new Date().toISOString(),job.id]);
        await client.query('COMMIT');cleaned++;
      }catch{await client.query('ROLLBACK').catch(()=>undefined);throw new Error('Generation cleanup failed');}
    }
  }finally{client.release();}
  console.log(`Failed generation jobs cleaned: ${cleaned}`);
}catch{console.error('Generation cleanup failed; no final objects are eligible for cleanup');process.exitCode=1;}
finally{await closeProviders();}
