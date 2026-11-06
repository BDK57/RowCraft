import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readWorkbook} from '../server/workbook.mjs';
import {planSections,sectionCards,sectionAssignments} from '../server/sections.mjs';

const root=process.cwd(),checks=path.join(root,'.local/checks'),template=JSON.parse(await fs.readFile(path.join(checks,'grid-template.json'),'utf8'));
const workbook=await readWorkbook(path.resolve('../excel/Q1 2026 Data for Trade Letter.xlsx')),sheet=workbook.sheets[0],overflow=process.argv.includes('--overflow');
async function native(request,dir){
 await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'request.json'),JSON.stringify(request));await fs.copyFile('server/illustrator.jsx',path.join(dir,'worker.jsx'));
 await new Promise((resolve,reject)=>{const p=spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; $sectionsCheck=New-Object -ComObject Illustrator.Application; $null=$sectionsCheck.DoJavaScriptFile($env:COVER_STUDIO_SCRIPT)"],{windowsHide:true,env:{...process.env,COVER_STUDIO_SCRIPT:path.join(dir,'worker.jsx')}});let error='';p.stderr.on('data',data=>error+=data);p.on('error',reject);p.on('exit',code=>code?reject(Error(error)):resolve());});
 const result=JSON.parse(await fs.readFile(path.join(dir,'response.json'),'utf8'));if(result.error)throw Error(result.error);return result;
}
function makeSection(id,artboard,cards,from,to,heading,monthTarget,month){
 const board=template.artboards[artboard],x=Math.min(...cards.map(c=>c.x)),y=Math.min(...cards.map(c=>c.y)),right=Math.max(...cards.map(c=>c.x+c.width)),bottom=Math.max(...cards.map(c=>c.y+c.height));
 const box={x:Math.max(0,x-.003),y:Math.max(0,y-.003),width:right-x+.006,height:bottom-y+.006},sample=sectionCards(board,box)[0];
 const mappings=board.targets.filter(t=>sample.targetIds.includes(t.id)).map(t=>({kind:'text',targetId:t.id,column:sheet.columns.indexOf(/Scoring/i.test(t.text)?'Scoring':/Gaggoo/.test(t.text)?'City':'Shop Name')}));
 const headingTarget=board.targets.find(t=>t.text.trim()===heading);
 return {id,name:id,artboard,box,cardId:sample.id,recordIds:sheet.rows.slice(from-1,to).map(r=>r.id),mappings,labels:headingTarget?[{role:'heading',targetId:headingTarget.id,source:'literal',value:id+' Winners',column:0},{role:'month',targetId:monthTarget.id,source:month?'literal':'column',value:month||'',column:sheet.columns.indexOf('Month')}]:[]};
}
const board=template.artboards[2],top=board.cards.filter(c=>c.y<.35),bottom=board.cards.filter(c=>c.y>.4),months=board.targets.filter(t=>t.text.trim()==='Jan 2026').sort((a,b)=>a.y-b.y);
const sections=[makeSection('First section',2,top,1,overflow?top.length+1:10,'Confirmed Prize Winners',months[0],'01 / 2026'),makeSection('Second section',2,bottom,20,30,'Lucky Draw Winners',months[1],null)];
if(overflow){const other=template.artboards[1],firstRow=other.cards.filter(c=>c.y<.2);sections.push(makeSection('Other artboard',1,firstRow,31,38,null,null,null));}
const plan=planSections(template,workbook,sheet.name,sections),id=crypto.randomUUID(),dir=path.join(root,'.local/jobs',id),outputDir=path.join(dir,'output');
await fs.mkdir(outputDir,{recursive:true});
console.log('Native sections check:',JSON.stringify({id,count:plan.count,pages:plan.pageCount,sections:plan.sections.map(s=>({name:s.name,capacity:s.capacity,count:s.records.length}))}));
const originals=await native({operation:'verify',source:template.source,assetsRoot:template.assetsRoot,mappings:plan.sections.flatMap(s=>s.mappings)},path.join(checks,'sections-source-'+id));
const createdAt=new Date().toISOString();
const result=await native({operation:'generate-sections',source:template.source,assetsRoot:template.assetsRoot,sectionPlan:plan,metadata:template,textFit:'preserve',includePdf:true,outputDir},dir);
const verified=await native({operation:'verify',source:path.join(outputDir,'personalized-covers.ai'),assetsRoot:outputDir},path.join(checks,'sections-verify-'+id));
assert.equal(verified.pages,plan.pageCount);assert.equal(verified.records.length,plan.count);assert.equal(verified.linkedImages,0);
let styleIndex=0;
for(const section of plan.sections){
 const expectedStyles=originals.templateStyles.slice(styleIndex,styleIndex+section.mappings.length);styleIndex+=section.mappings.length;
 for(const row of section.records){const card=verified.cardData.find(c=>c.name===`Record ${row.record} | Section ${section.id}`);assert.ok(card,'Missing '+section.id+' record '+row.record);assert.deepEqual(card.fields,section.mappings.map(m=>row.values[m.column]));assert.deepEqual(card.styles,expectedStyles,'Typography changed in '+card.name);}
 for(const label of section.labels)assert.equal(verified.texts.filter(text=>text===label.value).length,plan.boards.find(b=>b.artboard===section.artboard).pages,'Missing or stale section heading/month');
}
const assignments=sectionAssignments(plan);assert.equal(assignments.length,plan.count);
await fs.writeFile(path.join(outputDir,'manifest.json'),JSON.stringify({mode:'sections',pages:plan.pageCount,sections,records:assignments,warnings:result.warnings},null,2));
await new Promise((resolve,reject)=>{const p=spawn(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),['server/files.py','package',outputDir,path.join(dir,'covers.zip')],{windowsHide:true});p.on('error',reject);p.on('exit',code=>code?reject(Error('Packaging failed')):resolve());});
const base='/api/jobs/'+id;await fs.writeFile(path.join(dir,'status.json'),JSON.stringify({id,type:'generate',status:'complete',progress:100,message:'Verified multi-section export',createdAt,createdAtSource:'recorded',result:{count:plan.count,pages:plan.pageCount,ai:base+'/ai',pdf:base+'/pdf',archive:base+'/download',folder:outputDir,proof:false,previews:result.previews.map(name=>base+'/preview/'+name),warnings:result.warnings}}));
await fs.writeFile(path.join(checks,overflow?'sections-overflow.json':'sections-example.json'),JSON.stringify({id,outputDir,count:plan.count,pages:plan.pageCount,result,verified},null,2));
console.log('PASS:',JSON.stringify({id,outputDir,count:plan.count,pages:plan.pageCount,verifiedCards:verified.records.length,linkedImages:verified.linkedImages,warnings:result.warnings.length}));
