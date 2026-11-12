import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import {DEFAULT_PHOTO,photoLayout,photoPosition,validateAdjustment,validatePhotoMapping,findImageAsset} from '../server/photos.mjs';
import {normalizeImage,importImageAssets,resolveImage,preparePhotoRecords} from '../server/image-assets.mjs';
import {publicImageAddress,imageURL,downloadImage,MAX_IMAGE_BYTES} from '../server/image-download.mjs';
import {planGrid} from '../server/grid.mjs';
import {planSections} from '../server/sections.mjs';
import {readWorkbook} from '../server/workbook.mjs';

async function temporary(t){const root=path.resolve('.local','photo-test-'+crypto.randomUUID());await fs.mkdir(root,{recursive:true});t.after(async()=>{assert.equal(path.dirname(root),path.resolve('.local'));await fs.rm(root,{recursive:true,force:true});});return root;}
const image=()=>sharp({create:{width:300,height:100,channels:3,background:'#ee6633'}}).png().toBuffer();
const photo={id:'photo-1',path:[1],x:.1,y:.2,width:.2,height:.1};
const card={id:'card',groupIndex:0,family:'people',x:.1,y:.2,width:.3,height:.3,targetIds:['name'],photos:[photo]};

test('Fill, Fit and dragging preserve aspect ratio and normalize across preview/export sizes',()=>{
 assert.deepEqual(photoLayout(100,100,300,100),{width:300,height:100,left:-100,top:0});
 const fit=photoLayout(100,100,300,100,{...DEFAULT_PHOTO,fit:'fit'});assert.equal(fit.width,100);assert.ok(Math.abs(fit.height-100/3)<1e-10);assert.ok(Math.abs(fit.top-(100-100/3)/2)<1e-10);
 const l=photoLayout(100,100,300,100),a=photoPosition(100,100,l,-500,100,DEFAULT_PHOTO);assert.equal(a.x,1);assert.equal(a.y,.5);
 const preview=photoLayout(123,81,1200,800,{fit:'fill',x:.27,y:.8,zoom:1.8}),native=photoLayout(246,162,1200,800,{fit:'fill',x:.27,y:.8,zoom:1.8});
 for(const k of ['width','height','left','top'])assert.equal(native[k],preview[k]*2);
 for(const value of [{...DEFAULT_PHOTO,x:2},{...DEFAULT_PHOTO,zoom:NaN},{...DEFAULT_PHOTO,fit:'stretch'}])assert.throws(()=>validateAdjustment(value));
});

test('photo mappings cannot target another card; photo-only single and section plans work',()=>{
 const input={source:'column',column:0,targetId:photo.id,adjustment:DEFAULT_PHOTO,overrides:{person:{...DEFAULT_PHOTO,x:.2}}};
 const mapping=validatePhotoMapping(input,card,['Image']);assert.equal(mapping.target,photo);assert.equal(mapping.overrides.person.x,.2);
 assert.equal(validatePhotoMapping(undefined,card,[]),null);
 for(const patch of [{targetId:'foreign'},{column:1},{libraryId:'../../outside'},{overrides:{person:{...DEFAULT_PHOTO,zoom:9}}}])assert.throws(()=>validatePhotoMapping({...input,...patch},card,['Image']));
 assert.throws(()=>validatePhotoMapping({...input,source:'shared'},card,['Image']),/Upload/);
 const board={width:612,height:1008,cards:[card],targets:[{id:'name',index:0,text:'Name'}]},template={artboards:[board]};
 assert.equal(planGrid(template,0,{cardId:card.id,photo:mapping},[],1).recordCount,1);
 const workbook={sheets:[{name:'People',columns:['Image'],rows:[{id:'person',record:1,excelRow:2,values:['photo.jpg']}]}]};
 const section={id:'section',artboard:0,box:{x:0,y:0,width:1,height:1},cardId:card.id,recordIds:['person'],mappings:[],labels:[],photo:input};
 assert.equal(planSections(template,workbook,'People',[section]).sections[0].photo.target.id,photo.id);
 assert.throws(()=>planSections(template,workbook,'People',[{...section,photo:undefined}]),/at least one/);
});

test('image filenames are matched only inside the imported library with ambiguity protection',()=>{
 const library={assets:[{id:'one',name:'north/A.jpg'},{id:'two',name:'south/A.jpg'},{id:'three',name:'B.png'}]};
 assert.equal(findImageAsset(library,'C:\\photos\\north\\a.JPG').id,'one');assert.equal(findImageAsset(library,'B.PNG').id,'three');
 assert.throws(()=>findImageAsset(library,'A.jpg'),/Duplicate/);assert.throws(()=>findImageAsset(library,'../B.png'),/Parent/);assert.throws(()=>findImageAsset(library,'missing.png'),/not found/);
 const nested={assets:[{id:'root',name:'A.jpg'},{id:'nested',name:'team/A.jpg'}]};assert.equal(findImageAsset(nested,'A.jpg').id,'root');assert.equal(findImageAsset(nested,'team/A.jpg').id,'nested');assert.equal(findImageAsset(nested,'C:/photos/team/A.jpg').id,'nested');
});

test('image normalization preserves dimensions, corrects EXIF orientation and rejects invalid/active content',async t=>{
 const root=await temporary(t),png=await normalizeImage(await image(),root,'valid');assert.equal(png.width,300);assert.equal(png.height,100);assert.equal((await sharp(path.join(root,png.thumbnail)).metadata()).format,'png');
 const rotated=await sharp(await image()).jpeg().withMetadata({orientation:6}).toBuffer(),fixed=await normalizeImage(rotated,root,'rotated');assert.equal(fixed.width,100);assert.equal(fixed.height,300);
 await assert.rejects(normalizeImage(Buffer.from('not an image'),root),/unsupported|Input/i);
 await assert.rejects(normalizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),root),/still/);
 await assert.rejects(normalizeImage(Buffer.alloc(MAX_IMAGE_BYTES+1),root),/20 MB/);
});

test('folder imports, URL cache, missing rows and shared override produce isolated native assets',async t=>{
 const root=await temporary(t),upload=path.join(root,'upload.png');await fs.writeFile(upload,await image());
 const library=await importImageAssets(root,[{path:upload,originalname:'portrait.png'}],['portraits/A.png']);
 const loaded=await resolveImage(root,'C:\\images\\portraits\\A.png',library.id);assert.equal(loaded.width,300);assert.match(loaded.preview,/\/api\/images\/library\//);
 let downloads=0;const fetchImage=async()=>{downloads++;return image();};
 const rows=['portraits/A.png','','missing.png','https://example.org/photo.png','https://example.org/photo.png'].map((value,i)=>({id:'row'+i,record:i+1,values:[value]}));
 const prepared=await preparePhotoRecords(root,{source:'column',column:0,libraryId:library.id},rows,path.join(root,'job'),{fetchImage});
 assert.deepEqual(prepared.stats,{replaced:3,retained:2});assert.equal(downloads,1);assert.equal(prepared.photo.paths.row1,undefined);assert.equal(prepared.photo.paths.row2,undefined);assert.equal(prepared.photo.paths.row3,prepared.photo.paths.row4);assert.match(prepared.warnings.join(' '),/Record 3/);
 const again=await resolveImage(root,rows[3].values[0],undefined,{fetchImage});assert.equal(downloads,1);assert.ok(again.file);
 const shared=await preparePhotoRecords(root,{source:'shared',libraryId:library.id,assetId:library.assets[0].id},rows,path.join(root,'shared'));
 assert.deepEqual(shared.stats,{replaced:5,retained:0});assert.equal(new Set(Object.values(shared.photo.paths)).size,1);
 await assert.rejects(resolveImage(root,'C:\\Windows\\win.ini'),/not found/);
});

test('failed URL downloads deduplicate, retain original images and allow a later retry',async t=>{
 const root=await temporary(t),rows=[1,2].map(record=>({id:String(record),record,values:['https://example.org/a.png']}));let requests=0;
 const prepared=await preparePhotoRecords(root,{source:'column',column:0},rows,path.join(root,'job'),{fetchImage:async()=>{requests++;throw Error('Unavailable');}});
 assert.equal(requests,1);assert.deepEqual(prepared.stats,{replaced:0,retained:2});assert.equal(Object.keys(prepared.photo.paths).length,0);
 assert.ok(await resolveImage(root,rows[0].values[0],undefined,{fetchImage:async()=>image()}));
});

test('download protection rejects private IPv4/IPv6, mixed DNS and unsafe schemes',async()=>{
 for(const address of ['127.0.0.1','10.0.0.1','192.168.2.1','169.254.169.254','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(publicImageAddress(address),false,address);
 assert.equal(publicImageAddress('8.8.8.8'),true);assert.equal(publicImageAddress('2606:4700:4700::1111'),true);
 for(const url of ['http://example.org/a.png','file:///x.png','https://u:p@example.org/a','https://example.org:444/a'])assert.throws(()=>imageURL(url));
 await assert.rejects(downloadImage('https://example.org/a',{resolve:async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}],request:()=>{throw Error('Must not connect');}}),/public/);
});

test('HTTPS requests pin the validated IP and revalidate redirects before connecting',async()=>{
 let calls=0;function request(url,options,callback){const req=new EventEmitter();req.destroy=error=>{req.emit('error',error);req.emit('close');};queueMicrotask(()=>{
  options.lookup('example.org',{},(_,address,family)=>{assert.equal(address,'8.8.8.8');assert.equal(family,4);});calls++;
  const res=Readable.from([Buffer.from('photo')]);res.statusCode=calls===1?302:200;res.headers=calls===1?{location:'https://127.0.0.1/private'}:{};callback(res);res.once('end',()=>req.emit('close'));
 });return req;}
 await assert.rejects(downloadImage('https://example.org/a',{resolve:async()=>[{address:'8.8.8.8',family:4}],request}),/public/);assert.equal(calls,1);
 calls=1;assert.equal((await downloadImage('https://example.org/a',{resolve:async()=>[{address:'8.8.8.8',family:4}],request})).toString(),'photo');
});

test('Excel hyperlink image cells keep their displayed text and resolve through a separate image reference',async t=>{
 const root=await temporary(t),file=path.join(root,'links.xlsx'),wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('People');sheet.addRow(['Name','Image']);sheet.addRow(['Ali',{text:'View photo',hyperlink:'https://example.org/a.png'}]);await wb.xlsx.writeFile(file);
 const result=await readWorkbook(file);assert.equal(result.sheets[0].rows[0].values[1],'View photo');assert.equal(result.sheets[0].rows[0].imageRefs[1],'https://example.org/a.png');
});
