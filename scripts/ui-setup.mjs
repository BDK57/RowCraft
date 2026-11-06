import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

const root=process.cwd(),npm='C:/Program Files/nodejs/node_modules/npm/bin';
const env={...process.env,npm_config_prefix:path.join(root,'.local/npm-prefix'),PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH};
async function run(args){await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});p.on('error',reject);p.on('exit',c=>c?reject(Error('Setup exited '+c)):resolve());});}
await fs.mkdir('.local/backups/ui-before-revamp',{recursive:true});
for(const name of ['App.tsx','style.css','ZoomCanvas.tsx','CardLoop.tsx','main.tsx']){const to=path.join('.local/backups/ui-before-revamp',name);if(!await fs.stat(to).catch(()=>null))await fs.copyFile(path.join('src',name),to);}
if(!await fs.stat('src/components/ui/button.tsx').catch(()=>null))await run([path.join(npm,'npx-cli.js'),'-y','shadcn@latest','add','button','badge','input','label','select','checkbox','progress','dialog','dropdown-menu','tooltip','separator','tabs','switch','collapsible','popover','command','--yes']);
await run([path.join(npm,'npx-cli.js'),'-y','shadcn@latest','add','@bklit/bar-chart','--yes','--overwrite']);
await run([path.join(npm,'npm-cli.js'),'install','-D','@types/d3-array','@types/d3-scale','@types/d3-shape']);
console.log('UI components and chart dependencies installed.');
