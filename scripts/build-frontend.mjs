import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','--webpack'],{stdio:'inherit',env:{...process.env,APP_ROLE:'frontend'}});
if(result.error)throw result.error;
process.exitCode=result.status ?? 1;
