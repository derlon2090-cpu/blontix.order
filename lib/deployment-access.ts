import 'server-only';
import { deploymentRole, backendOrigin } from './deployment.mjs';
export class BackendUnavailableError extends Error {
  constructor(){super('Backend authentication service unavailable');this.name='BackendUnavailableError';}
}
const statusRequests=new WeakMap<Request,Promise<{authenticated:boolean;preAuthenticated:boolean}>>();
async function remoteAccess(request:Request) {
  const existing=statusRequests.get(request);
  if(existing)return existing;
  const pending=loadRemoteAccess(request);
  statusRequests.set(request,pending);
  return pending;
}
async function loadRemoteAccess(request:Request) {
  const cookie=(request.headers.get('cookie') || '').split(';').map(value=>value.trim()).filter(value=>/^__Host-blontix_(device|session|pre_auth)=/.test(value)).join('; ');
  // A visitor without an authentication token cannot have an active session.
  // Render must not block the first page load merely to confirm that fact.
  if(!/(?:^|; )__Host-blontix_(session|pre_auth)=[A-Za-z0-9_-]{43}(?:;|$)/.test(cookie))return {authenticated:false,preAuthenticated:false};
  const origin=backendOrigin();
  try {
    const response=await fetch(`${origin}/api/access/status`,{headers:{cookie},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new BackendUnavailableError();
    const data=await response.json();
    if(typeof data.authenticated!=='boolean'||typeof data.preAuthenticated!=='boolean')throw new BackendUnavailableError();
    return {authenticated:data.authenticated,preAuthenticated:data.preAuthenticated};
  }catch{throw new BackendUnavailableError();}
}
export async function sessionIsValid(request:Request) {
  if(deploymentRole()==='backend') return (await import('./access')).sessionIsValid(request);
  return (await remoteAccess(request)).authenticated===true;
}
export async function preAuthChallenge(request:Request) {
  if(deploymentRole()==='backend') return (await import('./access')).preAuthChallenge(request);
  return (await remoteAccess(request)).preAuthenticated===true;
}
