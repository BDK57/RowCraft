import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSections,sectionCards,sectionAssignments,sectionRange} from '../server/sections.mjs';

const cards=Array.from({length:4},(_,i)=>({id:`card-${i}`,groupIndex:i,family:'person',x:.1+(i%2)*.4,y:.2+Math.floor(i/2)*.35,width:.3,height:.25,targetIds:[`name-${i}`]}));
const board={width:612,height:1008,cards,targets:[...cards.map(c=>({id:c.targetIds[0],index:c.groupIndex,text:'Name'})),{id:'heading',index:4,text:'Heading'},{id:'month',index:5,text:'Month'},{id:'heading-2',index:6,text:'Heading 2'},{id:'month-2',index:7,text:'Month 2'}]};
const template={artboards:[board,{...board,width:800,height:600}]},workbook={sheets:[{name:'People',columns:['Name','Month'],rows:Array.from({length:40},(_,i)=>({id:`row-${i}`,record:i+1,excelRow:i+2,values:[`Person ${i+1}`,'Nov 2026']}))}]};
function section(id,first,last,bottom=false,artboard=0){return {id,name:id,artboard,box:{x:0,y:bottom?.5:.1,width:1,height:.35},cardId:`card-${bottom?2:0}`,recordIds:workbook.sheets[0].rows.slice(first-1,last).map(r=>r.id),mappings:[{kind:'text',targetId:`name-${bottom?2:0}`,column:0}],labels:[{role:'heading',targetId:bottom?'heading-2':'heading',source:'literal',value:`Winners ${id}`,column:0},{role:'month',targetId:bottom?'month-2':'month',source:'column',column:1,value:''}]};}

test('section range validates drafts and never exports the last selection while the visible range is invalid',()=>{
 const sheet=workbook.sheets[0];assert.deepEqual(sectionRange(sheet,'5','10').recordIds,sheet.rows.slice(4,10).map(r=>r.id));
 for(const [from,to]of [['','5'],['0','5'],['5','4'],['1','41'],['1.5','3']])assert.ok(sectionRange(sheet,from,to).error);
 assert.throws(()=>planSections(template,workbook,'People',[{...section('A',1,5),rangeError:'Choose a complete range.'}]),/complete range/);
});

test('two sections use independent inclusive row ranges, headings and months on a shared page',()=>{
 const a=section('first',1,10),b=section('second',20,30,true),plan=planSections(template,workbook,'People',[a,b]);
 assert.equal(plan.count,21);assert.equal(plan.pageCount,6);assert.equal(plan.sections[0].capacity,2);assert.equal(plan.sections[1].records.length,11);
 assert.equal(plan.sections[0].labels[0].value,'Winners first');assert.equal(plan.sections[1].labels[1].value,'Nov 2026');
 assert.equal(plan.sections[1].records[0].record,20);assert.equal(plan.sections[1].records.at(-1).record,30);
 const assignments=sectionAssignments(plan);assert.equal(assignments.length,21);assert.equal(assignments.filter(r=>r.sectionId==='second'&&r.page===6).length,1);
 assert.equal(assignments.filter(r=>r.sectionId==='first'&&r.page===6).length,0);
});
test('sections across artboards preserve independent capacities and page sizes in one canvas',()=>{
 const plan=planSections(template,workbook,'People',[section('A',1,3),section('B',20,22,false,1)]);
 assert.equal(plan.pageCount,4);assert.deepEqual(plan.pages.map(p=>p.artboard),[0,0,1,1]);assert.equal(plan.pages[2].width,800);
 for(const p of plan.pages){assert.ok(p.x>=-7500&&p.x+p.width<=7500);assert.ok(p.y<=7500&&p.y-p.height>=-7500);}
 assert.deepEqual(sectionAssignments(plan).filter(a=>a.sectionId==='B').map(a=>a.page),[3,3,4]);
});
test('proof includes the first populated page of each source artboard without changing selections',()=>{
 const input=[section('A',1,10),section('B',20,30,true),section('C',1,5,false,1)],before=JSON.stringify(input),plan=planSections(template,workbook,'People',input,{proof:true});
 assert.equal(plan.pageCount,2);assert.equal(plan.count,6);assert.equal(JSON.stringify(input),before);
});
test('section boxes require complete cards and reject shared slots, mixed families and invalid samples',()=>{
 assert.equal(sectionCards(board,{x:.1,y:.2,width:.15,height:.25}).length,0);
 const a=section('A',1,5),b=section('B',6,10);assert.throws(()=>planSections(template,workbook,'People',[a,b]),/share card/);
 assert.throws(()=>planSections(template,workbook,'People',[{...a,cardId:'card-3'}]),/sample card/);
 const mixed=structuredClone(template);mixed.artboards[0].cards[1].family='other';assert.throws(()=>planSections(mixed,workbook,'People',[a]),/same design/);
 for(const box of [{x:-1,y:0,width:1,height:1},{x:0,y:0,width:0,height:1},{x:0,y:0,width:2,height:1}])assert.throws(()=>planSections(template,workbook,'People',[{...a,box}]),/valid box/);
});
test('labels are section-specific, cannot overwrite cards, and validate fixed values and columns',()=>{
 const a=section('A',1,5),b=section('B',6,10,true);b.labels[0].targetId='heading';assert.throws(()=>planSections(template,workbook,'People',[a,b]),/two sections/);
 for(const label of [{...a.labels[0],targetId:'name-0'},{...a.labels[0],targetId:'foreign'},{...a.labels[0],source:'column',column:99},{...a.labels[0],value:'x'.repeat(1001)}])assert.throws(()=>planSections(template,workbook,'People',[{...a,labels:[label]}]));
 assert.throws(()=>planSections(template,workbook,'People',[{...a,labels:[a.labels[0],a.labels[0]]}]),/one label/);
});
test('empty, foreign or duplicate row selections and mappings outside the sample are rejected',()=>{
 const a=section('A',1,5);
 for(const recordIds of [[],['foreign'],['row-0','row-0']])assert.throws(()=>planSections(template,workbook,'People',[{...a,recordIds}]));
 assert.throws(()=>planSections(template,workbook,'People',[{...a,mappings:[{kind:'text',targetId:'name-1',column:0}]}]),/sample card/);
 assert.throws(()=>planSections(template,workbook,'People',[{...a,mappings:[]}]),/at least one/);
});
test('intentional reuse of a participant in separate sections remains two assigned cards',()=>{
 const plan=planSections(template,workbook,'People',[section('A',1,2),section('B',1,2,true)]);assert.equal(plan.count,4);assert.equal(sectionAssignments(plan).filter(a=>a.record===1).length,2);
});
test('section count and combined canvas limits are checked before invoking Illustrator',()=>{
 assert.throws(()=>planSections(template,workbook,'People',[]),/1 and 20/);
 assert.throws(()=>planSections(template,workbook,'People',Array.from({length:21},(_,i)=>section(String(i),1,2))),/1 and 20/);
 const huge=structuredClone(template);huge.artboards[0].width=14000;huge.artboards[0].height=14000;
 assert.throws(()=>planSections(huge,workbook,'People',[section('A',1,5)]),/canvas/);
 assert.throws(()=>planSections(template,workbook,'People',[{...section('A',1,2),artboard:99}]),/existing artboard/);
});
