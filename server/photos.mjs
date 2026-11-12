/** Shared, resolution-independent photo geometry for browser preview and export. */
export const DEFAULT_PHOTO={fit:'fill',x:.5,y:.5,zoom:1};
const clamp=value=>Math.max(0,Math.min(1,value));
export function validateAdjustment(value=DEFAULT_PHOTO){
 if(!value||!['fit','fill'].includes(value.fit)||![value.x,value.y,value.zoom].every(Number.isFinite)||value.x<0||value.x>1||value.y<0||value.y>1||value.zoom<1||value.zoom>4)throw Error('Choose Fit or Fill, a zoom from 1 to 4, and an image position inside the frame.');
 return {fit:value.fit,x:value.x,y:value.y,zoom:value.zoom};
}
export function photoLayout(frameWidth,frameHeight,width,height,adjustment=DEFAULT_PHOTO){
 const a=validateAdjustment(adjustment);
 if(![frameWidth,frameHeight,width,height].every(value=>Number.isFinite(value)&&value>0))throw Error('Photo and frame dimensions must be positive.');
 const scale=(a.fit==='fit'?Math.min(frameWidth/width,frameHeight/height):Math.max(frameWidth/width,frameHeight/height))*a.zoom;
 const w=width*scale,h=height*scale;
 return {width:w,height:h,left:(frameWidth-w)*a.x,top:(frameHeight-h)*a.y};
}
export function photoPosition(frameWidth,frameHeight,layout,left,top,adjustment){
 const dx=frameWidth-layout.width,dy=frameHeight-layout.height;
 return {...adjustment,x:Math.abs(dx)<.001?.5:clamp(left/dx),y:Math.abs(dy)<.001?.5:clamp(top/dy)};
}
export function validatePhotoMapping(input,sample,columns){
 if(!input||input.source==='keep')return null;
 if(!['column','shared'].includes(input.source))throw Error('Choose an Excel image column or a shared image.');
 const target=sample?.photos?.find(photo=>photo.id===input.targetId);
 if(!target)throw Error('Choose a photo area in the sample card. Analyze this template again if its photo areas are missing.');
 if(input.source==='column'&&(!Number.isInteger(input.column)||input.column<0||input.column>=columns.length))throw Error('Choose an existing Excel image column.');
 if(input.libraryId!==undefined&&!/^[a-f0-9-]{36}$/.test(input.libraryId))throw Error('Choose the image folder again.');
 if(input.source==='shared'&&(!input.libraryId||!/^[a-f0-9-]{36}$/.test(input.assetId||'')))throw Error('Upload the shared image first.');
 const overrides={};
 if(input.overrides!==undefined){
  if(!input.overrides||Array.isArray(input.overrides)||typeof input.overrides!=='object'||Object.keys(input.overrides).length>5000)throw Error('Invalid per-person photo adjustments.');
  for(const [id,value]of Object.entries(input.overrides)){if(id.length>200||id==='__proto__'||id==='constructor')throw Error('Invalid photo record ID.');overrides[id]=validateAdjustment(value);}
 }
 return {source:input.source,targetId:target.id,target,column:input.source==='column'?input.column:undefined,libraryId:input.libraryId,assetId:input.source==='shared'?input.assetId:undefined,adjustment:validateAdjustment(input.adjustment),overrides:input.source==='column'?overrides:{}};
}
export function imageReference(value){
 const text=String(value??'').trim();if(!text)return {kind:'empty'};
 if(/^https?:\/\//i.test(text))return {kind:'url',value:text};
 let name=text.replaceAll('\\','/');
 if(/^file:\/\//i.test(name)){try{name=decodeURIComponent(new URL(name).pathname);}catch{throw Error('Invalid image file reference');}}
 const parts=name.split('/').filter(Boolean);if(parts.includes('..'))throw Error('Parent-directory image paths are not allowed');
 return {kind:'file',value:name.replace(/^\.\//,''),basename:parts.at(-1)||''};
}
export function findImageAsset(library,value){
 const ref=imageReference(value);if(ref.kind!=='file')return null;
 const name=ref.value.toLowerCase(),assets=library?.assets||[];
 const exact=assets.find(asset=>asset.name.toLowerCase()===name);if(exact)return exact;
 // The most specific imported folder path wins over a duplicate root basename.
 const suffix=assets.filter(asset=>name.endsWith('/'+asset.name.toLowerCase())).sort((a,b)=>b.name.length-a.name.length);
 if(suffix.length&&(!suffix[1]||suffix[0].name.length>suffix[1].name.length))return suffix[0];
 const matches=assets.filter(asset=>asset.name.split('/').at(-1).toLowerCase()===ref.basename.toLowerCase());
 if(matches.length>1)throw Error('Duplicate image filename. Use its relative folder path.');
 if(!matches.length)throw Error('Image not found in the selected folder');return matches[0];
}
