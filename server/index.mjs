import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {supportsIllustrator,illustratorInvocation,illustratorHostError} from './illustrator-host.mjs';
import {fileURLToPath} from 'node:url';
import {selectedRecords,validateMappings,validateTextFit} from './domain.mjs';
import {planGrid,gridAssignments,splitMappings} from './grid.mjs';
import {planSections,sectionAssignments} from './sections.mjs';
import {downloadableArtifact} from './artifacts.mjs';
import {readWorkbook} from './workbook.mjs';
import {unpackTemplate,packageOutput} from './archives.mjs';
import {validatePhotoMapping} from './photos.mjs';
import {importImageAssets,readImageLibrary,publicImageLibrary,resolveImage,preparePhotoRecords} from './image-assets.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version:VERSION}=JSON.parse(await fs.readFile(path.join(ROOT,'package.json'),'utf8'));
const LOCAL=path.resolve(process.env.ROWCRAFT_DATA_DIR||path.join(ROOT,'.local'));const PORT=Number(process.env.PORT||4317);
for(const d of ['uploads','workbooks','templates','jobs','images'])await fs.mkdir(path.join(LOCAL,d),{recursive:true});
const token=crypto.randomBytes(24).toString('hex');
let closing=false;
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'4mb'}));
if(process.env.ROWCRAFT_DESKTOP==='1')app.use((req,res,next)=>{
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options','nosniff');next();
});
app.use('/api',(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  const origin=req.get('origin');
  const localOrigins=[`http://127.0.0.1:${req.socket.localPort}`,`http://localhost:${req.socket.localPort}`];
  if(process.env.ROWCRAFT_DESKTOP!=='1')localOrigins.push('http://127.0.0.1:5173','http://localhost:5173');
  if(!localOrigins.includes(`http://${req.get('host')}`)||origin&&!localOrigins.includes(origin))return res.status(403).json({error:'This application accepts requests from its local interface only.'});
  if(req.method!=='GET'&&req.get('x-cover-studio-token')!==token)return res.status(403).json({error:'Refresh the page before continuing.'});
  if(closing&&req.method!=='GET')return res.status(503).json({error:'RowCraft is closing. Reopen it to start another batch.'});
  next();
});
const upload=multer({dest:path.join(LOCAL,'uploads'),limits:{fileSize:160*1024*1024,files:1}});
const imageUpload=multer({dest:path.join(LOCAL,'uploads'),limits:{fileSize:20*1024*1024,files:20,fieldSize:128*1024}});
function run(command,args,options={}){
  return new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd:LOCAL,windowsHide:true,...options});let stdout='',stderr='';p.stdout.on('data',d=>{stdout+=d;if(stdout.length>32*1024*1024)p.kill();});p.stderr.on('data',d=>stderr+=d);p.on('error',e=>reject(new Error(`Cannot start ${path.basename(command)}: ${e.message}`)));p.on('close',code=>code===0?resolve(stdout):reject(new Error(stderr.trim()||stdout.trim()||`Renderer exited with code ${code}`)));});
}
const readJSON=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const writeJSON=async(p,data)=>fs.writeFile(p,JSON.stringify(data,null,2),'utf8');
const key=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid local resource');return id;};
async function book(id){return readJSON(path.join(LOCAL,'workbooks',`${key(id)}.json`));}
async function template(id){return readJSON(path.join(LOCAL,'templates',key(id),'template.json'));}
let queue=Promise.resolve(),pendingJobs=0;const statuses=new Map();
function enqueue(type,work){
  if(closing)throw Error('RowCraft is closing. Reopen it to start another batch.');
  const id=crypto.randomUUID(),dir=path.join(LOCAL,'jobs',id);
  const status={id,type,status:'queued',message:'Waiting for the Illustrator worker',progress:0,createdAt:new Date().toISOString(),createdAtSource:'recorded'};statuses.set(id,status);
  pendingJobs++;
  queue=queue.catch(()=>{}).then(async()=>{
    await fs.mkdir(dir,{recursive:true});Object.assign(status,{status:'running',message:type==='inspect'?'Opening template in Illustrator':'Generating personalized covers'});await writeJSON(path.join(dir,'status.json'),status);
    try{const result=await work(dir,status);Object.assign(status,{status:'complete',progress:100,message:'Complete',result});}
    catch(e){Object.assign(status,{status:'failed',message:e.message,error:e.message});}
    await writeJSON(path.join(dir,'status.json'),status);
  }).finally(()=>{pendingJobs--;});return status;
}
async function illustrator(request,dir){
  if(!supportsIllustrator())throw Error('Native Illustrator generation requires Windows or macOS and an installed Illustrator desktop application.');
  await writeJSON(path.join(dir,'request.json'),request);
  const script=path.join(dir,'worker.jsx');
  await fs.copyFile(path.join(ROOT,'server','illustrator.jsx'),script);
  const invocation=illustratorInvocation(script);
  try{await run(invocation.command,invocation.args,invocation.options);}catch(error){throw Error(illustratorHostError(error.message));}
  const result=await readJSON(path.join(dir,'response.json'));
  if(result.error)throw Error(result.error);
  return result;
}
async function importWorkbook(source,name){
  const result=await readWorkbook(source);
  const id=crypto.randomUUID(),data={id,name,...result};
  await writeJSON(path.join(LOCAL,'workbooks',`${id}.json`),data);return data;
}
function importTemplate(source,name,assetsRoot){
  const id=crypto.randomUUID(),dir=path.join(LOCAL,'templates',id);
  return enqueue('inspect',async(jobDir)=>{
    await fs.mkdir(dir,{recursive:true});
    const result=await illustrator({operation:'inspect',source,assetsRoot,outputDir:dir},jobDir);
    const data={id,name,source,assetsRoot,...result,preset:null};await writeJSON(path.join(dir,'template.json'),data);
    return publicTemplate(data);
  });
}
function publicTemplate(t){const {source,assetsRoot,...rest}=t;return {...rest,artboards:t.artboards.map((a,i)=>({...a,preview:`/api/templates/${t.id}/preview/${i}`}))};}
app.get('/api/session',(req,res)=>res.json({token,platform:process.platform,nativeAvailable:supportsIllustrator()&&process.env.ROWCRAFT_NATIVE_AVAILABLE!=='0'}));
app.get('/api/health',(req,res)=>res.json({ok:true,version:VERSION,singleAi:true,renderer:'Illustrator desktop',platform:process.platform}));
app.post('/api/images',imageUpload.array('files',20),async(req,res)=>{
  try{
    if(!req.files?.length)throw Error('Choose images from your computer.');
    const names=req.body.names?JSON.parse(req.body.names):req.files.map(file=>file.originalname);
    if(!Array.isArray(names)||names.length!==req.files.length||names.some(name=>typeof name!=='string'))throw Error('Image filenames do not match the uploads.');
    res.json(await importImageAssets(LOCAL,req.files,names,req.body.libraryId));
  }finally{await Promise.all((req.files||[]).map(file=>fs.rm(file.path,{force:true})));}
});
app.get('/api/images/library/:id',async(req,res)=>res.json(publicImageLibrary(await readImageLibrary(LOCAL,key(req.params.id)))));
app.get('/api/images/library/:id/:assetId',async(req,res)=>{
  const library=await readImageLibrary(LOCAL,key(req.params.id)),asset=library.assets.find(item=>item.id===key(req.params.assetId));
  if(!asset)return res.sendStatus(404);res.sendFile(path.join(LOCAL,'images','libraries',library.id,asset.thumbnail),{dotfiles:'allow'});
});
app.get('/api/images/remote/:hash',async(req,res)=>{
  if(!/^[a-f0-9]{64}$/.test(req.params.hash))return res.sendStatus(404);
  res.sendFile(path.join(LOCAL,'images','remote',req.params.hash,'image-preview.png'),{dotfiles:'allow'});
});
app.post('/api/images/resolve',async(req,res)=>{
  if(typeof req.body.reference!=='string'||req.body.reference.length>4096)throw Error('Choose an image reference.');
  try{const asset=await resolveImage(LOCAL,req.body.reference,req.body.libraryId);res.json(asset?{available:true,asset:{id:asset.id,name:asset.name,width:asset.width,height:asset.height,preview:asset.preview}}:{available:false,message:'This row has no image. The original image will stay.'});}
  catch(error){res.json({available:false,message:'Original image will stay. '+error.message});}
});
app.post('/api/workbooks',upload.single('file'),async(req,res)=>{
  if(!req.file)throw Error('Choose an Excel workbook or CSV file.');
  const ext=path.extname(req.file.originalname).toLowerCase();if(!['.xlsx','.csv'].includes(ext))throw Error('Use an XLSX or CSV file. Save older XLS workbooks as XLSX first.');
  const source=req.file.path+ext;await fs.rename(req.file.path,source);res.json(await importWorkbook(source,req.file.originalname));
});
app.post('/api/templates',upload.single('file'),async(req,res)=>{
  if(!req.file)throw Error('Choose an AI file or packaged template ZIP.');
  const ext=path.extname(req.file.originalname).toLowerCase();if(!['.ai','.zip'].includes(ext))throw Error('Choose an AI file or a ZIP containing one AI file and its linked assets.');
  const uploadFolder=path.join(LOCAL,'uploads',crypto.randomUUID());await fs.mkdir(uploadFolder,{recursive:true});
  const source=path.join(uploadFolder,'template'+ext);await fs.rename(req.file.path,source);
  let target=source,assetsRoot=path.dirname(source);
  // The supplied project is already authorized and includes its complete asset package.
  // Recognize that exact template when the user uploads its AI file by itself.
  if(ext==='.ai'){
    const supplied=path.resolve(ROOT,'..','illustrations','Stop & Shop Trade Letter');const original=path.join(supplied,'Stop & Shop Trade Letter.ai');
    if(existsSync(original)){
      const [a,b]=await Promise.all([fs.readFile(source),fs.readFile(original)]);
      if(crypto.createHash('sha256').update(a).digest('hex')===crypto.createHash('sha256').update(b).digest('hex'))assetsRoot=supplied;
    }
  }
  if(ext==='.zip'){const pack=await unpackTemplate(source,source+'_assets');target=pack.template;assetsRoot=pack.assetsRoot;}
  const job=importTemplate(target,req.file.originalname,assetsRoot);res.status(202).json(job);
});
app.get('/api/templates',async(req,res)=>{
  const dirs=await fs.readdir(path.join(LOCAL,'templates'));const result=[];
  for(const id of dirs){try{result.push(publicTemplate(await template(id)));}catch{}}
  const ranked=await Promise.all(result.map(async t=>({t,time:(await fs.stat(path.join(LOCAL,'templates',t.id,'template.json'))).mtimeMs})));res.json(ranked.sort((a,b)=>b.time-a.time).map(x=>x.t));
});
app.get('/api/templates/:id/preview/:index',async(req,res)=>{
  const t=await template(req.params.id),index=Number(req.params.index);
  if(!Number.isInteger(index)||!t.artboards[index])return res.sendStatus(404);
  res.sendFile(path.join(LOCAL,'templates',t.id,`artboard-${index}.png`),{dotfiles:'allow'});
});
app.post('/api/templates/:id/preset',async(req,res)=>{
  const t=await template(req.params.id);const {name,artboard,mappings,columns,layout}=req.body;
  if(typeof name!=='string'||!name.trim()||!Array.isArray(columns))throw Error('Name this mapping preset.');
  const sample=t.artboards[artboard]?.cards?.find(card=>card.id===layout?.cardId),photo=validatePhotoMapping(req.body.photo,sample,columns);
  const checked=validateMappings(mappings,t,artboard,columns,{allowEmpty:!!photo});
  planGrid(t,artboard,{...layout,photo},checked,1);
  t.preset={name:name.trim().slice(0,100),artboard,layout:{cardId:layout.cardId},mappings:checked.map(m=>({...m,columnName:columns[m.column]})),photo:photo?{source:photo.source,targetId:photo.targetId,column:photo.column,columnName:columns[photo.column],libraryId:photo.libraryId,assetId:photo.assetId,adjustment:photo.adjustment}:null};
  await writeJSON(path.join(LOCAL,'templates',t.id,'template.json'),t);res.json(publicTemplate(t));
});
app.post('/api/templates/:id/analyze',async(req,res)=>{
  const t=await template(req.params.id),dir=path.join(LOCAL,'templates',t.id);
  res.status(202).json(enqueue('inspect',async jobDir=>{
    const result=await illustrator({operation:'inspect',source:t.source,assetsRoot:t.assetsRoot,outputDir:dir},jobDir);
    const updated={...t,...result,preset:null};await writeJSON(path.join(dir,'template.json'),updated);return publicTemplate(updated);
  }));
});
app.post('/api/jobs',async(req,res)=>{
  const {workbookId,templateId,sheetName,recordIds,artboard,mappings,proof,includePdf=true,layout}=req.body;
  const textFit=validateTextFit(req.body.textFit);
  const w=await book(workbookId),t=await template(templateId);
  if(req.body.sections!==undefined){
    if(t.missingLinks?.length)throw Error('Resolve missing linked images before exporting.');
    const fullPlan=planSections(t,w,sheetName,req.body.sections),plan=proof?planSections(t,w,sheetName,req.body.sections,{proof:true}):fullPlan;
    const job=enqueue(proof?'proof':'generate',async(dir,status)=>{
      const outputDir=path.join(dir,'output');await fs.mkdir(outputDir,{recursive:true});
      const imageWarnings=[];
      for(const section of plan.sections){const prepared=await preparePhotoRecords(LOCAL,section.photo,section.records,dir,{progress:(done,total)=>Object.assign(status,{message:`Checking ${section.name} images (${done}/${total})`,progress:Math.round(done/total*15)})});section.photo=prepared.photo;imageWarnings.push(...prepared.warnings.map(warning=>section.name+': '+warning));}
      const result=await illustrator({operation:'generate-sections',source:t.source,assetsRoot:t.assetsRoot,sectionPlan:plan,textFit,includePdf:!!includePdf,outputDir,metadata:t},dir);
      result.warnings=[...imageWarnings,...(result.warnings||[])];
      await fs.stat(path.join(outputDir,'personalized-covers.ai'));if(includePdf)await fs.stat(path.join(outputDir,'personalized-covers.pdf'));
      await writeJSON(path.join(outputDir,'manifest.json'),{workbook:w.name,sheet:sheetName,template:t.name,mode:'sections',pages:plan.pageCount,textFit,sections:plan.sections.map(s=>({id:s.id,name:s.name,artboard:s.artboard+1,box:s.box,cardsPerPage:s.capacity,count:s.records.length,mappings:s.mappings,labels:s.labels})),records:sectionAssignments(plan),warnings:result.warnings||[]});
      await packageOutput(outputDir,path.join(dir,'covers.zip'));
      const base=`/api/jobs/${path.basename(dir)}`;return {count:plan.count,pages:plan.pageCount,ai:base+'/ai',archive:base+'/download',pdf:includePdf?base+'/pdf':null,folder:outputDir,proof:!!proof,warnings:result.warnings||[],previews:result.previews.map(name=>base+'/preview/'+name)};
    });return res.status(202).json(job);
  }
  const selection=selectedRecords(w,sheetName,recordIds);
  const sample=t.artboards[artboard]?.cards?.find(card=>card.id===layout?.cardId),photo=validatePhotoMapping(req.body.photo,sample,selection.sheet.columns);
  const checked=validateMappings(mappings,t,artboard,selection.sheet.columns,{allowEmpty:!!photo});
  const fullPlan=planGrid(t,artboard,{...layout,photo},checked,selection.rows.length);
  const rows=proof?selection.rows.slice(0,fullPlan.capacity):selection.rows;
  const grid=planGrid(t,artboard,{...layout,photo},checked,rows.length),parts=splitMappings(grid,checked);
  if(t.missingLinks?.length)throw Error('Resolve missing linked images before exporting.');
  const job=enqueue(proof?'proof':'generate',async(dir,status)=>{
    const outputDir=path.join(dir,'output');await fs.mkdir(outputDir,{recursive:true});
    const prepared=await preparePhotoRecords(LOCAL,photo,rows,dir,{progress:(done,total)=>Object.assign(status,{message:`Checking card images (${done}/${total})`,progress:Math.round(done/total*15)})});
    const result=await illustrator({operation:'generate',source:t.source,assetsRoot:t.assetsRoot,artboard,mappings:parts.card,pageMappings:parts.page,records:rows,photo:prepared.photo,grid,textFit,includePdf:!!includePdf,outputDir,metadata:t},dir);
    result.warnings=[...prepared.warnings,...(result.warnings||[])];
    await fs.stat(path.join(outputDir,'personalized-covers.ai'));
    if(includePdf)await fs.stat(path.join(outputDir,'personalized-covers.pdf'));
    await writeJSON(path.join(outputDir,'manifest.json'),{workbook:w.name,sheet:sheetName,template:t.name,artboard:artboard+1,columns:selection.sheet.columns,cardsPerPage:grid.capacity,pages:grid.pages,textFit,records:gridAssignments(grid,rows),mappings:checked,photos:prepared.stats,warnings:result.warnings||[]});
    const archive=path.join(dir,'covers.zip');await packageOutput(outputDir,archive);
    const base=`/api/jobs/${path.basename(dir)}`;
    return {count:rows.length,pages:grid.pages,ai:base+'/ai',archive:base+'/download',pdf:includePdf?base+'/pdf':null,folder:outputDir,proof:!!proof,warnings:result.warnings||[],previews:result.previews.map(name=>base+'/preview/'+name)};
  });res.status(202).json(job);
});
async function withCreatedTime(state){
  if(state.createdAt)return state;
  // Legacy batches predate stored timestamps. Do not substitute their last-modified time.
  try{const stats=await fs.stat(path.join(LOCAL,'jobs',state.id));if(stats.birthtimeMs>0)return {...state,createdAt:stats.birthtime.toISOString(),createdAtSource:'folder'};}catch{}
  return state;
}
app.get('/api/jobs',async(req,res)=>{
  const dirs=await fs.readdir(path.join(LOCAL,'jobs')),completed=[];
  for(const id of dirs){if(!/^[a-f0-9-]{36}$/.test(id))continue;try{const s=statuses.get(id)||await readJSON(path.join(LOCAL,'jobs',id,'status.json'));if(s.status==='complete'&&s.type!=='inspect'&&await downloadableArtifact(LOCAL,id,s,'archive'))completed.push({s,time:(await fs.stat(path.join(LOCAL,'jobs',id,'status.json'))).mtimeMs});}catch{}}
  res.json(await Promise.all(completed.sort((a,b)=>b.time-a.time).slice(0,30).map(x=>withCreatedTime(x.s))));
});
app.get('/api/jobs/:id',async(req,res)=>{
  const id=key(req.params.id);let state=statuses.get(id);if(!state){try{state=await readJSON(path.join(LOCAL,'jobs',id,'status.json'));}catch{return res.sendStatus(404);}}
  state=await withCreatedTime(state);
  if(state.status==='running'){try{const native=await readJSON(path.join(LOCAL,'jobs',id,'progress.json'));return res.json({...state,...native});}catch{}}
  res.json(state);
});
for(const [route,kind,filename] of [['ai','ai','personalized-covers.ai'],['pdf','pdf','personalized-covers.pdf'],['download','archive','personalized-covers.zip']])app.get('/api/jobs/:id/'+route,async(req,res)=>{
  const id=key(req.params.id);let s=statuses.get(id);try{s=s||await readJSON(path.join(LOCAL,'jobs',id,'status.json'));}catch{return res.status(404).json({error:'This batch was not found.'});}
  const file=await downloadableArtifact(LOCAL,id,s,kind);if(!file)return res.status(404).json({error:'This file is not available. Finish or regenerate the batch first.'});res.download(file,filename,{dotfiles:'allow'});
});
app.get('/api/jobs/:id/preview/:name',async(req,res)=>{const id=key(req.params.id),name=req.params.name;if(!/^(?:page-\d{4}|\d{4}_[a-zA-Z0-9_-]+)$/.test(name))return res.sendStatus(404);res.sendFile(path.join(LOCAL,'jobs',id,'output',name+'.png'),{dotfiles:'allow'});});
app.post('/api/demo/workbook',async(req,res)=>{const source=path.resolve(ROOT,'..','excel','Q1 2026 Data for Trade Letter.xlsx');if(!existsSync(source))throw Error('The sample workbook is not bundled. Upload your own XLSX or CSV file.');res.json(await importWorkbook(source,'Q1 2026 Data for Trade Letter.xlsx'));});
app.post('/api/demo/template',async(req,res)=>{const folder=path.resolve(ROOT,'..','illustrations','Stop & Shop Trade Letter');if(!existsSync(path.join(folder,'Stop & Shop Trade Letter.ai')))throw Error('The sample design is not bundled. Upload your AI file, or a ZIP with its linked images.');res.status(202).json(importTemplate(path.join(folder,'Stop & Shop Trade Letter.ai'),'Stop & Shop Trade Letter.ai',folder));});
app.use('/api',(req,res)=>res.status(404).json({error:'This API route was not found. Start the current version of RowCraft and refresh.'}));
app.use(express.static(path.join(ROOT,'dist')));
app.use((error,req,res,next)=>{console.error(error.message);res.status(error instanceof multer.MulterError?413:400).json({error:error.message||'The request failed.'});});
if(process.env.COVER_STUDIO_NO_LISTEN!=='1')app.listen(PORT,'127.0.0.1',()=>console.log(`RowCraft API: http://127.0.0.1:${PORT}`));
const activeJobs=()=>pendingJobs;
const prepareShutdown=()=>{const count=activeJobs();if(!count)closing=true;return count;};
export {app,activeJobs,prepareShutdown};
