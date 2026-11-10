import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
const source=await fs.readFile(new URL('../desktop/illustrator-detect.ps1',import.meta.url),'utf8');
function check(script){return new Promise((resolve,reject)=>{execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:20000},(error,stdout,stderr)=>{try{resolve({code:error?.code||0,result:JSON.parse(stdout.trim())});}catch{reject(Error(stderr||stdout||error?.message));}});});}
test('missing Illustrator blocks prerequisite detection without modifying Windows registration',{skip:process.platform!=='win32'},async()=>{
 const missing=await check(source.replaceAll('Illustrator.Application','RowCraft.Missing.'+crypto.randomUUID()));
 assert.equal(missing.code,3);assert.equal(missing.result.installed,false);assert.match(missing.result.message,/Install or repair/);
});
test('real Illustrator detection accepts only a registered executable that exists',{skip:process.platform!=='win32'},async()=>{
 const actual=await check(source);
 if(actual.code===0){assert.equal(actual.result.installed,true);assert.ok((await fs.stat(actual.result.executable)).isFile());}
 else{assert.equal(actual.code,3);assert.equal(actual.result.installed,false);}
});
