import 'server-only';
import { deploymentRole, backendOrigin } from './deployment.mjs';
async function remoteAccess(request:Request) {
  const cookie=(request.headers.get('cookie') || '').split(';').map(value=>value.trim()).filter(value=>/^__Host-blontix_(device|session|pre_auth)=/.test(value)).join('; ');
  const response=await fetch(`${backendOrigin()}/api/access/status`,{headers:{cookie},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(90000)});
  if(!response.ok) throw new Error('Backend authentication service unavailable');
  return await response.json() as {authenticated:boolean;preAuthenticated:boolean};
}
export async function sessionIsValid(request:Request) {
  if(deploymentRole()==='backend') return (await import('./access')).sessionIsValid(request);
  return (await remoteAccess(request)).authenticated===true;
}
export async function preAuthChallenge(request:Request) {
  if(deploymentRole()==='backend') return (await import('./access')).preAuthChallenge(request);
  return (await remoteAccess(request)).preAuthenticated===true;
}
