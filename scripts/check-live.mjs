import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:5173';
const health=await (await fetch(base+'/api/health')).json();assert.equal(health.singleAi,true);
const jobs=await (await fetch(base+'/api/jobs')).json();const job=process.argv[2]?jobs.find(j=>j.id===process.argv[2]):jobs.find(j=>j.result?.ai&&j.result.count===5);assert.ok(job);
const checks=[];
for(const [kind,url,magic] of [['AI',job.result.ai,'%PDF-'],['PDF',job.result.pdf,'%PDF-'],['ZIP',job.result.archive,'PK'],['PNG',job.result.previews[0],null]]){
 const r=await fetch(base+url);assert.equal(r.status,200);const data=Buffer.from(await r.arrayBuffer());assert.ok(data.byteLength>1000);if(magic)assert.ok(data.toString('ascii',0,magic.length)===magic);else assert.equal(data.subarray(1,4).toString(),'PNG');
 if(kind!=='PNG')assert.match(r.headers.get('content-disposition'),/attachment/);
 checks.push({kind,status:r.status,bytes:data.byteLength});
}
const manifest=JSON.parse(await fs.readFile(job.result.folder+'/manifest.json','utf8'));assert.equal(manifest.records.length,5);assert.equal(manifest.pages,1);if(manifest.textFit)assert.equal(manifest.textFit,'preserve');
const report={health,job:job.id,checks,count:manifest.records.length,pages:manifest.pages};await fs.writeFile('.local/checks/live-http.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
