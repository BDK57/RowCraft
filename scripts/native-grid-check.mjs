import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {readWorkbook} from '../server/workbook.mjs';
import {planGrid,splitMappings,gridAssignments} from '../server/grid.mjs';
import {validateMappings} from '../server/domain.mjs';

const root=process.cwd(),checks=path.join(root,'.local/checks');await fs.mkdir(checks,{recursive:true});
const original=path.resolve(root,'../illustrations/Stop & Shop Trade Letter'),source=path.join(original,'Stop & Shop Trade Letter.ai');
async function native(request,dir){
 await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'request.json'),JSON.stringify(request));await fs.copyFile('server/illustrator.jsx',path.join(dir,'worker.jsx'));
 const command="$ErrorActionPreference='Stop'; $nativeCheck=New-Object -ComObject Illustrator.Application; $null=$nativeCheck.DoJavaScriptFile($env:COVER_STUDIO_SCRIPT)";
 await new Promise((resolve,reject)=>{const p=spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,env:{...process.env,COVER_STUDIO_SCRIPT:path.join(dir,'worker.jsx')}});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('exit',code=>code?reject(Error(err)):resolve());});
 const result=JSON.parse(await fs.readFile(path.join(dir,'response.json'),'utf8'));if(result.error)throw Error(result.error);return result;
}
const cache=path.join(checks,'grid-template.json');let template;
if(process.argv.includes('--inspect-only')||process.argv.includes('--reinspect')||!await fs.stat(cache).catch(()=>null)){
 const id=crypto.randomUUID(),dir=path.join(root,'.local/templates',id);await fs.mkdir(dir,{recursive:true});
 const info=await native({operation:'inspect',source,assetsRoot:original,outputDir:dir},path.join(checks,'grid-inspect-'+crypto.randomUUID()));
 template={id,name:'Stop & Shop Trade Letter.ai',source,assetsRoot:original,preset:null,...info};await fs.writeFile(cache,JSON.stringify(template));await fs.writeFile(path.join(dir,'template.json'),JSON.stringify(template));
}else template=JSON.parse(await fs.readFile(cache,'utf8'));
console.log(JSON.stringify({artboards:template.artboards.map(b=>({cards:b.cards.length,fields:b.targets.length,families:[...new Set(b.cards.map(c=>c.family))]})),missingLinks:template.missingLinks}));
assert.equal(template.missingLinks.length,0);
if(process.argv.includes('--inspect-only'))process.exit(0);
const workbook=await readWorkbook(path.resolve(root,'../excel/Q1 2026 Data for Trade Letter.xlsx')),sheet=workbook.sheets[0];
const artboard=template.artboards.findIndex(b=>b.cards.length>=40),board=template.artboards[artboard];assert.ok(board);
const families=[...new Set(board.cards.map(c=>c.family))].map(f=>board.cards.filter(c=>c.family===f)).sort((a,b)=>b.length-a.length);
const sample=families[0].sort((a,b)=>Math.abs(a.y-b.y)*board.height>2?a.y-b.y:a.x-b.x)[0];
const mappingNames=[['Usama Mobile','Shop Name'],['Scoring 539','Scoring'],['Gaggoo Mandi','City']];
const mappings=mappingNames.map(([label,col])=>{const target=board.targets.find(t=>sample.targetIds.includes(t.id)&&t.text.trim()===label);assert.ok(target,'Missing card field '+label);return {kind:'text',targetId:target.id,column:sheet.columns.indexOf(col)};});
const countArg=process.argv.find(a=>a.startsWith('--count='));
const count=countArg?Number(countArg.split('=')[1]):process.argv.includes('--overflow')?families[0].length+1:5,rows=sheet.rows.slice(0,count),checked=validateMappings(mappings,template,artboard,sheet.columns),grid=planGrid(template,artboard,{cardId:sample.id},checked,count),parts=splitMappings(grid,checked);
assert.equal(rows.length,count,'Requested count exceeds the worksheet');
const originalStyles=await native({operation:'verify',source,assetsRoot:original,mappings:parts.card},path.join(checks,'font-source-'+crypto.randomUUID()));
const id=crypto.randomUUID(),dir=path.join(root,'.local/jobs',id),outputDir=path.join(dir,'output');await fs.mkdir(outputDir,{recursive:true});
console.log('Native grid test:',JSON.stringify({count,capacity:grid.capacity,pages:grid.pages,id}));
const result=await native({operation:'generate',source,assetsRoot:original,artboard,mappings:parts.card,pageMappings:parts.page,records:rows,grid,includePdf:true,outputDir,metadata:template},dir);
const verified=await native({operation:'verify',source:path.join(outputDir,'personalized-covers.ai'),assetsRoot:outputDir},path.join(checks,'verify-'+id));
assert.equal(verified.pages,grid.pages);assert.equal(verified.records.length,count);assert.equal(verified.linkedImages,0);
for(const row of rows){const card=verified.cardData.find(c=>c.name==='Record '+row.record);assert.ok(card,'Missing selected record '+row.record);assert.deepEqual(card.fields,parts.card.map(m=>row.values[m.column]),'Mixed or stale fields in record '+row.record);assert.deepEqual(card.styles,originalStyles.templateStyles,'Font, size, weight, scale, fill or stroke changed in record '+row.record);}
// A real participant is also named Usama Mobile (record 6). Compare selected
// values and cardinality rather than rejecting a legitimate placeholder match.
for(const label of ['Usama Mobile','Gaggoo Mandi']){const expected=rows.flatMap(r=>parts.card.map(m=>r.values[m.column])).filter(v=>v===label).length;assert.equal(verified.texts.filter(v=>v===label).length,expected,'Unused template value '+label);}
await fs.writeFile(path.join(outputDir,'manifest.json'),JSON.stringify({count,pages:grid.pages,textFit:'preserve',records:gridAssignments(grid,rows),warnings:result.warnings},null,2));
const base='/api/jobs/'+id,status={id,type:'generate',status:'complete',progress:100,message:'Verified native grid',result:{count,pages:grid.pages,ai:base+'/ai',pdf:base+'/pdf',archive:base+'/download',folder:outputDir,proof:false,previews:result.previews.map(p=>base+'/preview/'+p),warnings:result.warnings}};
// Packaging uses the same local helper as the API.
await new Promise((resolve,reject)=>{const python=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');const p=spawn(python,['server/files.py','package',outputDir,path.join(dir,'covers.zip')],{windowsHide:true});p.on('error',reject);p.on('exit',c=>c?reject(Error('Packaging failed')):resolve());});
await fs.writeFile(path.join(dir,'status.json'),JSON.stringify(status));await fs.writeFile(path.join(checks,countArg?`grid-${count}.json`:process.argv.includes('--overflow')?'grid-overflow.json':'grid-five.json'),JSON.stringify({id,outputDir,count,pages:grid.pages,verified,result},null,2));
console.log('PASS:',JSON.stringify({outputDir,count,pages:grid.pages,verifiedCards:verified.records.length,linkedImages:verified.linkedImages,warnings:result.warnings.length}));
