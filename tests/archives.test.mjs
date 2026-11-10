import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import yazl from 'yazl';
import {unpackTemplate,packageOutput,safeArchivePath} from '../server/archives.mjs';
async function temp(t){const base=path.resolve(os.tmpdir()),dir=await fs.mkdtemp(path.join(base,'rowcraft-zip-'));t.after(async()=>{assert.equal(path.dirname(dir),base);await fs.rm(dir,{recursive:true,force:true});});return dir;}
async function makeZip(entries){const zip=new yazl.ZipFile(),chunks=[];zip.outputStream.on('data',chunk=>chunks.push(chunk));const done=new Promise((resolve,reject)=>{zip.outputStream.once('end',()=>resolve(Buffer.concat(chunks)));zip.outputStream.once('error',reject);zip.once('error',reject);});for(const [name,content]of entries)zip.addBuffer(Buffer.from(content),name);zip.end();return done;}
test('Node ZIP import and export preserve nested Illustrator assets without Python',async t=>{
 const dir=await temp(t),zip=path.join(dir,'input.zip');await fs.writeFile(zip,await makeZip([['Design/My Template.AI','editable-ai'],['Design/Links/image.png','image-bytes']]));
 const extracted=await unpackTemplate(zip,path.join(dir,'assets'));assert.equal(await fs.readFile(extracted.template,'utf8'),'editable-ai');assert.equal(await fs.readFile(path.join(extracted.assetsRoot,'Design/Links/image.png'),'utf8'),'image-bytes');
 const archive=path.join(dir,'export.zip');await packageOutput(extracted.assetsRoot,archive);const again=await unpackTemplate(archive,path.join(dir,'again'));assert.equal(await fs.readFile(again.template,'utf8'),'editable-ai');
 await assert.rejects(unpackTemplate(zip,extracted.assetsRoot),/EEXIST/);
});
test('ZIP paths cannot escape extraction or name Windows devices',()=>{
 for(const name of ['../escape.ai','a/../../escape.ai','/absolute.ai','C:\\escape.ai','a/evil.ai:stream','a/CON.ai','a/trailing./x.ai'])assert.throws(()=>safeArchivePath(name),/Unsafe/);
 assert.equal(safeArchivePath('Links\\image.png'),'Links/image.png');
});
test('malicious ZIP entries are rejected without leaving extracted files',async t=>{
 const dir=await temp(t),zip=path.join(dir,'unsafe.zip');const bytes=await makeZip([['xx/escape.ai','unsafe']]);await fs.writeFile(zip,Buffer.from(bytes.toString('latin1').replaceAll('xx/escape.ai','../escape.ai'),'latin1'));
 await assert.rejects(unpackTemplate(zip,path.join(dir,'assets')),/invalid relative path|Unsafe/i);assert.equal(await fs.stat(path.join(dir,'assets')).catch(()=>null),null);assert.equal(await fs.stat(path.join(dir,'escape.ai')).catch(()=>null),null);
});
test('multiple templates, duplicate case-insensitive names and oversized ZIPs are rejected',async t=>{
 const dir=await temp(t);
 for(const [label,entries,error]of [['many',[['a.ai','A'],['b.ai','B']],/exactly one/],['duplicate',[['card.ai','A'],['CARD.ai','B']],/Duplicate/]]){const zip=path.join(dir,label+'.zip');await fs.writeFile(zip,await makeZip(entries));await assert.rejects(unpackTemplate(zip,path.join(dir,label)),error);}
 const data=await makeZip([['big.ai','A']]),central=data.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));data.writeUInt32LE(513*1024*1024,central+24);const large=path.join(dir,'large.zip');await fs.writeFile(large,data);await assert.rejects(unpackTemplate(large,path.join(dir,'large')),/512 MB|size mismatch/i);
});
