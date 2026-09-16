import { env } from '@/lib/runtime';
import { appendDocumentAudit } from '@/lib/audit';
import { secureToken } from '@/lib/security';
import { encryptData } from '@/lib/data-encryption';
import { sha256Hex } from '@/lib/order-document';
import { requireDocumentSession } from '@/lib/access';
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const actorId=await requireDocumentSession(request),{id}=await context.params,token=secureToken(32),hash=await sha256Hex(token);
    const found=await env.DB.transaction(async tx=>{
      const row=await tx.prepare('SELECT verification_token_hash FROM order_documents WHERE id = ? FOR UPDATE').bind(id).first<{verification_token_hash:string}>();
      if(!row)return false;
      const now=new Date().toISOString();
      await appendDocumentAudit(tx,id,'verification_token_rotated','success',actorId);
      await tx.prepare("INSERT INTO document_verification_tokens(id,document_id,token_hash,status,revoked_at,created_at) VALUES (?,?,?,'revoked',?,?)").bind(crypto.randomUUID(),id,row.verification_token_hash,now,now).run();
      await tx.prepare('UPDATE order_documents SET verification_token = ?, verification_token_hash = ? WHERE id = ?').bind(encryptData(token,`token:${id}`),hash,id).run();
      return true;
    });
    return Response.json(found?{verificationUrl:`${new URL(request.url).origin}/verify/${token}`}:{error:'المستند غير موجود.'},{status:found?200:404});
  }catch(error){return Response.json({error:'تعذر تنفيذ العملية.'},{status:error instanceof Error&&error.message==='AUTH_REQUIRED'?401:503});}
}
