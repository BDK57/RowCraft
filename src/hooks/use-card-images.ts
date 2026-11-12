import {useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import type {Card,Sheet,ImageLibrary,PhotoAdjustment,PhotoMapping} from '@/lib/types';
import {DEFAULT_PHOTO} from '../../server/photos.mjs';

export function useCardImages(sheet:Sheet|undefined){
 const [source,setSource]=useState<'keep'|'column'|'shared'>('keep'),[column,setColumn]=useState(-1),[targetId,setTargetId]=useState('');
 const [library,setLibrary]=useState<ImageLibrary|null>(null),[shared,setShared]=useState<ImageLibrary|null>(null);
 const [sharedAdjustment,setSharedAdjustment]=useState<PhotoAdjustment>({...DEFAULT_PHOTO});
 const [overrides,setOverrides]=useState<Record<string,Record<string,PhotoAdjustment>>>({});
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setSource('keep');setColumn(-1);setOverrides({});setTargetId('');setLoading(false);setError('');},[sheet]);
 function build(card:Card|undefined,scope:string,chosen?:string,recordIds?:string[]):PhotoMapping|undefined{
  if(source==='keep')return undefined;
  const photoId=chosen||card?.photos?.[0]?.id||'',saved=overrides[scope+':'+photoId]||{};
  return {source,targetId:photoId,column:source==='column'?column:undefined,libraryId:source==='shared'?shared?.id:library?.id,assetId:source==='shared'?shared?.assets[0]?.id:undefined,adjustment:source==='shared'?sharedAdjustment:{...DEFAULT_PHOTO},overrides:source==='column'?Object.fromEntries(Object.entries(saved).filter(([id])=>!recordIds||recordIds.includes(id))):undefined};
 }
 function adjustment(scope:string,photoId:string,rowId:string){return source==='shared'?sharedAdjustment:overrides[scope+':'+photoId]?.[rowId]||DEFAULT_PHOTO;}
 function adjust(scope:string,photoId:string,rowId:string,value:PhotoAdjustment){
  if(source==='shared')setSharedAdjustment(value);
  else setOverrides(current=>({...current,[scope+':'+photoId]:{...current[scope+':'+photoId],[rowId]:value}}));
 }
 async function upload(files:File[],all:boolean,onProgress:(done:number,total:number)=>void){
  const images=files.filter(file=>/\.(png|jpe?g|webp|tiff?|gif|avif)$/i.test(file.name));
  if(!images.length)throw Error('Choose JPG, PNG, WebP, TIFF or AVIF images.');if(images.length>5000)throw Error('Choose at most 5,000 images.');
  let imported:ImageLibrary|undefined;
  for(let i=0;i<images.length;i+=20){
   const batch=images.slice(i,i+20),form=new FormData();batch.forEach(file=>form.append('files',file));
   form.append('names',JSON.stringify(batch.map(file=>file.webkitRelativePath?file.webkitRelativePath.split('/').slice(1).join('/'):file.name)));
   if(imported)form.append('libraryId',imported.id);onProgress(Math.min(i+20,images.length),images.length);imported=await api<ImageLibrary>('/api/images',form);
  }
  if(all){setShared(imported!);setSharedAdjustment({...DEFAULT_PHOTO});setSource('shared');}else{setLibrary(imported!);setSource('column');}
 }
 async function restore(photo:PhotoMapping|null|undefined){
  const id=++generation.current;setError('');setLoading(false);setTargetId(photo?.targetId||'');
  if(!photo){setSource('keep');return;}
  const col=sheet?.columns.indexOf(photo.columnName||'')??-1;setColumn(col);
  if(photo.source==='column'&&col<0){setSource('keep');return;}
  setSource(photo.source);setSharedAdjustment(photo.adjustment||{...DEFAULT_PHOTO});
  if(photo.libraryId){
   setLoading(true);if(photo.source==='shared')setShared(null);else setLibrary(null);
   try{const loaded=await api<ImageLibrary>('/api/images/library/'+photo.libraryId);if(id!==generation.current)return;if(photo.source==='shared')setShared(loaded);else setLibrary(loaded);}
   catch{if(id===generation.current){setSource('keep');setError('Saved images are unavailable. Choose your image folder or upload the shared image again.');}}
   finally{if(id===generation.current)setLoading(false);}
  }
 }
 return {source,setSource,column,setColumn,targetId,setTargetId,library,shared,sharedAdjustment,overrides,loading,error,build,adjustment,adjust,upload,restore};
}
