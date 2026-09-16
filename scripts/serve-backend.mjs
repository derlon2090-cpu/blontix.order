import {createServer} from 'node:http';
import next from 'next';
import {deploymentRole} from '../lib/deployment.mjs';
if(deploymentRole()!=='backend') throw new Error('Backend server requires the backend role');
const port=Number(process.env.PORT);
if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid environment variable: PORT');
let publicOrigin;
if(process.env.RENDER==='true') {
  let url;
  try{url=new URL(process.env.RENDER_EXTERNAL_URL);}catch{throw new Error('Invalid environment variable: RENDER_EXTERNAL_URL');}
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash) throw new Error('Invalid environment variable: RENDER_EXTERNAL_URL');
  publicOrigin=url.origin;
}
// Render terminates TLS. A trusted public Host retains the public origin for
// existing document links; the application and QR generation stay unchanged.
const publicUrl=publicOrigin ? new URL(publicOrigin) : null;
// These Next.js options describe request URLs behind Render's TLS proxy.
// The actual HTTP socket below always binds process.env.PORT on 0.0.0.0.
const app=next({dev:false,hostname:publicUrl?.hostname || '0.0.0.0',port:publicUrl ? Number(publicUrl.port || 443) : port});
await app.prepare();
const handler=app.getRequestHandler();
const server=createServer(async(req,res)=>{
  try {
    if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end();return;}
    if(publicOrigin){req.headers.host=new URL(publicOrigin).host;req.headers['x-forwarded-proto']='https';}
    await handler(req,res);
  }catch{if(!res.headersSent)res.writeHead(500);res.end('Backend request failed');}
});
server.listen(port,'0.0.0.0',()=>console.log('Node backend listening on 0.0.0.0 using PORT'));
server.on('error',()=>{console.error('Backend listener failed');process.exit(1);});
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{
  if(stopping)return;stopping=true;
  const deadline=setTimeout(()=>process.exit(1),25000);deadline.unref();
  server.close(()=>{void app.close().then(()=>process.exit(0)).catch(()=>process.exit(1));});
});
