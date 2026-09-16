export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startupCheck } = await import('./lib/providers.mjs');
    await startupCheck();
  }
}
