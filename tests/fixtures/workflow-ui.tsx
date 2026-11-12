import {test} from 'node:test';
import assert from 'node:assert/strict';
const dom={window};
const {render,fireEvent,act,cleanup,waitFor}=await import('@testing-library/react');
const {useStudio}=await import('../../src/hooks/use-studio');
const {SectionRows}=await import('../../src/components/section-records');
const workbook={id:'book',name:'People.xlsx',sheets:[{name:'People',columns:['Name'],skippedHeaders:[],rows:Array.from({length:1036},(_,i)=>({id:'row-'+i,record:i+1,excelRow:i+2,values:['Person '+i]}))}]};
const template={id:'template',name:'Cards.ai',fonts:[],missingLinks:[],warnings:[],preset:null,artboards:[{name:'Page',width:612,height:1008,preview:'/preview.png',cards:[{id:'card',groupIndex:0,family:'people',x:.1,y:.2,width:.3,height:.3,targetIds:['name']}],targets:[{id:'name',index:0,text:'Name',x:.1,y:.2,width:.1,height:.02,font:'Arial',fontSize:12}]}]};
globalThis.fetch=async(url:any)=>({ok:true,status:200,json:async()=>String(url).endsWith('/api/session')?{token:'test',nativeAvailable:true}:[]} as any);
let studio:ReturnType<typeof useStudio>;
function Harness(){
 studio=useStudio();const section=studio.sections[0];
 return <>{section&&<SectionRows s={studio} section={section} onChange={(recordIds,rangeError)=>studio.setSections(current=>current.map(s=>s.id===section.id?{...s,recordIds,rangeError}:s))}/>}<button disabled={!studio.ready}>Generate</button><button disabled={!studio.canReview}>Review</button></>;
}
test('a smaller valid section range unlocks generation immediately without a mapping edit',async()=>{
 const ui=render(<Harness/>);
 try{
  await act(async()=>{});
  await act(async()=>{studio.setWorkbook(workbook);studio.setSheetName('People');studio.setTemplate(template as any);studio.setBatchMode('sections');studio.setSections([{id:'one',name:'Winners',artboard:0,box:{x:0,y:0,width:1,height:1},cardId:'card',recordIds:workbook.sheets[0].rows.map(r=>r.id),mappings:[{kind:'text',targetId:'name',column:0}],labels:[]}]);});
  assert.equal((ui.getByRole('button',{name:'Generate'}) as HTMLButtonElement).disabled,true);
  assert.equal((ui.getByRole('button',{name:'Review'}) as HTMLButtonElement).disabled,false,'Review must remain accessible with a validation issue');
  const originalMappings=studio.sections[0].mappings;
  fireEvent.change(ui.getByLabelText('Section record to'),{target:{value:'5'}});
  assert.equal(studio.batchCount,5,'The range must reach the section model without clicking Apply or changing a mapping');
  assert.equal((ui.getByRole('button',{name:'Generate'}) as HTMLButtonElement).disabled,false);
  assert.equal(studio.sections[0].mappings,originalMappings,'Range edits must preserve field mappings');
  fireEvent.change(ui.getByLabelText('Section record from'),{target:{value:'20'}});
  assert.equal(studio.ready,false);assert.ok(ui.getByRole('alert'));assert.equal(studio.canReview,true);
  fireEvent.change(ui.getByLabelText('Section record to'),{target:{value:'30'}});
  assert.equal(studio.ready,true);assert.equal(studio.batchCount,11);assert.equal(studio.sections[0].recordIds[0],'row-19');assert.equal(studio.sections[0].recordIds.at(-1),'row-29');
  fireEvent.change(ui.getByLabelText('Section record from'),{target:{value:''}});assert.equal(studio.ready,false);
  fireEvent.change(ui.getByLabelText('Section record from'),{target:{value:'5'}});assert.equal(studio.ready,true);
  await act(async()=>studio.setSelected(new Set(['row-1','row-9'])));
  fireEvent.click(ui.getByRole('button',{name:'Use selection from People'}));
  assert.deepEqual(studio.sections[0].recordIds,['row-1','row-9'],'Sparse selections must not become an inclusive range');
  assert.equal((ui.getByLabelText('Section record from') as HTMLInputElement).value,'2');assert.equal((ui.getByLabelText('Section record to') as HTMLInputElement).value,'10');
 }finally{cleanup();}
});

const {ProcessFeedback}=await import('../../src/components/process-feedback');
const {IllustratorBadge}=await import('../../src/components/illustrator-badge');
const {toast,Toaster}=await import('../../src/components/ui/toast');
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}} as any;
const scrolls:any[]=[];
dom.window.HTMLElement.prototype.scrollIntoView=function(options){scrolls.push({element:this,options});};
test('shared actions publish a fresh start event for uploads, analysis and repeated attempts',async()=>{
 render(<Harness/>);
 try{
  await act(async()=>{});
  let finish:()=>void,attempt:Promise<void>;
  await act(async()=>{attempt=studio.action('Reading workbook',()=>new Promise<void>(resolve=>{finish=resolve;}));});
  assert.equal(studio.processStart?.id,1);assert.equal(studio.processStart?.label,'Reading workbook');assert.equal(studio.running,true);
  await act(async()=>{finish!();await attempt!;});assert.equal(studio.running,false);
  await act(async()=>{await studio.action('Reading workbook',async()=>{throw Error('Invalid workbook');});});
  assert.equal(studio.processStart?.id,2);assert.equal(studio.error,'Invalid workbook');assert.equal(studio.running,false);
  await act(async()=>{await studio.action('Analyzing card structure',async()=>{});});
  assert.equal(studio.processStart?.id,3);assert.equal(studio.processStart?.label,'Analyzing card structure');assert.equal(studio.error,'');
 }finally{cleanup();}
});
test('each process starts one toast and one scroll, without jumping on progress updates',async()=>{
 const added:any[]=[],originalAdd=toast.add;toast.add=((options:any)=>{added.push(options);return originalAdd(options);}) as any;
 const start={id:1,label:'Rendering native proof'},job={id:'job',type:'proof',status:'queued',progress:0,message:'Waiting for Illustrator'};
 function Feedback(props:any){return <><ProcessFeedback {...props}/><Toaster/></>;}
 const ui=render(<Feedback start={null} running={false} busy="" job={null}/>);
 try{
  ui.rerender(<Feedback start={start} running={true} busy="Rendering native proof" job={null}/>);
  await waitFor(()=>assert.equal(scrolls.length,1));assert.equal(added.length,1);assert.equal(added[0].title,'Process started');assert.ok(await ui.findByText('Process started'));assert.equal(scrolls[0].element.getAttribute('aria-label'),'Process progress');
  ui.rerender(<Feedback start={start} running={true} busy="" job={{...job,status:'running',progress:55}}/>);
  assert.equal(added.length,1);assert.equal(scrolls.length,1);
  ui.rerender(<Feedback start={start} running={false} busy="" job={{...job,status:'complete'}}/>);assert.equal(ui.queryByLabelText('Process progress'),null);
  ui.rerender(<Feedback start={{...start,id:2}} running={true} busy="Rendering native proof" job={null}/>);
  await waitFor(()=>assert.equal(scrolls.length,2));assert.equal(added.length,2,'Repeating the same action must notify again');
  assert.equal(scrolls[1].options.block,'start');
  assert.equal(scrolls[1].options.behavior,process.env.ROWCRAFT_UI_REDUCED_MOTION==='1'?'instant':'smooth');
 }finally{toast.add=originalAdd;toast.close('studio-process');cleanup();}
});

test('connection badge pulses only after Illustrator availability is confirmed',()=>{
 const ui=render(<IllustratorBadge connected={null}/>);
 try{
  assert.ok(ui.getByText('Checking Illustrator'));assert.equal(ui.container.querySelector('.connection-pulse'),null);
  ui.rerender(<IllustratorBadge connected={true}/>);assert.ok(ui.getByLabelText('Illustrator connected'));assert.equal(!!ui.container.querySelector('.is-connected .connection-pulse'),process.env.ROWCRAFT_UI_REDUCED_MOTION!=='1');
  ui.rerender(<IllustratorBadge connected={false}/>);assert.ok(ui.getByText('Renderer unavailable'));assert.equal(ui.container.querySelector('.connection-pulse'),null);
 }finally{cleanup();}
});
