import { env } from '@/lib/runtime';
import { appendDocumentAudit } from '@/lib/audit';
import { requireDocumentSession } from '@/lib/access';
export async function POST(request: Request, context: {params:Promise<{id:string}>}) {
  try {
    const actorId=await requireDocumentSession(request), {id}=await context.params;
    const found=await env.DB.transaction(async tx=>{
      const row=await tx.prepare('SELECT lifecycle_status FROM order_documents WHERE id = ? FOR UPDATE').bind(id).first<{lifecycle_status:string}>();
      if(!row) return false;
      if(row.lifecycle_status!=='cancelled') {
        await appendDocumentAudit(tx,id,'document_cancelled','success',actorId);
        await tx.prepare("UPDATE order_documents SET lifecycle_status = 'cancelled' WHERE id = ?").bind(id).run();
      }
      return true;
    });
    return Response.json(found?{status:'cancelled'}:{error:'المستند غير موجود.'},{status:found?200:404});
  }catch(error){return Response.json({error:'تعذر تنفيذ العملية.'},{status:error instanceof Error && error.message==='AUTH_REQUIRED'?401:503});}
}
