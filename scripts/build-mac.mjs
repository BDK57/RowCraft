import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.platform!=='darwin')throw Error('Build the DMG on macOS (a Mac or a macOS CI runner). Windows cannot produce and validate this macOS release. See desktop/MACOS.md.');
const arch=process.argv[2]||'arm64';
if(!['arm64','x64','both'].includes(arch))throw Error('Use npm run desktop:dist:mac -- arm64, x64, or both.');
async function run(args){await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env:process.env,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Mac build command failed with exit code '+code)));});}
await run(['node_modules/typescript/bin/tsc','-b']);
await run(['node_modules/vite/bin/vite.js','build']);
await run(['scripts/prepare-desktop.mjs']);
await run(['node_modules/electron-builder/out/cli/cli.js','--mac','dmg',...(arch==='both'?['--arm64','--x64']:['--'+arch]),'--publish','never']);
