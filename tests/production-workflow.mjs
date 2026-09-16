import assert from 'node:assert/strict';
import pg from 'pg';
import argon2 from 'argon2';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

// Only newly created isolated PostgreSQL schemas are used; never modify existing tables.
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
await admin.connect();
const databaseName = 'blontix_qa_' + randomUUID().replaceAll('-', '');
assert.match(databaseName, /^blontix_qa_[a-f0-9]{32}$/);
await admin.query(`CREATE SCHEMA "${databaseName}"`);
await admin.end();
const url = new URL(process.env.DATABASE_URL); url.searchParams.set('options', '-c search_path=' + databaseName);
const password = randomBytes(32).toString('base64url');
const env = { ...process.env, DATABASE_URL: url.href, DATABASE_MIGRATIONS_SCHEMA: databaseName, DOCUMENTS_ACCESS_PASSWORD_HASH: await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }), SESSION_SECRET: randomBytes(32).toString('base64url'), DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64url'), AUDIT_HMAC_KEY: randomBytes(32).toString('base64url'), R2_ACCOUNT_ID: randomBytes(16).toString('hex'), R2_ACCESS_KEY_ID: 'isolated-qa-access', R2_SECRET_ACCESS_KEY: randomBytes(32).toString('hex'), R2_BUCKET_NAME: 'isolated-qa-bucket', BLONTIX_ISOLATED_QA: '1', NODE_ENV: 'production', __NEXT_PROCESSED_ENV: 'true', QA_PASSWORD: password, QA_BASE_URL: 'http://127.0.0.1:5174', NODE_OPTIONS: '--import ./tests/support/register.mjs', QA_S3_SDK_ENTRY: createRequire(import.meta.url).resolve('@aws-sdk/client-s3'), NEXT_TELEMETRY_DISABLED: '1' };
const objects = new Map(); let failUploads = false; let failBucket = false;
const storage = createServer(async (req, res) => {
  const key = decodeURIComponent(new URL(req.url, 'http://qa').pathname).replace(/^\//, '').replace(new RegExp('^' + env.R2_BUCKET_NAME + '/?'), '');
  if (!key && req.method === 'HEAD') { res.writeHead(failBucket ? 503 : 200); res.end(); return; }
  if (req.method === 'PUT') {
    if (failUploads || objects.has(key)) { res.writeHead(failUploads ? 503 : 412); res.end(); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks); objects.set(key, { bytes, type: req.headers['content-type'] });
    res.writeHead(200, { ETag: '"' + createHash('md5').update(bytes).digest('hex') + '"' }); res.end(); return;
  }
  if (req.method === 'DELETE') { objects.delete(key); res.writeHead(204); res.end(); return; }
  const object = objects.get(key);
  if (!object) { res.writeHead(404, { 'content-type': 'application/xml' }); res.end('<Error><Code>NoSuchKey</Code></Error>'); return; }
  res.writeHead(200, { 'content-type': object.type || 'application/octet-stream', 'content-length': object.bytes.length });
  res.end(req.method === 'HEAD' ? undefined : object.bytes);
});
await new Promise(done => storage.listen(0, '127.0.0.1', done));
env.QA_S3_PORT = String(storage.address().port);
const db = new pg.Client({ connectionString: env.DATABASE_URL }); await db.connect();
let server;
async function command(args, overrides={}, expectedCode=0) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { env: {...env,...overrides}, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
    child.on('error', reject); child.on('exit', code => code === expectedCode ? done(output) : reject(new Error(output.slice(-3000))));
  });
}
async function start() {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '5174', '--hostname', '127.0.0.1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; server.stdout.on('data', b => { output += b; }); server.stderr.on('data', b => { output += b; });
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error(output.slice(-3000));
    try { const r = await fetch(env.QA_BASE_URL + '/api/health', { signal: AbortSignal.timeout(2000) }); if (r.status === 200) return; } catch {}
    await new Promise(done => setTimeout(done, 1000));
  }
  throw new Error('QA server failed to become healthy: ' + output.slice(-2000));
}
async function stop() { if (server && server.exitCode === null) { const exited = new Promise(done => server.once('exit', done)); server.kill(); await exited; } }
try {
  await command(['scripts/migrate-postgres.mjs']); await command(['scripts/migrate-postgres.mjs']);
  assert.equal(Number((await db.query('SELECT count(*) FROM ' + databaseName + '.__drizzle_migrations')).rows[0].count), 3);
  console.log('PASS: real PostgreSQL migrations, repeatable without duplicate execution.');
  assert.match(await command(['scripts/start-production.mjs'],{DATABASE_URL:'postgresql://isolated:isolated@127.0.0.1:1/isolated'},1),/Database connection failed/);
  failBucket=true;
  assert.match(await command(['scripts/start-production.mjs'],{},1),/Storage connection failed/);
  failBucket=false;
  console.log('PASS: unavailable PostgreSQL or S3 prevents production startup.');
  await start(); console.log(await command(['scripts/qa-document-workflow.mjs']));
  const row = (await db.query('SELECT * FROM order_documents WHERE document_version=1 ORDER BY created_at DESC LIMIT 1')).rows[0];
  assert.ok(row); for (const field of ['customer_phone', 'snapshot_json', 'verification_token']) assert.match(row[field], /^enc:v1:/);
  const assets = (await db.query('SELECT * FROM document_assets WHERE document_id=$1', [row.id])).rows;
  assert.equal(assets.length, 4);
  for (const asset of assets) { const obj = objects.get(asset.object_key); assert.ok(obj); assert.equal(obj.bytes.length, asset.file_size); assert.equal(createHash('sha256').update(obj.bytes).digest('hex'), asset.sha256); }
  console.log('PASS: real PostgreSQL records, encrypted sensitive fields, four verified S3 assets.');
  // Database enforces immutable final records independently of API code.
  await assert.rejects(db.query('UPDATE order_documents SET customer_name=$1 WHERE id=$2', ['tampered', row.id]), /immutable/);
  await assert.rejects(db.query('DELETE FROM order_documents WHERE id=$1', [row.id]), /Final documents/);
  async function login() {
    const r = await fetch(env.QA_BASE_URL + '/api/access/device'); const device = r.headers.getSetCookie()[0].split(';')[0];
    const p = await fetch(env.QA_BASE_URL + '/api/access/login', { method: 'POST', headers: { cookie: device, 'content-type': 'application/json' }, body: JSON.stringify({ password }) }); assert.equal(p.status, 200);
    const e = await fetch(env.QA_BASE_URL + '/api/access/email', { method: 'POST', headers: { cookie: device + '; ' + p.headers.getSetCookie()[0].split(';')[0], 'content-type': 'application/json' }, body: JSON.stringify({ email: 'blontix.official@gmail.com' }) }); assert.equal(e.status, 200);
    return { cookie: device + '; ' + e.headers.getSetCookie().find(v => v.startsWith('__Host-blontix_session=')).split(';')[0] };
  }
  const auth = await login();
  async function persistence() {
    const list = await fetch(env.QA_BASE_URL + '/api/documents', { headers: auth }); assert.equal(list.status, 200);
    const document = (await list.json()).documents.find(d => d.id === row.id); assert.ok(document);
    const master = await fetch(document.verificationUrl.replace('/verify/', '/api/verify/') + '/master'); assert.equal(master.status, 200);
    assert.equal(createHash('sha256').update(Buffer.from(await master.arrayBuffer())).digest('hex'), row.pdf_sha256);
    assert.equal((await fetch(document.verificationUrl)).status, 200);
  }
  await persistence(); await stop(); await start(); await persistence();
  console.log('PASS: document, QR and identical Master PDF survive backend restart.');
  const auditUrl = env.QA_BASE_URL + `/api/documents/${row.id}/audit`;
  let audit = await fetch(auditUrl, { headers: auth }); assert.equal(audit.status, 200); assert.equal((await audit.json()).integrity.valid, true);
  const event = (await db.query('SELECT * FROM document_audit_logs WHERE document_id=$1 ORDER BY sequence LIMIT 1', [row.id])).rows[0];
  await db.query('UPDATE document_audit_logs SET result=$1 WHERE id=$2', ['tampered', event.id]);
  assert.equal((await fetch(auditUrl, { headers: auth })).status, 409);
  await db.query('UPDATE document_audit_logs SET result=$1 WHERE id=$2', [event.result, event.id]);
  assert.equal((await fetch(auditUrl, { headers: auth })).status, 200);
  console.log('PASS: audit HMAC detects committed database tampering; immutable final trigger works.');
  async function create(orderNumber) {
    const form=new FormData();
    const fields={idempotencyKey:randomUUID(),orderNumber,customerName:'QA only',customerPhone:'0551234821',productName:'QA product',price:'24.99',orderApprovedAt:new Date().toISOString(),deliveredAt:new Date(Date.now()+60000).toISOString(),deliveryMethod:'واتساب',termsVersion:'QA',productDescriptionText:'QA'};
    for(const [key,value] of Object.entries(fields)) form.set(key,value);
    form.set('image',new Blob([readFileSync(resolve('public/blontix-logo-v1.png'))],{type:'image/png'}),'qa.png');
    return fetch(env.QA_BASE_URL+'/api/documents',{method:'POST',headers:auth,body:form});
  }
  const beforeCount=Number((await db.query('SELECT count(*) FROM order_documents')).rows[0].count);
  const beforeObjects=objects.size;
  failUploads=true; const failure=await create('QA_UPLOAD_FAIL_'+Date.now()); assert.ok(failure.status>=400); failUploads=false;
  assert.equal(Number((await db.query('SELECT count(*) FROM order_documents')).rows[0].count),beforeCount); assert.equal(objects.size,beforeObjects);
  assert.ok(Number((await db.query("SELECT count(*) FROM document_generation_jobs WHERE status='generation_failed'")).rows[0].count)>0);
  const collision='QA_COLLISION_'+Date.now(); assert.equal((await create(collision)).status,201);
  const committedObjects=objects.size;
  const collisionFailure=await create(collision+'!'); assert.ok(collisionFailure.status>=400);
  assert.equal(Number((await db.query('SELECT count(*) FROM order_documents')).rows[0].count),beforeCount+1); assert.equal(objects.size,committedObjects);
  console.log('PASS: failed S3 upload and PostgreSQL uniqueness failure leave no final record or untracked master.');
  const failedJob=(await db.query("SELECT * FROM document_generation_jobs WHERE status='generation_failed' LIMIT 1")).rows[0];
  objects.set(failedJob.object_keys[0],{bytes:Buffer.from('test-only unacknowledged upload'),type:'application/octet-stream'});
  await db.query("UPDATE document_generation_jobs SET updated_at=$1 WHERE status='generation_failed'",[new Date(Date.now()-7200000).toISOString()]);
  await command(['scripts/cleanup-failed-generations.mjs']);
  assert.equal(objects.size,committedObjects);
  assert.equal(Number((await db.query("SELECT count(*) FROM document_generation_jobs WHERE status='generation_failed'")).rows[0].count),0);
  console.log('PASS: explicit failed-job cleanup removes unacknowledged uploads and preserves final assets.');
  const report = { database: 'real isolated PostgreSQL', storage: 'test-only S3 transport with real AWS SDK; NOT live R2', migrations: true, workflow: true, encryption: true, auditTamperDetection: true, restartPersistence: true };
  mkdirSync(resolve('tmp'), { recursive: true }); writeFileSync(resolve('tmp/postgres-workflow-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await stop();
  // The name is generated and checked above; only this run's isolated schema is removed.
  await db.query(`DROP SCHEMA "${databaseName}" CASCADE`);
  await db.end(); await new Promise(done => storage.close(done));
}
