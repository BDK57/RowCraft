/** Streaming ZIP handling shared by the browser server and packaged desktop app. */
import fs from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import yauzl from 'yauzl';
import yazl from 'yazl';

const MAX_EXPANDED=512*1024*1024;
export function safeArchivePath(name){
 const normalized=name.replaceAll('\\','/');
 if(!normalized||normalized.startsWith('/')||normalized.includes(':')||normalized.split('/').some(part=>part==='..'||part==='.'||/[. ]$/.test(part)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))throw Error('Unsafe path in template package');
 return normalized;
}
export async function unpackTemplate(source,destination){
 const dest=path.resolve(destination);
 // Never extract into an existing tree, where a pre-existing symlink could escape it.
 await fs.mkdir(dest,{recursive:false});
 try{
  const zip=await new Promise((resolve,reject)=>yauzl.open(source,{lazyEntries:true,validateEntrySizes:true},(error,value)=>error?reject(error):resolve(value)));
  let declared=0,actual=0,count=0;const files=[],seen=new Set();
  await new Promise((resolve,reject)=>{
   let failed=false;
   const fail=error=>{if(failed)return;failed=true;zip.close();reject(error);};
   zip.on('error',fail);zip.on('end',resolve);
   zip.on('entry',entry=>{
    void (async()=>{
     if(++count>10000)throw Error('Template package contains too many entries');
     declared+=entry.uncompressedSize;if(declared>MAX_EXPANDED)throw Error('Package expands beyond 512 MB');
     const name=safeArchivePath(entry.fileName),parts=name.split('/');
     if(parts.includes('__MACOSX')||parts.at(-1).startsWith('._')){zip.readEntry();return;}
     const mode=(entry.externalFileAttributes>>>16)&0xf000;
     if(mode===0xa000)throw Error('Linked files are not allowed in template packages');
     const target=path.resolve(dest,...parts);
     if(!target.startsWith(dest+path.sep))throw Error('Unsafe path in template package');
     if(name.endsWith('/')){await fs.mkdir(target,{recursive:true});zip.readEntry();return;}
     if(seen.has(name.toLowerCase()))throw Error('Duplicate file path in template package');
     seen.add(name.toLowerCase());await fs.mkdir(path.dirname(target),{recursive:true});
     const input=await new Promise((yes,no)=>zip.openReadStream(entry,(error,stream)=>error?no(error):yes(stream)));
     const limit=new Transform({transform(chunk,encoding,callback){actual+=chunk.length;callback(actual>MAX_EXPANDED?Error('Package expands beyond 512 MB'):null,chunk);}});
     await pipeline(input,limit,createWriteStream(target,{flags:'wx'}));files.push(target);zip.readEntry();
    })().catch(fail);
   });zip.readEntry();
  });
  const templates=files.filter(file=>path.extname(file).toLowerCase()==='.ai');
  if(templates.length!==1)throw Error('Package must contain exactly one AI template');
  return {template:templates[0],assetsRoot:dest};
 }catch(error){await fs.rm(dest,{recursive:true,force:true});throw error;}
}
export async function packageOutput(folder,archive){
 const root=path.resolve(folder),target=path.resolve(archive),partial=target+'.partial';
 if(target.startsWith(root+path.sep))throw Error('Save the ZIP outside its source folder');
 const zip=new yazl.ZipFile();
 async function add(dir){
  for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const source=path.join(dir,entry.name);
   if(entry.isSymbolicLink())throw Error('Linked files are not allowed in output packages');
   if(entry.isDirectory())await add(source);
   else if(entry.isFile())zip.addFile(source,path.relative(root,source).split(path.sep).join('/'));
  }
 }
 try{
  zip.on('error',error=>zip.outputStream.destroy(error));
  const writing=pipeline(zip.outputStream,createWriteStream(partial));
  const collecting=add(root).then(()=>zip.end()).catch(error=>{zip.outputStream.destroy(error);throw error;});
  await Promise.all([writing,collecting]);await fs.rename(partial,target);return {archive:target};
 }catch(error){await fs.rm(partial,{force:true});throw error;}
}
