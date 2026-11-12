const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const ADOBE_SETUP='https://www.adobe.com/products/illustrator.html';
function powershell(script,timeout=15000){
 return new Promise((resolve,reject)=>{
  const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  execFile(executable,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout,maxBuffer:1024*1024},(error,stdout,stderr)=>{
   if(error){reject(Error(stderr.trim()||stdout.trim()||(error.killed?'Illustrator did not respond in time. Open Illustrator, finish any sign-in dialogs, and try again.':error.message)));return;}
   try{resolve(JSON.parse(stdout.replace(/^\uFEFF/,'').trim()));}catch{reject(Error('Illustrator returned an unreadable connection response.'));}
  });
 });
}
async function detectIllustrator(){
 if(process.platform==='darwin'){
  const {macDetectionScript}=await import('../server/illustrator-host.mjs');
  const detected=JSON.parse(await macScript(['-l','JavaScript','-e',macDetectionScript]));
  if(!detected.path||!fs.existsSync(detected.path))throw Error('Adobe Illustrator was not found. Install it through Adobe Creative Cloud.');
  return detected;
 }
 if(process.platform!=='win32')throw Error('RowCraft desktop requires Windows or macOS.');
 return powershell(fs.readFileSync(path.join(__dirname,'illustrator-detect.ps1'),'utf8'));
}
async function connectIllustrator(){
 const detected=await detectIllustrator();
 if(process.platform==='darwin'){
  const {macConnectionScript}=await import('../server/illustrator-host.mjs');
  const version=(await macScript(['-e',macConnectionScript],90000)).trim();
  if(!version)throw Error('Illustrator did not return its version. Open Illustrator and complete Adobe sign-in, then retry.');
  return {...detected,version};
 }
 return powershell("$ErrorActionPreference='Stop'; try { $ai=New-Object -ComObject Illustrator.Application; @{ installed=$true; version=[string]$ai.Version } | ConvertTo-Json -Compress } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }",45000);
}
async function macScript(args,timeout=15000){
 const {illustratorHostError}=await import('../server/illustrator-host.mjs');
 return new Promise((resolve,reject)=>execFile('/usr/bin/osascript',args,{timeout,maxBuffer:1024*1024},(error,stdout,stderr)=>{
  if(error){reject(Error(illustratorHostError(stderr.trim()||stdout.trim()||(error.killed?'Illustrator did not respond in time. Finish any Adobe or macOS permission dialogs, then retry.':error.message))));return;}
  resolve(stdout.replace(/^\uFEFF/,''));
 }));
}
module.exports={ADOBE_SETUP,detectIllustrator,connectIllustrator};
