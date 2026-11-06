let auth:Promise<{token:string;nativeAvailable:boolean}>|null=null;
export async function session(){if(!auth)auth=fetch('/api/session').then(r=>{if(!r.ok)throw Error('Local server is unavailable. Start the app and refresh.');return r.json();}).catch(()=>{auth=null;throw Error('Cannot reach the local API. Start Cover Studio and try again.');});return auth;}
export async function api<T>(url:string,body?:unknown):Promise<T>{
 const form=body instanceof FormData;
 const send=async(token:string)=>fetch(url,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'x-cover-studio-token':token,...(!form?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:form?body:JSON.stringify(body)});
 let r=await send((await session()).token);
 if(r.status===403){auth=null;r=await send((await session()).token);}
 const data=await r.json().catch(()=>{throw Error('The local API returned an invalid response. Start the current Cover Studio server and refresh.');});if(!r.ok)throw Error(data.error||'Request failed');return data;
}
