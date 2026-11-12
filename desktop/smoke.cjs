// Invoked only by --rowcraft-smoke. Uses an isolated data directory in automated checks.
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
async function run({app,window,origin,connection}){
 const result={ok:false,packaged:app.isPackaged,electron:process.versions.electron,node:process.versions.node,illustrator:connection.version,checks:[]};
 const session=await (await fetch(origin+'/api/session')).json();assert.equal(session.nativeAvailable,true);result.checks.push('Bundled Node backend and native connection');
 const health=await fetch(origin+'/api/health');assert.equal(health.status,200);
 const html=await window.webContents.executeJavaScript('(async()=>{for(let i=0;i<100;i++){if(document.body.innerText.includes("Upload workbook")&&document.querySelector(".renderer-status.is-connected"))break;await new Promise(resolve=>setTimeout(resolve,100));}return {title:document.title,text:document.body.innerText,connected:!!document.querySelector(".renderer-status.is-connected"),nodeExposed:typeof window.require!=="undefined"||typeof window.process!=="undefined"};})()');
 assert.match(html.title,/RowCraft/);assert.match(html.text,/Upload workbook/);assert.equal(html.nodeExposed,false);result.checks.push('Packaged React UI; Node isolated from renderer');
 assert.equal(html.connected,true);result.checks.push('Illustrator connected badge after server confirmation');
 const form=new FormData();form.append('file',new Blob(['Name,City\nAli,Lahore\nSara,Karachi\n']), 'smoke.csv');
 const uploaded=await fetch(origin+'/api/workbooks',{method:'POST',headers:{'x-cover-studio-token':session.token},body:form});
 assert.equal(uploaded.status,200);const workbook=await uploaded.json();assert.equal(workbook.sheets[0].rows.length,2);result.checks.push('CSV upload and Excel backend');
 const imageForm=new FormData();imageForm.append('files',new Blob([await fs.readFile(path.join(__dirname,'assets','icon.png'))]),'shared.png');
 const imageResponse=await fetch(origin+'/api/images',{method:'POST',headers:{'x-cover-studio-token':session.token},body:imageForm});assert.equal(imageResponse.status,200);const images=await imageResponse.json();assert.ok(images.assets[0].width>0);
 const photoPreview=await fetch(origin+images.assets[0].preview);assert.equal(photoPreview.status,200);assert.match(photoPreview.headers.get('content-type'),/image\/png/);result.checks.push('Packaged Sharp image normalization and same-origin photo preview');
 const forbidden=await fetch(origin+'/api/session',{headers:{Origin:'https://untrusted.example'}});assert.equal(forbidden.status,403);result.checks.push('Untrusted origins blocked');
 const denied=await fetch(origin+'/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(denied.status,403);result.checks.push('Unauthenticated mutations blocked');
 // Optional real template round trip, enabled by the external smoke runner.
 if(process.env.ROWCRAFT_SMOKE_TEMPLATE){
  const zip=await fs.readFile(process.env.ROWCRAFT_SMOKE_TEMPLATE),templateForm=new FormData();templateForm.append('file',new Blob([zip]),'template.zip');
  const imported=await fetch(origin+'/api/templates',{method:'POST',headers:{'x-cover-studio-token':session.token},body:templateForm});assert.equal(imported.status,202);
  async function wait(id){for(let i=0;i<360;i++){const state=await (await fetch(origin+'/api/jobs/'+id)).json();if(state.status==='failed')throw Error(state.error||state.message);if(state.status==='complete')return state.result;await new Promise(resolve=>setTimeout(resolve,1000));}throw Error('Native smoke test timed out');}
  const template=await wait((await imported.json()).id);
  assert.ok(template.artboards.length);const boardIndex=template.artboards.findIndex(board=>board.cards?.length>0);assert.ok(boardIndex>=0);
  const board=template.artboards[boardIndex],card=board.cards[0],target=board.targets.find(item=>card.targetIds.includes(item.id));assert.ok(target);
  const preview=await fetch(origin+board.preview);assert.equal(preview.status,200);assert.match(preview.headers.get('content-type'),/image\/png/);result.checks.push('Packaged JSX; real Illustrator import and PNG preview');
  assert.ok(card.photos?.length,'Photo metadata missing from packaged Illustrator inspection');
  const generated=await fetch(origin+'/api/jobs',{method:'POST',headers:{'x-cover-studio-token':session.token,'content-type':'application/json'},body:JSON.stringify({workbookId:workbook.id,templateId:template.id,sheetName:workbook.sheets[0].name,recordIds:workbook.sheets[0].rows.map(row=>row.id),artboard:boardIndex,layout:{cardId:card.id},mappings:[{kind:'text',targetId:target.id,column:0}],photo:{source:'shared',targetId:card.photos[0].id,libraryId:images.id,assetId:images.assets[0].id,adjustment:{fit:'fit',x:.5,y:.5,zoom:1}},includePdf:true,textFit:'preserve'})});
  assert.equal(generated.status,202);const output=await wait((await generated.json()).id);
  for(const route of [output.ai,output.pdf,output.archive]){const download=await fetch(origin+route);assert.equal(download.status,200);assert.ok((await download.arrayBuffer()).byteLength>0);}
  assert.equal(output.count,2);result.checks.push('Native AI, PDF and Node ZIP generation; all download routes');
  assert.ok(!output.warnings.some(w=>/image could not be placed|original image because/i.test(w)),output.warnings.join('\n'));result.checks.push('Packaged shared-photo replacement in native Illustrator export');
  result.output=output;
 }
 await fs.writeFile(path.join(app.getPath('userData'),'desktop.png'),(await window.webContents.capturePage()).toPNG());
 result.ok=true;await fs.writeFile(path.join(app.getPath('userData'),'smoke-result.json'),JSON.stringify(result,null,2));
}
module.exports={run};
