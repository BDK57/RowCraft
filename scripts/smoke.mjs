import fs from 'node:fs/promises';
const base='http://127.0.0.1:4317';
const {token}=await (await fetch(base+'/api/session')).json();
async function post(url,data={}){const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json','x-cover-studio-token':token},body:JSON.stringify(data)});const out=await r.json();if(!r.ok)throw Error(out.error);return out;}
async function wait(id){let previous='';for(let i=0;i<1200;i++){const r=await (await fetch(base+'/api/jobs/'+id)).json();const message=r.status+': '+r.message;if(message!==previous){console.log(message);previous=message;}if(r.status==='failed')throw Error(r.error);if(r.status==='complete')return r.result;await new Promise(resolve=>setTimeout(resolve,1000));}throw Error('Native renderer exceeded the 20-minute smoke-test timeout. Check Illustrator for a blocking dialog.');}
const workbook=await post('/api/demo/workbook');console.log('Workbook:',workbook.sheets.map(s=>s.rows.length));
let template;if(process.argv.includes('--reuse'))template=(await (await fetch(base+'/api/templates')).json()).find(t=>t.artboards.some(b=>b.cards?.length)&&!t.missingLinks.length);
if(!template){const job=await post('/api/demo/template');template=await wait(job.id);}
console.log('Template:',JSON.stringify({id:template.id,covers:template.artboards.length,targets:template.artboards.map(a=>a.targets.length),missingLinks:template.missingLinks,warnings:template.warnings}));
await fs.mkdir('.local/checks',{recursive:true});await fs.writeFile('.local/checks/latest.json',JSON.stringify({workbookId:workbook.id,templateId:template.id,template},null,2));
if(template.missingLinks.length)process.exitCode=1;
if(process.argv.includes('--generate')){
 if(template.missingLinks.length)throw Error('Cannot test export until assets resolve.');
 const board=template.artboards.findIndex(b=>b.targets.some(t=>t.text.trim()==='Usama Mobile'));
 const b=template.artboards[board],sample=b.cards?.find(c=>c.targetIds.some(id=>b.targets.find(t=>t.id===id)?.text.trim()==='Usama Mobile'));if(!sample)throw Error('Analyze card groups before testing.');
 const sheet=workbook.sheets[0],mappings=[['Usama Mobile','Shop Name'],['Scoring 539','Scoring'],['Gaggoo Mandi','City']].map(([label,col])=>({kind:'text',targetId:b.targets.find(t=>sample.targetIds.includes(t.id)&&t.text.trim()===label).id,column:sheet.columns.indexOf(col)}));
 await post(`/api/templates/${template.id}/preset`,{name:'Winner cards: shop, score, city',artboard:board,layout:{cardId:sample.id},mappings,columns:sheet.columns});
 const j=await post('/api/jobs',{workbookId:workbook.id,templateId:template.id,sheetName:sheet.name,recordIds:sheet.rows.slice(0,5).map(r=>r.id),artboard:board,layout:{cardId:sample.id},mappings,proof:!process.argv.includes('--five'),includePdf:true,textFit:'preserve'});
 const result=await wait(j.id);console.log('Export:',JSON.stringify({id:j.id,...result}));await fs.writeFile('.local/checks/export.json',JSON.stringify({id:j.id,...result},null,2));
 for(const url of [result.ai,result.pdf,result.archive,...result.previews]){const response=await fetch(base+url);if(!response.ok)throw Error('Download failed: '+response.status+' '+url);const data=await response.arrayBuffer();if(!data.byteLength)throw Error('Empty download');console.log('Download PASS:',url,data.byteLength);}
}
