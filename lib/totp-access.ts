import 'server-only';
import {createHash} from 'node:crypto';
import {env} from './runtime';
import {createDocumentSession, loginSubjectHash, recordAccessFailure} from './access';
import {decodeTotpSecret, matchingTotpStep} from './totp';

export async function verifyTotpLogin(request: Request, challenge: {tokenHash: string; deviceHash: string}, code: string) {
  const secret = process.env.AUTH_TOTP_SECRET ?? '';
  const keyId = createHash('sha256').update(decodeTotpSecret(secret)).digest('hex');
  return env.DB.transaction(async db => {
    const device = await db.prepare('SELECT banned_at FROM access_devices WHERE device_token_hash = ? FOR UPDATE').bind(challenge.deviceHash).first<{banned_at: string | null}>();
    if (!device || device.banned_at) return {result: 'blocked'};
    const now = new Date().toISOString();
    const active = await db.prepare('SELECT token_hash FROM access_login_challenges WHERE token_hash = ? AND device_hash = ? AND email_verified_at IS NOT NULL AND consumed_at IS NULL AND expires_at > ? FOR UPDATE').bind(challenge.tokenHash, challenge.deviceHash, now).first();
    if (!active) return {result: 'expired'};
    const step = matchingTotpStep(secret, code);
    if (step === null) return {result: await recordAccessFailure(request, challenge.deviceHash, db) ? 'blocked' : 'invalid'};
    await db.prepare("INSERT INTO access_totp_state (key_id, last_step) VALUES (?, '-1') ON CONFLICT(key_id) DO NOTHING").bind(keyId).run();
    const state = await db.prepare('SELECT last_step FROM access_totp_state WHERE key_id = ? FOR UPDATE').bind(keyId).first<{last_step: string}>();
    if (!state || step <= Number(state.last_step)) return {result: 'replayed'};
    await db.prepare('UPDATE access_totp_state SET last_step = ? WHERE key_id = ?').bind(String(step), keyId).run();
    await db.prepare('UPDATE access_login_challenges SET consumed_at = ? WHERE token_hash = ?').bind(now, challenge.tokenHash).run();
    const cookie = await createDocumentSession(challenge.deviceHash, db);
    await db.prepare('UPDATE access_devices SET failed_count = 0, last_seen_at = ? WHERE device_token_hash = ? AND banned_at IS NULL').bind(now, challenge.deviceHash).run();
    await db.prepare('DELETE FROM access_login_attempts WHERE subject_hash = ?').bind(await loginSubjectHash(request)).run();
    return {result: 'verified', cookie};
  });
}
