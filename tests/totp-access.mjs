import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {encodeTotpSecret, decodeTotpSecret, totpAtStep, matchingTotpStep} from '../lib/totp.ts';
if (process.env.NODE_ENV !== 'test' || process.env.BLONTIX_ISOLATED_QA !== '1') throw new Error('Isolated QA only');
process.env.QA_S3_SDK_ENTRY = createRequire(import.meta.url).resolve(resolve('node_modules/@aws-sdk/client-s3'));
const {env} = await import('../lib/runtime.ts');
const {hmac, sessionIsValid} = await import('../lib/access.ts');
const {POST: email} = await import('../app/api/access/email/route.ts');
const {POST: twoFactor} = await import('../app/api/access/2fa/route.ts');
const {POST: password} = await import('../app/api/access/login/route.ts');
const argon2 = (await import('argon2')).default;
const referenceSecret = encodeTotpSecret(Buffer.from('12345678901234567890'));
for (const [time, expected] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']]) {
  assert.equal(totpAtStep(referenceSecret, Math.floor(time / 30)), expected);
  assert.equal(matchingTotpStep(referenceSecret, expected, time * 1000), Math.floor(time / 30));
}
assert.throws(() => decodeTotpSecret('bad-secret'));
assert.equal(matchingTotpStep(referenceSecret, '12345', 59000), null);
const secret = encodeTotpSecret(randomBytes(32));
assert.equal(decodeTotpSecret(secret).length, 32);
process.env.AUTH_TOTP_SECRET = secret;
Object.defineProperty(env, 'SESSION_SECRET', {get: () => Buffer.alloc(32, 1).toString('base64url')});
Object.defineProperty(env, 'DOCUMENTS_ACCESS_PASSWORD_HASH', {get: () => passwordHash});
const passwordHash = await argon2.hash('isolated-test-password', {type: argon2.argon2id});
let state;
let lock = Promise.resolve();
function reset() {state = {devices: {}, challenges: {}, sessions: {}, counters: {}, attempts: {}};}
reset();
const db = {
  prepare(sql) {return {bind(...args) {
    const execute = () => {
      const query = sql.replace(/\s+/g, ' ').trim();
      let rows = [], changes = 0;
      const [a,b,c,d,e] = args;
      if (query.startsWith('SELECT failed_count, banned_at FROM access_devices')) {const row=state.devices[a]; if(row)rows=[row];}
      else if (query.startsWith('SELECT banned_at FROM access_devices')) {const row=state.devices[a]; if(row)rows=[row];}
      else if (query.startsWith('SELECT locked_until FROM access_login_attempts') || query.startsWith('SELECT failed_count, updated_at FROM access_login_attempts')) {if(state.attempts[a])rows=[state.attempts[a]];}
      else if (query.startsWith('SELECT device_hash FROM access_login_challenges')) {const row=state.challenges[a]; if(row && !row.consumed_at && row.expires_at>b)rows=[row];}
      else if (query.startsWith('SELECT token_hash FROM access_login_challenges')) {const row=state.challenges[a]; if(row && row.device_hash===b && row.email_verified_at && !row.consumed_at && row.expires_at>c)rows=[row];}
      else if (query.startsWith('UPDATE access_login_challenges SET email_verified_at')) {const row=state.challenges[b]; if(row && !row.consumed_at && row.expires_at>c){row.email_verified_at=a;changes=1;}}
      else if (query.startsWith('UPDATE access_login_challenges SET consumed_at')) {state.challenges[b].consumed_at=a;changes=1;}
      else if (query.startsWith('UPDATE access_devices SET failed_count = failed_count + 1')) {const row=state.devices[c]; if(row && !row.banned_at){row.failed_count++; if(row.failed_count>=3)row.banned_at=a; changes=1;}}
      else if (query.startsWith('INSERT INTO access_login_attempts')) {state.attempts[a]={failed_count:b,locked_until:c,updated_at:d};changes=1;}
      else if (query.startsWith('INSERT INTO access_login_challenges')) {state.challenges[a]={token_hash:a,device_hash:b,created_at:c,expires_at:d,consumed_at:null,email_verified_at:null};changes=1;}
      else if (query.startsWith('INSERT INTO access_totp_state')) {if(!(a in state.counters))state.counters[a]='-1';changes=1;}
      else if (query.startsWith('SELECT last_step FROM access_totp_state')) {rows=[{last_step:state.counters[a]}];}
      else if (query.startsWith('UPDATE access_totp_state SET last_step')) {state.counters[b]=a;changes=1;}
      else if (query.startsWith('INSERT INTO access_sessions')) {state.sessions[a]={device_hash:b,created_at:c,expires_at:d,totp_verified_at:e};changes=1;}
      else if (query.startsWith('UPDATE access_devices SET failed_count = 0')) {state.devices[b].failed_count=0;changes=1;}
      else if (query.startsWith('DELETE FROM access_login_attempts')) {delete state.attempts[a];changes=1;}
      else if (query.startsWith('SELECT device_hash FROM access_sessions')) {const row=state.sessions[a]; if(row && row.totp_verified_at && !row.revoked_at && row.expires_at>b)rows=[row];}
      else throw new Error(`Unexpected isolated query: ${query}`);
      return {results:rows,meta:{changes}};
    };
    return {async run(){return execute();},async first(){return execute().results[0]??null;}};
  }};},
  async transaction(operation) {
    const previous=lock;let release;lock=new Promise(resolve=>{release=resolve;});await previous;
    const before=structuredClone(state);
    try{return await operation(db);}catch(error){state=before;throw error;}finally{release();}
  },
};
Object.defineProperty(env,'DB',{get:()=>db});
async function fixture(name) {
  const deviceToken=Buffer.from(name.padEnd(32,'d')).toString('base64url');
  const challengeToken=Buffer.from(name.padEnd(32,'c')).toString('base64url');
  const deviceHash=await hmac(`device:${deviceToken}`), tokenHash=await hmac(`preauth:${challengeToken}`);
  state.devices[deviceHash]={failed_count:0,banned_at:null};
  state.challenges[tokenHash]={token_hash:tokenHash,device_hash:deviceHash,expires_at:new Date(Date.now()+300000).toISOString(),email_verified_at:null,consumed_at:null};
  const cookie=`__Host-blontix_device=${deviceToken}; __Host-blontix_pre_auth=${challengeToken}`;
  return {cookie,deviceHash,tokenHash};
}
const request=(cookie,body)=>new Request('https://example.invalid/api/access',{method:'POST',headers:{cookie,'content-type':'application/json','x-forwarded-for':'192.0.2.1'},body:JSON.stringify(body)});
const code=()=>totpAtStep(secret,Math.floor(Date.now()/30000));
const person=await fixture('success');
assert.equal((await twoFactor(request(person.cookie,{code:code()}))).status,401,'cannot skip email');
const second=await email(request(person.cookie,{email:'blontix.official@gmail.com'}));
assert.equal((await second.json()).next,'/login/2fa');
assert.equal(second.headers.get('set-cookie'),null,'email cannot create a session');
const response=await twoFactor(request(person.cookie,{code:code()}));
assert.equal(response.status,200);
const session=response.headers.get('set-cookie').match(/__Host-blontix_session=([A-Za-z0-9_-]+)/)[1];
assert.match(response.headers.get('set-cookie'), /Max-Age=86400/);
const issuedSession=state.sessions[await hmac(`session:${session}`)];
assert.equal(Date.parse(issuedSession.expires_at)-Date.parse(issuedSession.created_at),24*60*60*1000);
assert.equal(await sessionIsValid(new Request('https://example.invalid',{headers:{cookie:`${person.cookie}; __Host-blontix_session=${session}`}})),true);
state.devices[person.deviceHash].banned_at=new Date().toISOString();
assert.equal(await sessionIsValid(new Request('https://example.invalid',{headers:{cookie:`${person.cookie}; __Host-blontix_session=${session}`}})),false,'banned device cannot use an existing session');
state.devices[person.deviceHash].banned_at=null;
const savedVerifiedAt=state.sessions[await hmac(`session:${session}`)].totp_verified_at;
state.sessions[await hmac(`session:${session}`)].totp_verified_at=null;
assert.equal(await sessionIsValid(new Request('https://example.invalid',{headers:{cookie:`${person.cookie}; __Host-blontix_session=${session}`}})),false,'legacy sessions cannot bypass the new factor');
state.sessions[await hmac(`session:${session}`)].totp_verified_at=savedVerifiedAt;
assert.equal((await twoFactor(request(person.cookie,{code:code()}))).status,401,'consumed challenge cannot create another session');
const replay=await fixture('replay');
await email(request(replay.cookie,{email:'blontix.official@gmail.com'}));
assert.match((await (await twoFactor(request(replay.cookie,{code:code()}))).json()).error,/مسبقًا/);
reset();
const blocked=await fixture('blocked');
assert.equal((await password(request(blocked.cookie,{password:'wrong'}))).status,401);
assert.equal((await email(request(blocked.cookie,{email:'wrong@example.invalid'}))).status,401);
await email(request(blocked.cookie,{email:'blontix.official@gmail.com'}));
assert.equal(state.devices[blocked.deviceHash].failed_count,2,'successful intermediate step must not reset failures');
const banned=await twoFactor(request(blocked.cookie,{code:'invalid'}));
assert.equal(banned.status,403);
assert.equal(state.devices[blocked.deviceHash].failed_count,3);
assert.equal((await password(request(blocked.cookie,{password:'isolated-test-password'}))).status,403);
assert.equal((await email(request(blocked.cookie,{email:'blontix.official@gmail.com'}))).status,403);
assert.equal((await twoFactor(request(blocked.cookie,{code:code()}))).status,403);
reset();
const concurrent=await fixture('concurrent');
await email(request(concurrent.cookie,{email:'blontix.official@gmail.com'}));
const parallel=await Promise.all([twoFactor(request(concurrent.cookie,{code:code()})),twoFactor(request(concurrent.cookie,{code:code()}))]);
assert.deepEqual(parallel.map(value=>value.status).sort(),[200,401]);
assert.equal(Object.keys(state.sessions).length,1);
reset();
const unavailable=await fixture('missing-config');
await email(request(unavailable.cookie,{email:'blontix.official@gmail.com'}));
delete process.env.AUTH_TOTP_SECRET;
assert.equal((await twoFactor(request(unavailable.cookie,{code:'123456'}))).status,503);
assert.equal(state.devices[unavailable.deviceHash].failed_count,0,'configuration failure is not an incorrect attempt');
assert.equal(Object.keys(state.sessions).length,0);
console.log('PASS RFC vectors, no step bypass, no session at email, TOTP session, replay rejection, mixed-step permanent ban, concurrent single-use, missing-config fail closed. In-memory fixtures only; no live providers.');
