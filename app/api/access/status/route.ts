import {sessionIsValid,preAuthChallenge} from '@/lib/access';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
  try {
    const authenticated=await sessionIsValid(request);
    const preAuthenticated=!authenticated && Boolean(await preAuthChallenge(request));
    return Response.json({authenticated,preAuthenticated},{headers});
  }catch{return Response.json({error:'خدمة الدخول غير متاحة مؤقتًا.'},{status:503,headers});}
}
