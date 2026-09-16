import { spawn } from 'node:child_process';
const [command,...args]=process.argv.slice(2);
if(!['dev','build','start'].includes(command)) throw new Error('Expected dev, build or start');
const child=spawn(process.execPath,command==='start'?['scripts/start-production.mjs']:['node_modules/next/dist/bin/next',command,'--webpack',...args],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code ?? 1));
child.on('error',()=>{console.error('Next.js process failed to start');process.exit(1);});
