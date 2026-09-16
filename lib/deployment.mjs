export function deploymentRole() {
  const role=process.env.VERCEL==='1' ? 'frontend' : process.env.APP_ROLE || 'backend';
  if(!['frontend','backend'].includes(role)) throw new Error('Invalid environment variable: APP_ROLE');
  if(process.env.RENDER==='true' && role!=='backend') throw new Error('Render must run the backend role');
  return role;
}
export function backendOrigin() {
  const value=process.env.BACKEND_URL || 'https://blontix-order.onrender.com';
  let url;
  try {url=new URL(value);}catch{throw new Error('Invalid environment variable: BACKEND_URL');}
  if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw new Error('Invalid environment variable: BACKEND_URL');
  if([process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL].includes(url.host)) throw new Error('BACKEND_URL must not point to the frontend');
  return url.origin;
}
