import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const processes=[spawn(process.execPath,['server/index.mjs'],{cwd:root,stdio:'inherit',windowsHide:true}),spawn(process.execPath,['node_modules/vite/bin/vite.js'],{cwd:root,stdio:'inherit',windowsHide:true})];
let closing=false;
function close(){if(closing)return;closing=true;for(const p of processes)p.kill();}
for(const p of processes){p.on('error',e=>{console.error(e.message);close();process.exitCode=1;});p.on('exit',code=>{close();process.exitCode=code||0;});}
process.on('SIGINT',close);process.on('SIGTERM',close);
