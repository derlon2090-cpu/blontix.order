import { env } from '@/lib/runtime';
import { verifyDocumentAudit } from '@/lib/audit';
import { requireDocumentSession } from '@/lib/access';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    await requireDocumentSession(request); const {id}=await context.params;
    const audit=await env.DB.transaction(async tx=>{
      await tx.prepare('SELECT id FROM order_documents WHERE id = ? FOR UPDATE').bind(id).first();
      return verifyDocumentAudit(tx,id);
    });
    return Response.json({events:audit.events.slice(-100).reverse(),integrity:{valid:audit.valid,totalEvents:audit.events.length}},{status:audit.valid?200:409,headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return Response.json({error:'تعذر فحص سجل التدقيق.'},{status:error instanceof Error&&error.message==='AUTH_REQUIRED'?401:503});}
}
