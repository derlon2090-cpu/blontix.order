import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { auditHash } from '@/lib/security';
import type { Database } from '@/lib/runtime';
type Event = { id: string; document_id: string; sequence: number; event_type: string; result: string; actor_id: string | null; previous_hash: string; event_hash: string; created_at: string };
export async function verifyDocumentAudit(db: Database, documentId: string) {
  const document = await db.prepare('SELECT audit_head_hash, audit_event_count FROM order_documents WHERE id = ?').bind(documentId).first<{audit_head_hash:string;audit_event_count:number}>();
  if (!document) throw new Error('Document not found');
  const events = (await db.prepare('SELECT * FROM document_audit_logs WHERE document_id = ? ORDER BY sequence').bind(documentId).all<Event>()).results;
  let previousHash = '';
  let valid = events.length === document.audit_event_count && events.length > 0;
  for (const [index,event] of events.entries()) {
    const expected = await auditHash({ eventId:event.id, documentId, eventType:event.event_type, result:event.result, actorId:event.actor_id, previousHash:event.previous_hash, createdAt:event.created_at, sequence:event.sequence });
    const actualBytes=Buffer.from(event.event_hash,'hex'), expectedBytes=Buffer.from(expected,'hex');
    if(event.sequence!==index+1 || event.previous_hash!==previousHash || actualBytes.length!==expectedBytes.length || !timingSafeEqual(actualBytes,expectedBytes)) valid=false;
    previousHash=event.event_hash;
  }
  return {valid:valid && previousHash===document.audit_head_hash, events};
}
export async function appendDocumentAudit(db: Database, documentId: string, eventType: string, result: string, actorId: string | null) {
  return db.transaction(async tx => {
    const document=await tx.prepare('SELECT audit_head_hash, audit_event_count FROM order_documents WHERE id = ? FOR UPDATE').bind(documentId).first<{audit_head_hash:string;audit_event_count:number}>();
    if(!document) throw new Error('Document not found');
    if(document.audit_event_count>0 && !(await verifyDocumentAudit(tx,documentId)).valid) throw new Error('Audit integrity failed');
    const sequence=document.audit_event_count+1, createdAt=new Date().toISOString(), previousHash=document.audit_head_hash;
    const eventId=crypto.randomUUID();
    const eventHash=await auditHash({eventId,documentId,eventType,result,actorId,previousHash,createdAt,sequence});
    await tx.prepare('INSERT INTO document_audit_logs (id,document_id,sequence,event_type,result,actor_id,previous_hash,event_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(eventId,documentId,sequence,eventType,result,actorId,previousHash,eventHash,createdAt).run();
    await tx.prepare('UPDATE order_documents SET audit_head_hash = ?, audit_event_count = ? WHERE id = ?').bind(eventHash,sequence,documentId).run();
  });
}
