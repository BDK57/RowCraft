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
 if(process.platform!=='win32')throw Error('RowCraft desktop currently requires Windows.');
 return powershell(fs.readFileSync(path.join(__dirname,'illustrator-detect.ps1'),'utf8'));
}
async function connectIllustrator(){
 await detectIllustrator();
 return powershell("$ErrorActionPreference='Stop'; try { $ai=New-Object -ComObject Illustrator.Application; @{ installed=$true; version=[string]$ai.Version } | ConvertTo-Json -Compress } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }",45000);
}
module.exports={ADOBE_SETUP,detectIllustrator,connectIllustrator};
