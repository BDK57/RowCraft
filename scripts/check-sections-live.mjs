import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',id=process.argv[2];
assert.match(id||'',/^[a-f0-9-]{36}$/);
const job=await (await fetch(`${base}/api/jobs/${id}`)).json();assert.equal(job.status,'complete');
const manifest=JSON.parse(await fs.readFile(job.result.folder+'/manifest.json','utf8'));assert.equal(manifest.mode,'sections');assert.equal(manifest.records.length,job.result.count);
const checks=[];
for(const [kind,url,magic] of [['AI',job.result.ai,'%PDF-'],['PDF',job.result.pdf,'%PDF-'],['ZIP',job.result.archive,'PK'],['Preview',job.result.previews[0],null]]){
 const response=await fetch(base+url);assert.equal(response.status,200);const data=Buffer.from(await response.arrayBuffer());assert.ok(data.length>1000);
 if(magic)assert.ok(data.toString('ascii',0,magic.length)===magic);else assert.equal(data.subarray(1,4).toString(),'PNG');
 if(kind!=='Preview')assert.match(response.headers.get('content-disposition'),/attachment/);
 checks.push({kind,status:response.status,bytes:data.length});
}
const report={id,count:job.result.count,pages:job.result.pages,sections:manifest.sections.map(section=>({name:section.name,count:manifest.records.filter(row=>row.sectionId===section.id).length})),checks};
await fs.writeFile('.local/checks/sections-live-http.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
