import https from 'node:https';
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export const MAX_IMAGE_BYTES=20*1024*1024;
export function publicImageAddress(address){try{return ipaddr.process(address).range()==='unicast';}catch{return false;}}
export function imageURL(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Error('Use an HTTPS image URL without credentials or a custom port');return url;
}
export async function downloadImage(value,{resolve=dns.lookup,request=https.get}={}){
 let url=imageURL(value);
 for(let hop=0;hop<4;hop++){
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=ipaddr.isValid(hostname)?[{address:hostname,family:ipaddr.parse(hostname).kind()==='ipv4'?4:6}]:await resolve(hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(item=>!publicImageAddress(item.address)))throw Error('Image URLs must point to a public internet address');
  const {address,family}=addresses[0];
  const result=await new Promise((yes,no)=>{
   const req=request(url,{agent:false,autoSelectFamily:false,lookup:(_host,_options,callback)=>callback(null,address,family),headers:{'User-Agent':'RowCraft image importer',Accept:'image/*'}},res=>{
    if([301,302,303,307,308].includes(res.statusCode)){res.resume();yes({redirect:res.headers.location});return;}
    if(res.statusCode!==200){res.resume();no(Error('Image server returned an unsuccessful response'));return;}
    if(Number(res.headers['content-length'])>MAX_IMAGE_BYTES){res.destroy();no(Error('Image exceeds 20 MB'));return;}
    const chunks=[];let size=0;
    res.on('data',chunk=>{size+=chunk.length;if(size>MAX_IMAGE_BYTES){res.destroy(Error('Image exceeds 20 MB'));return;}chunks.push(chunk);});res.once('error',no);res.once('aborted',()=>no(Error('Image download was interrupted')));res.once('end',()=>yes({buffer:Buffer.concat(chunks)}));
   });
   const timer=setTimeout(()=>req.destroy(Error('Image download timed out')),15000);req.once('close',()=>clearTimeout(timer));req.once('error',no);
  });
  if(result.buffer)return result.buffer;
  if(!result.redirect||hop===3)throw Error('Too many image redirects');url=imageURL(new URL(result.redirect,url).href);
 }
}
