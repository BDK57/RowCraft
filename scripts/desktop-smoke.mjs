import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {packageOutput} from '../server/archives.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executable=path.resolve(process.argv.find(arg=>arg.startsWith('--exe='))?.slice(6)||path.join(root,'release','win-unpacked','RowCraft.exe'));
const dir=path.join(root,'.local','desktop-check',crypto.randomUUID());await fs.mkdir(dir,{recursive:true});
const env={...process.env,ROWCRAFT_SMOKE_DATA_DIR:dir};
// Child Chromium processes must run as Electron, even when a caller uses Node mode.
delete env.ELECTRON_RUN_AS_NODE;
if(process.argv.includes('--native')){
 const source=path.resolve(root,'..','illustrations','Stop & Shop Trade Letter');
 const archive=path.join(dir,'template.zip');await packageOutput(source,archive);env.ROWCRAFT_SMOKE_TEMPLATE=archive;
}
const child=spawn(executable,['--rowcraft-smoke'],{cwd:dir,windowsHide:true,env,stdio:'pipe'});
let stderr='';child.stdout.on('data',data=>process.stdout.write(data));child.stderr.on('data',data=>{stderr+=data;});
const timeout=setTimeout(()=>{child.kill();},process.argv.includes('--native')?600000:120000);
let code;
try{code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});}finally{clearTimeout(timeout);}
const result=JSON.parse(await fs.readFile(path.join(dir,'smoke-result.json'),'utf8').catch(()=>JSON.stringify({ok:false,error:stderr||`Desktop exited with ${code}`})));
console.log(JSON.stringify({dir,exitCode:code,...result},null,2));assert.equal(code,0);assert.equal(result.ok,true,result.error);
