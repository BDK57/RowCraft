import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {imageReference,findImageAsset} from './photos.mjs';
import {downloadImage,MAX_IMAGE_BYTES} from './image-download.mjs';
const checkId=value=>{if(!/^[a-f0-9-]{36}$/.test(value||''))throw Error('Invalid image library');return value;};
const MAX_LIBRARY_BYTES=2*1024*1024*1024;
const inflight=new Map();
export async function normalizeImage(input,folder,id=crypto.randomUUID()){
 const bytes=Buffer.isBuffer(input)?input:await fs.readFile(input);if(bytes.length>MAX_IMAGE_BYTES)throw Error('Each image must be at most 20 MB');
 const options={limitInputPixels:40000000,failOn:'error'};let metadata;
 try{metadata=await sharp(bytes,options).metadata();}catch{throw Error('Unsupported image file. Choose a valid image with at most 40 million pixels.');}
 if(!['jpeg','png','webp','tiff','gif','avif'].includes(metadata.format)||metadata.pages>1)throw Error('Choose a still JPG, PNG, WebP, TIFF or AVIF image');
 await fs.mkdir(folder,{recursive:true});
 const filename=id+(metadata.hasAlpha?'.png':'.jpg'),file=path.join(folder,filename),thumbnail=id+'-preview.png';
 try{
  let image=sharp(bytes,options).rotate().toColourspace('srgb');image=metadata.hasAlpha?image.png():image.jpeg({quality:95,chromaSubsampling:'4:4:4'});
  const info=await image.toFile(file);
  await sharp(file).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).png().toFile(path.join(folder,thumbnail));
  return {filename,thumbnail,width:info.width,height:info.height,bytes:info.size};
 }catch(error){await Promise.all([fs.rm(file,{force:true}),fs.rm(path.join(folder,thumbnail),{force:true})]);throw error;}
}
export async function readImageLibrary(local,id){return JSON.parse(await fs.readFile(path.join(local,'images','libraries',checkId(id),'library.json'),'utf8'));}
export function publicImageLibrary(library){return {id:library.id,bytes:library.bytes,assets:library.assets.map(({filename,thumbnail,...asset})=>({...asset,preview:`/api/images/library/${library.id}/${asset.id}`}))};}
export async function importImageAssets(local,files,names,libraryId){
 const id=libraryId?checkId(libraryId):crypto.randomUUID(),folder=path.join(local,'images','libraries',id);
 const previous=libraryId?await readImageLibrary(local,id):{id,assets:[],bytes:0};const added=[];
 try{
  if(previous.assets.length+files.length>5000)throw Error('Choose at most 5,000 images');
  for(let i=0;i<files.length;i++){
   const name=String(names[i]||files[i].originalname).replaceAll('\\','/');
   if(!name||name.startsWith('/')||name.includes(':')||name.split('/').some(part=>!part||part==='..'||part==='.'))throw Error('Use image paths relative to the selected folder');
   if([...previous.assets,...added].some(asset=>asset.name.toLowerCase()===name.toLowerCase()))throw Error('Duplicate image filename: '+name);
   const assetId=crypto.randomUUID(),data=await normalizeImage(files[i].path,folder,assetId);added.push({id:assetId,name,...data});
   if(previous.bytes+added.reduce((sum,a)=>sum+a.bytes,0)>MAX_LIBRARY_BYTES)throw Error('Image library exceeds 2 GB');
  }
  const library={id,assets:[...previous.assets,...added],bytes:previous.bytes+added.reduce((sum,a)=>sum+a.bytes,0)};
  const temp=path.join(folder,'library.json.tmp');await fs.writeFile(temp,JSON.stringify(library));await fs.rename(temp,path.join(folder,'library.json'));return publicImageLibrary(library);
 }catch(error){await Promise.all(added.flatMap(asset=>[fs.rm(path.join(folder,asset.filename),{force:true}),fs.rm(path.join(folder,asset.thumbnail),{force:true})]));throw error;}
 finally{await Promise.all(files.map(file=>fs.rm(file.path,{force:true})));}
}
export async function resolveImage(local,reference,libraryId,{fetchImage=downloadImage}={}){
 const ref=imageReference(reference);if(ref.kind==='empty')return null;
 if(ref.kind==='file'){
  const library=libraryId?await readImageLibrary(local,libraryId):null,asset=findImageAsset(library,reference);
  return {...asset,file:path.join(local,'images','libraries',library.id,asset.filename),preview:`/api/images/library/${library.id}/${asset.id}`};
 }
 const key=crypto.createHash('sha256').update(ref.value).digest('hex'),folder=path.join(local,'images','remote',key),metadata=path.join(folder,'image.json');
 try{const asset=JSON.parse(await fs.readFile(metadata,'utf8'));await fs.access(path.join(folder,asset.filename));return {...asset,file:path.join(folder,asset.filename),preview:`/api/images/remote/${key}`};}catch{}
 const cacheKey=local+':'+key;
 if(!inflight.has(cacheKey))inflight.set(cacheKey,(async()=>{
  const data=await normalizeImage(await fetchImage(ref.value),folder,'image');
  const asset={id:key,name:'URL image',...data};await fs.writeFile(metadata,JSON.stringify(asset));return {...asset,file:path.join(folder,asset.filename),preview:`/api/images/remote/${key}`};
 })().finally(()=>inflight.delete(cacheKey)));
 return inflight.get(cacheKey);
}
export async function preparePhotoRecords(local,photo,records,dir,{fetchImage=downloadImage,progress=()=>{}}={}){
 if(!photo)return {photo:null,warnings:[],stats:{replaced:0,retained:0}};
 const folder=path.join(dir,'photo-assets');await fs.mkdir(folder,{recursive:true});
 const paths={},warnings=[],stats={replaced:0,retained:0},cache=new Map();let cursor=0,finished=0;
 let shared;
 if(photo.source==='shared'){
  const library=await readImageLibrary(local,photo.libraryId),asset=library.assets.find(item=>item.id===photo.assetId);if(!asset)throw Error('Upload the shared image again');
  shared={...asset,file:path.join(local,'images','libraries',library.id,asset.filename)};
 }
 async function worker(){while(cursor<records.length){const row=records[cursor++];try{
  const reference=row.imageRefs?.[photo.column]??row.values[photo.column];
  if(!shared&&!String(reference||'').trim()){stats.retained++;continue;}
  const cacheKey=shared?'shared:'+photo.libraryId+':'+photo.assetId:String(photo.libraryId||'')+':'+String(reference);
  if(!cache.has(cacheKey))cache.set(cacheKey,(async()=>{
   const asset=shared||await resolveImage(local,reference,photo.libraryId,{fetchImage});
   if(!asset)return null;
   const dest=path.join(folder,crypto.createHash('sha256').update(cacheKey).digest('hex')+path.extname(asset.filename));await fs.copyFile(asset.file,dest);return dest;
  })().then(file=>({file}),error=>({error:error.message})));
  const result=await cache.get(cacheKey);if(result.error)throw Error(result.error);if(result.file){paths[row.id]=result.file;stats.replaced++;}else stats.retained++;
 }catch(error){stats.retained++;if(warnings.length<100)warnings.push(`Record ${row.record}: image unavailable; original kept. ${error.message}`);}finally{progress(++finished,records.length);}}}
 await Promise.all(Array.from({length:Math.min(4,records.length)},worker));
 if(stats.retained)warnings.push(`${stats.retained} cards kept their original image because a row image was blank or unavailable.`);
 return {photo:{...photo,paths},warnings,stats};
}
