const path=require('node:path');
const ADOBE_HOSTS=new Set(['www.adobe.com','helpx.adobe.com','creativecloud.adobe.com']);
function isLocalNavigation(target,origin){try{return new URL(target).origin===origin;}catch{return false;}}
function isAdobeLink(target){try{const url=new URL(target);return url.protocol==='https:'&&ADOBE_HOSTS.has(url.hostname)&&!url.username&&!url.password;}catch{return false;}}
function isExportDownload(target,origin){
 try{const url=new URL(target);return url.origin===origin&&/^\/api\/jobs\/[a-f0-9-]{36}\/(?:ai|pdf|download)$/.test(url.pathname);}catch{return false;}
}
function downloadName(name){return path.basename(name.replaceAll('\\','/')).replace(/[<>:"|?*\x00-\x1f]/g,'_')||'RowCraft-export';}
module.exports={isLocalNavigation,isAdobeLink,isExportDownload,downloadName};
