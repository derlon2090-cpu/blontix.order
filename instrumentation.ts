export async function register() {
  const {deploymentRole,backendOrigin}=await import('./lib/deployment.mjs');
  if(deploymentRole()==='frontend'){backendOrigin();return;}
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startupCheck } = await import('./lib/providers.mjs');
    await startupCheck();
  }
}
