import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=path.resolve(process.argv[2]||'');
assert.equal(path.dirname(check),path.join(root,'.local','desktop-check'),'Choose a desktop smoke-test folder');
const smoke=JSON.parse(await fs.readFile(path.join(check,'smoke-result.json'),'utf8'));assert.equal(smoke.ok,true);assert.ok(smoke.output);
const request=JSON.parse(await fs.readFile(path.join(path.dirname(smoke.output.folder),'request.json'),'utf8'));
async function verify(source,name,mappings=[]){
 const dir=path.join(check,name+'-'+crypto.randomUUID());await fs.mkdir(dir);
 await fs.copyFile(path.join(root,'server','illustrator.jsx'),path.join(dir,'worker.jsx'));
 await fs.writeFile(path.join(dir,'request.json'),JSON.stringify({operation:'verify',source,assetsRoot:request.assetsRoot,mappings}));
 const command="$ErrorActionPreference='Stop'; try { $native=New-Object -ComObject Illustrator.Application; $null=$native.DoJavaScriptFile($env:COVER_STUDIO_SCRIPT) } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }";
 await promisify(execFile)(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,timeout:120000,env:{...process.env,COVER_STUDIO_SCRIPT:path.join(dir,'worker.jsx')}});
 const result=JSON.parse(await fs.readFile(path.join(dir,'response.json'),'utf8'));assert.ok(!result.error,result.error);return result;
}
const original=await verify(request.source,'verify-original',request.mappings);
const output=await verify(path.join(smoke.output.folder,'personalized-covers.ai'),'verify-output');
assert.equal(output.pages,smoke.output.pages);assert.equal(output.records.length,request.records.length);assert.equal(output.linkedImages,0);
for(const row of request.records){
 const card=output.cardData.find(item=>item.name==='Record '+row.record);assert.ok(card,'Missing record '+row.record);
 assert.deepEqual(card.fields,request.mappings.map(mapping=>row.values[mapping.column]));assert.deepEqual(card.styles,original.templateStyles,'Original typography changed');
 if(request.photo){assert.equal(card.photo.replaced,!!request.photo.paths[row.id],'Unexpected photo replacement result');if(card.photo.replaced)assert.equal(card.photo.embedded,true,'Replacement photo was not embedded');}
}
const result={ok:true,cards:output.records.length,pages:output.pages,linkedImages:output.linkedImages,typographyPreserved:true,replacedPhotos:output.cardData.filter(card=>card.photo?.replaced).length};
await fs.writeFile(path.join(check,'native-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
