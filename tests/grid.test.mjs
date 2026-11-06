import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planGrid,gridAssignments,splitMappings} from '../server/grid.mjs';

const cards=Array.from({length:6},(_,i)=>({id:'card-'+i,groupIndex:i,family:'people',x:.05+(i%3)*.3,y:.2+Math.floor(i/3)*.3,width:.25,height:.25,targetIds:['name-'+i,'city-'+i]}));
const template={artboards:[{width:612,height:1008,cards:[cards[5],cards[2],cards[4],cards[0],cards[3],cards[1],{id:'footer',family:'offers',targetIds:['offer']}]}]};
const mappings=[{kind:'text',targetId:'name-4',column:0}];
const layout={cardId:'card-4'};
test('a sample from any position repeats into the existing grid in reading order',()=>{
 const plan=planGrid(template,0,layout,mappings,5);assert.equal(plan.capacity,6);assert.equal(plan.pages,1);assert.equal(plan.sample.id,'card-4');assert.deepEqual(plan.slots.map(c=>c.id),cards.map(c=>c.id));
 const rows=Array.from({length:5},(_,i)=>({id:String(i),record:i+1,excelRow:i+2}));const assigned=gridAssignments(plan,rows);assert.equal(assigned.length,5);assert.equal(assigned.at(-1).slot,5);assert.ok(!assigned.some(a=>a.cardId==='footer'));
});
test('page boundaries have no missing or duplicate people and retain row order',()=>{
 for(const count of [1,6,7,12,13,500]){const plan=planGrid(template,0,layout,mappings,count),rows=Array.from({length:count},(_,i)=>({id:String(i),record:i+5,excelRow:i+7})),assigned=gridAssignments(plan,rows);assert.equal(plan.pages,Math.ceil(count/6));assert.equal(new Set(assigned.map(a=>a.id)).size,count);assert.deepEqual(assigned.map(a=>a.record),rows.map(r=>r.record));assert.equal(assigned.at(-1).page,plan.pages);}
});

test('1,036 people fit a compact centered artboard grid without moving card positions within pages',()=>{
 const full={artboards:[{width:612,height:1008,cards:Array.from({length:56},(_,i)=>({...cards[0],id:'slot-'+i,targetIds:i?['other-'+i]:['name-4']}))}]};
 const plan=planGrid(full,0,{cardId:'slot-0'},mappings,1036);
 assert.equal(plan.pages,19);assert.equal(plan.across,6);
 for(let i=0;i<plan.pages;i++){
  const x=plan.shiftX+(i%plan.across)*652,y=plan.shiftY-Math.floor(i/plan.across)*1048;
  assert.ok(x>=-7500&&x+612<=7500);assert.ok(y>=-7500&&y-1008<=7500);
 }
 const assignments=gridAssignments(plan,Array.from({length:1036},(_,i)=>({id:String(i),record:i+1,excelRow:i+2})));
 assert.equal(assignments.at(-1).page,19);assert.equal(assignments.at(-1).slot,28);
 assert.equal(new Set(assignments.map(a=>a.id)).size,1036);
});
test('page fields are separate from the repeated card and other cards cannot be mapped',()=>{
 const all=[...mappings,{kind:'text',targetId:'month',column:1},{kind:'position',column:2,x:.1,y:.9,width:.2,fontSize:12}];const plan=planGrid(template,0,layout,all,5),parts=splitMappings(plan,all);assert.equal(parts.card.length,1);assert.equal(parts.page.length,2);
 assert.throws(()=>planGrid(template,0,layout,[...mappings,{kind:'text',targetId:'name-0',column:1}],5),/another card/);
 assert.throws(()=>planGrid(template,0,layout,[{kind:'text',targetId:'month',column:0}],5),/inside/);
});
test('missing analysis, invalid card, empty ranges and excessive pages fail before Illustrator',()=>{
 assert.throws(()=>planGrid({artboards:[{}]},0,layout,mappings,5),/Analyze/);
 assert.throws(()=>planGrid(template,0,{cardId:'unknown'},mappings,5),/sample card/);
 for(const count of [0,1.5,-1,5001])assert.throws(()=>planGrid(template,0,layout,mappings,count));
 const huge={artboards:[{width:14000,height:14000,cards:[cards[4]]}]};assert.throws(()=>planGrid(huge,0,layout,mappings,2),/canvas/);
});
