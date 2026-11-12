import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractFile} from '@electron/asar';
const defaultArchive=process.platform==='darwin'?`release/${process.arch==='arm64'?'mac-arm64':'mac'}/RowCraft.app/Contents/Resources/app.asar`:'release/win-unpacked/resources/app.asar';
const archive=path.resolve(process.argv[2]||defaultArchive);
let count=0;
async function verify(folder){
 for(const entry of await fs.readdir(folder,{withFileTypes:true})){
  const file=path.join(folder,entry.name);
  if(entry.isDirectory()){await verify(file);continue;}
  if(file.endsWith('.nsh')||file.endsWith('.map'))continue;
  if(folder==='server'&&!file.endsWith('.mjs')&&!file.endsWith('illustrator.jsx'))continue;
  const relative=file,packed=extractFile(archive,relative);
  assert.ok((await fs.readFile(file)).equals(packed),'Packaged file differs from source: '+relative);count++;
 }
}
for(const folder of ['server','desktop','dist'])await verify(folder);
const packaged=JSON.parse(extractFile(archive,'package.json')),source=JSON.parse(await fs.readFile('package.json','utf8'));
assert.equal(packaged.version,source.version);assert.equal(packaged.main,source.main);
console.log(JSON.stringify({ok:true,version:packaged.version,verifiedFiles:count,archive}));
