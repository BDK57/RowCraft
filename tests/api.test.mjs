import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
process.env.COVER_STUDIO_NO_LISTEN='1';
const testData=path.resolve('.local','api-check-'+crypto.randomUUID());
process.env.ROWCRAFT_DATA_DIR=testData;
process.env.ROWCRAFT_DESKTOP='1';
const {app}=await import('../server/index.mjs');

test('real download routes return AI/PDF bytes and completed batches survive reloads',async t=>{
 const jobs=path.join(testData,'jobs'),id=crypto.randomUUID(),dir=path.join(jobs,id),output=path.join(dir,'output');await fs.mkdir(output,{recursive:true});
 t.after(async()=>{assert.equal(path.dirname(testData),path.resolve('.local'));await fs.rm(testData,{recursive:true,force:true});});
 const result={count:5,pages:1,ai:`/api/jobs/${id}/ai`,pdf:`/api/jobs/${id}/pdf`,archive:`/api/jobs/${id}/download`,folder:output,previews:[]};
 await fs.writeFile(path.join(dir,'status.json'),JSON.stringify({id,type:'generate',status:'complete',result}));
 const contents={ai:'%PDF-native-editable-AI',pdf:'%PDF-print',download:'PK-zip'};
 await fs.writeFile(path.join(output,'personalized-covers.ai'),contents.ai);await fs.writeFile(path.join(output,'personalized-covers.pdf'),contents.pdf);await fs.writeFile(path.join(dir,'covers.zip'),contents.download);await fs.writeFile(path.join(output,'page-0001.png'),'PNG-preview');
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port;
 const session=await fetch(base+'/api/session',{headers:{Origin:base}});assert.equal(session.status,200);assert.match(session.headers.get('content-security-policy'),/script-src 'self'/);
 const token=(await session.json()).token;assert.ok(token);
 assert.equal((await fetch(base+'/api/session',{headers:{Origin:'http://127.0.0.1:5173'}})).status,403);
 assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://untrusted.example'}})).status,403);
 const badHost=await new Promise((resolve,reject)=>{http.get(base+'/api/session',{headers:{Host:'untrusted.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);});assert.equal(badHost,403);
 for(const [route,text] of Object.entries(contents)){const r=await fetch(`${base}/api/jobs/${id}/${route}`);assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment; filename="?personalized-covers\.(ai|pdf|zip)"?/);assert.equal(await r.text(),text);}
 const preview=await fetch(`${base}/api/jobs/${id}/preview/page-0001`);assert.equal(preview.status,200);assert.equal(await preview.text(),'PNG-preview');
 const list=await (await fetch(base+'/api/jobs')).json();const legacy=list.find(j=>j.id===id);assert.ok(legacy);
 const folderStats=await fs.stat(dir);
 if(folderStats.birthtimeMs>0){assert.equal(legacy.createdAt,folderStats.birthtime.toISOString());assert.equal(legacy.createdAtSource,'folder');}
 assert.equal((await (await fetch(`${base}/api/jobs/${id}`)).json()).createdAt,legacy.createdAt);
 // A recorded creation time must survive reloads and later status-file modifications.
 const createdAt='2026-11-05T08:45:00.000Z';
 await fs.writeFile(path.join(dir,'status.json'),JSON.stringify({id,type:'generate',status:'complete',createdAt,createdAtSource:'recorded',result}));
 const reloaded=await (await fetch(`${base}/api/jobs/${id}`)).json();assert.equal(reloaded.createdAt,createdAt);assert.equal(reloaded.createdAtSource,'recorded');
 const refreshed=(await (await fetch(base+'/api/jobs')).json()).find(j=>j.id===id);assert.equal(refreshed.createdAt,createdAt);
 await fs.unlink(path.join(output,'personalized-covers.ai'));const missing=await fetch(`${base}/api/jobs/${id}/ai`);assert.equal(missing.status,404);assert.match((await missing.json()).error,/not available/);
 const unknown=await fetch(base+'/api/not-a-folder');assert.equal(unknown.status,404);assert.match(unknown.headers.get('content-type'),/json/);
 const csrf=await fetch(base+'/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
});
