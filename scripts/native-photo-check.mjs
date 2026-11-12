import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readWorkbook} from '../server/workbook.mjs';
import {planGrid,splitMappings} from '../server/grid.mjs';
import {planSections} from '../server/sections.mjs';
import {validateMappings} from '../server/domain.mjs';
import {DEFAULT_PHOTO,validatePhotoMapping,photoLayout} from '../server/photos.mjs';
import {importImageAssets,preparePhotoRecords} from '../server/image-assets.mjs';

const root=process.cwd(),dir=path.join(root,'.local','photo-check',crypto.randomUUID());await fs.mkdir(dir,{recursive:true});
const template=JSON.parse(await fs.readFile('.local/checks/grid-template.json','utf8'));
const originalHash=crypto.createHash('sha256').update(await fs.readFile(template.source)).digest('hex');
async function native(request,name){
 const job=path.join(dir,name);await fs.mkdir(job,{recursive:true});await fs.writeFile(path.join(job,'request.json'),JSON.stringify(request));await fs.copyFile('server/illustrator.jsx',path.join(job,'worker.jsx'));
 await new Promise((resolve,reject)=>{const child=spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; $photoCheck=New-Object -ComObject Illustrator.Application; $null=$photoCheck.DoJavaScriptFile($env:COVER_STUDIO_SCRIPT)"],{windowsHide:true,env:{...process.env,COVER_STUDIO_SCRIPT:path.join(job,'worker.jsx')}});let error='';child.stderr.on('data',d=>error+=d);child.once('error',reject);child.once('exit',code=>code?reject(Error(error)):resolve());});
 const result=JSON.parse(await fs.readFile(path.join(job,'response.json'),'utf8'));if(result.error)throw Error(result.error);return result;
}
const artboard=template.artboards.findIndex(board=>board.cards?.length===56),board=template.artboards[artboard];
const cards=[...board.cards].sort((a,b)=>Math.abs(a.y-b.y)*board.height>2?a.y-b.y:a.x-b.x),card=cards[0];assert.ok(card.photos?.length);
const workbook=await readWorkbook(path.resolve('../excel/Q1 2026 Data for Trade Letter.xlsx')),sheet=workbook.sheets[0];sheet.columns.push('Card Image');
const landscape=await sharp({create:{width:600,height:200,channels:3,background:'#f35238'}}).composite([{input:await sharp({create:{width:300,height:200,channels:3,background:'#287ce6'}}).png().toBuffer(),left:300,top:0}]).png().toBuffer();
const portrait=await sharp({create:{width:200,height:600,channels:3,background:'#24a979'}}).png().toBuffer();
async function library(bytes,name){const upload=path.join(dir,crypto.randomUUID()+'.png');await fs.writeFile(upload,bytes);return importImageAssets(dir,[{path:upload,originalname:name}],[name]);}
const a=await library(landscape,'person.png'),b=await library(portrait,'portrait.png');
const uploads=[...a.assets,...b.assets];
// Put the second image into the same imported folder as the landscape image.
const extra=path.join(dir,'portrait.png');await fs.writeFile(extra,portrait);await importImageAssets(dir,[{path:extra,originalname:'portrait.png'}],['portrait.png'],a.id);
const rows=sheet.rows.slice(0,6).map((row,i)=>({...row,values:[...row.values,['person.png','portrait.png','','missing.png','https://smsh-lyart.vercel.app/assets/burgers/2b.png','https://smsh-lyart.vercel.app/assets/burgers/2b.png'][i]]}));
const input={source:'column',targetId:card.photos[0].id,column:sheet.columns.length-1,libraryId:a.id,adjustment:DEFAULT_PHOTO,overrides:{[rows[0].id]:{...DEFAULT_PHOTO,x:0},[rows[1].id]:{...DEFAULT_PHOTO,fit:'fit'},[rows[5].id]:{...DEFAULT_PHOTO,x:1,zoom:1.5}}};
const mappingNames=[['Usama Mobile','Shop Name'],['Scoring 539','Scoring'],['Gaggoo Mandi','City']];
const mappings=validateMappings(mappingNames.map(([label,col])=>({kind:'text',targetId:board.targets.find(t=>card.targetIds.includes(t.id)&&t.text.trim()===label).id,column:sheet.columns.indexOf(col)})),template,artboard,sheet.columns);
const sourceStyles=await native({operation:'verify',source:template.source,assetsRoot:template.assetsRoot,mappings},'source');
const output=path.join(dir,'column-output');await fs.mkdir(output);const prepared=await preparePhotoRecords(dir,validatePhotoMapping(input,card,sheet.columns),rows,path.join(dir,'column-assets'));
assert.deepEqual(prepared.stats,{replaced:4,retained:2});console.log('Image assets resolved:',prepared.stats);
const grid=planGrid(template,artboard,{cardId:card.id,photo:prepared.photo},mappings,rows.length),parts=splitMappings(grid,mappings);
const generated=await native({operation:'generate',source:template.source,assetsRoot:template.assetsRoot,outputDir:output,artboard,metadata:template,grid,mappings:parts.card,pageMappings:[],photo:prepared.photo,records:rows,includePdf:true,textFit:'preserve'},'column-job');
assert.ok(!generated.warnings.some(w=>w.includes('image could not be placed')),generated.warnings.join('\n'));
const verified=await native({operation:'verify',source:path.join(output,'personalized-covers.ai'),assetsRoot:output},'column-verify');
assert.equal(verified.cardData.length,6);assert.equal(verified.linkedImages,0);
for(let i=0;i<rows.length;i++){
 const actual=verified.cardData.find(c=>c.name==='Record '+rows[i].record);assert.ok(actual);assert.deepEqual(actual.fields,mappings.map(m=>rows[i].values[m.column]));assert.deepEqual(actual.styles,sourceStyles.templateStyles);assert.equal(actual.photo.replaced,![2,3].includes(i));
 if(actual.photo.replaced){assert.equal(actual.photo.embedded,true);const [l,t,r,bottom]=actual.photo.frame,[il,it,ir,ib]=actual.photo.image;const asset=i===1?uploads[1]:i<2?uploads[0]:null;const adjustment=input.overrides[rows[i].id]||DEFAULT_PHOTO;if(asset){const expected=photoLayout(r-l,t-bottom,asset.width,asset.height,adjustment);for(const [v,w]of [[il-l,expected.left],[t-it,expected.top],[ir-il,expected.width],[it-ib,expected.height]])assert.ok(Math.abs(v-w)<.05,`Crop differs: ${v} vs ${w}`);}}
}
console.log('PASS: six-card mixed images, Fit/Fill/offsets, missing retained, original fonts, embedded artwork');

const sharedOutput=path.join(dir,'shared-output');await fs.mkdir(sharedOutput);const sharedInput={source:'shared',targetId:card.photos[0].id,libraryId:a.id,assetId:a.assets[0].id,adjustment:{...DEFAULT_PHOTO,x:1,zoom:1.3}};
const shared=await preparePhotoRecords(dir,validatePhotoMapping(sharedInput,card,sheet.columns),rows,path.join(dir,'shared-assets'));assert.equal(shared.stats.replaced,6);
await native({operation:'generate',source:template.source,assetsRoot:template.assetsRoot,outputDir:sharedOutput,artboard,metadata:template,grid,mappings:parts.card,pageMappings:[],photo:shared.photo,records:rows,includePdf:true},'shared-job');
const sharedVerified=await native({operation:'verify',source:path.join(sharedOutput,'personalized-covers.ai'),assetsRoot:sharedOutput},'shared-verify');assert.equal(sharedVerified.cardData.filter(c=>c.photo.replaced&&c.photo.embedded).length,6);assert.equal(sharedVerified.linkedImages,0);
console.log('PASS: shared image overrides blank/missing/URL cells on all six cards');

// Two independent sections on one page overflow into the same combined AI document.
sheet.rows=rows;const sections=[cards[0],cards[1]].map((sample,i)=>({id:'section-'+i,name:'Section '+(i+1),artboard,box:{x:sample.x-.0001,y:sample.y-.0001,width:sample.width+.0002,height:sample.height+.0002},cardId:sample.id,recordIds:rows.slice(i*2,i*2+2).map(r=>r.id),mappings:[],labels:[],photo:{...sharedInput,targetId:sample.photos[0].id,libraryId:i?b.id:a.id,assetId:i?b.assets[0].id:a.assets[0].id,adjustment:{...DEFAULT_PHOTO,fit:i?'fit':'fill'}}}));
const plan=planSections(template,workbook,sheet.name,sections);assert.equal(plan.pageCount,2);for(const section of plan.sections)section.photo=(await preparePhotoRecords(dir,section.photo,section.records,path.join(dir,'section-assets'))).photo;
const sectionOutput=path.join(dir,'section-output');await fs.mkdir(sectionOutput);
await native({operation:'generate-sections',source:template.source,assetsRoot:template.assetsRoot,outputDir:sectionOutput,metadata:template,sectionPlan:plan,includePdf:true},'sections-job');
const sectionsVerified=await native({operation:'verify',source:path.join(sectionOutput,'personalized-covers.ai'),assetsRoot:sectionOutput},'sections-verify');assert.equal(sectionsVerified.pages,2);assert.equal(sectionsVerified.cardData.length,4);assert.equal(sectionsVerified.cardData.filter(c=>c.photo.replaced&&c.photo.embedded).length,4);assert.equal(sectionsVerified.linkedImages,0);
assert.equal(crypto.createHash('sha256').update(await fs.readFile(template.source)).digest('hex'),originalHash);
await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({ok:true,output,sharedOutput,sectionOutput,verified,sharedVerified,sectionsVerified,warnings:prepared.warnings},null,2));
console.log('PASS:',JSON.stringify({dir,mixedImages:4,retained:2,sharedImages:6,sectionImages:4,sectionPages:2,sourceUnchanged:true}));
