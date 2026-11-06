import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {downloadableArtifact} from '../server/artifacts.mjs';

test('AI/PDF downloads resolve to real completed files; no fictional API folder is needed',async t=>{
 const base=path.resolve(os.tmpdir()),dir=await fs.mkdtemp(path.join(base,'cover-artifacts-'));t.after(async()=>{assert.equal(path.dirname(dir),base);await fs.rm(dir,{recursive:true,force:true});});
 const id='12345678-1234-1234-1234-123456789abc',output=path.join(dir,'jobs',id,'output');await fs.mkdir(output,{recursive:true});
 const state={status:'complete',result:{ai:'/api/jobs/any/ai',pdf:'/api/jobs/any/pdf',archive:'/api/jobs/any/download'}};
 assert.equal(await downloadableArtifact(dir,id,state,'ai'),null);
 for(const ext of ['ai','pdf'])await fs.writeFile(path.join(output,'personalized-covers.'+ext),'real-file');
 for(const ext of ['ai','pdf'])assert.equal(await downloadableArtifact(dir,id,state,ext),path.join(output,'personalized-covers.'+ext));
 assert.equal(await downloadableArtifact(dir,id,{...state,status:'running'},'ai'),null);
 assert.equal(await downloadableArtifact(dir,'../../private',state,'ai'),null);
 assert.equal(await downloadableArtifact(dir,id,state,'archive'),null);
 assert.equal(await downloadableArtifact(dir,id,{status:'complete',result:{ai:state.result.ai}},'pdf'),null);
 await fs.writeFile(path.join(output,'personalized-covers.pdf'),'');assert.equal(await downloadableArtifact(dir,id,state,'pdf'),null);
});
