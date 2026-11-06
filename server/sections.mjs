import {selectedRecords,validateMappings} from './domain.mjs';

export function sectionCards(board,box){
  if(!box)return [];
  return (board?.cards||[]).filter(c=>c.x>=box.x-.001&&c.y>=box.y-.001&&c.x+c.width<=box.x+box.width+.001&&c.y+c.height<=box.y+box.height+.001)
    .sort((a,b)=>Math.abs(a.y-b.y)*(board?.height||1000)>2?a.y-b.y:a.x-b.x);
}

// Shared by the React review and the API: one definition of capacity and pagination.
export function planSections(template,workbook,sheetName,input,{proof=false}={}){
  if(!Array.isArray(input)||!input.length||input.length>20)throw Error('Create between 1 and 20 sections.');
  const usedCards=new Set(),usedLabels=new Set(),ids=new Set();
  let total=0;
  const sections=input.map((s,index)=>{
    const name=String(s.name||`Section ${index+1}`).trim().slice(0,80);
    if(typeof s.id!=='string'||!s.id||ids.has(s.id))throw Error('Each section needs a unique ID.');ids.add(s.id);
    if(!Number.isInteger(s.artboard)||!template.artboards[s.artboard])throw Error(`${name}: choose an existing artboard.`);
    const board=template.artboards[s.artboard],box=s.box;
    if(!box||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>1.001||box.y+box.height>1.001)throw Error(`${name}: draw a valid box inside the artboard.`);
    const slots=sectionCards(board,box),sample=slots.find(c=>c.id===s.cardId);
    if(!sample||!slots.length)throw Error(`${name}: the box must fully contain a sample card.`);
    if(slots.some(c=>c.family!==sample.family))throw Error(`${name}: draw a box around cards of the same design.`);
    for(const card of slots){const key=`${s.artboard}:${card.id}`;if(usedCards.has(key))throw Error(`${name}: sections cannot share card positions.`);usedCards.add(key);}
    const selection=selectedRecords(workbook,sheetName,s.recordIds),checked=validateMappings(s.mappings,template,s.artboard,selection.sheet.columns);
    if(checked.some(m=>m.kind!=='text'||!sample.targetIds.includes(m.targetId)))throw Error(`${name}: map only the selected sample card’s fields.`);
    total+=selection.rows.length;if(total>5000)throw Error('Choose at most 5,000 cards across all sections.');
    if(!Array.isArray(s.labels)||s.labels.length>2)throw Error(`${name}: configure the heading and month labels.`);
    const roles=new Set();
    const labels=s.labels.map(label=>{
      if(!['heading','month'].includes(label.role)||roles.has(label.role))throw Error(`${name}: choose one label per heading or month.`);roles.add(label.role);
      const target=board.targets.find(t=>t.id===label.targetId),key=`${s.artboard}:${label.targetId}`;
      if(!target||board.cards.some(c=>c.targetIds.includes(label.targetId)))throw Error(`${name}: choose a page label outside the cards.`);
      if(usedLabels.has(key))throw Error(`${name}: a page label cannot belong to two sections.`);usedLabels.add(key);
      if(label.source==='literal'){
        if(typeof label.value!=='string'||label.value.length>1000)throw Error(`${name}: enter up to 1,000 characters for the label.`);
        return {role:label.role,targetId:target.id,index:target.index,label:target.text,value:label.value};
      }
      if(label.source!=='column'||!Number.isInteger(label.column)||label.column<0||label.column>=selection.sheet.columns.length)throw Error(`${name}: choose an existing Excel column for the label.`);
      return {role:label.role,targetId:target.id,index:target.index,label:target.text,column:label.column,value:selection.rows[0].values[label.column]};
    });
    const records=proof?selection.rows.slice(0,slots.length):selection.rows;
    return {id:s.id,name,artboard:s.artboard,box,sample,slots,capacity:slots.length,mappings:checked,labels,records,pages:Math.ceil(records.length/slots.length)};
  });
  const boards=[...new Set(sections.map(s=>s.artboard))].sort((a,b)=>a-b).map(artboard=>{
    const own=sections.filter(s=>s.artboard===artboard),board=template.artboards[artboard];
    return {artboard,width:board.width,height:board.height,pages:Math.max(...own.map(s=>s.pages)),sectionIds:own.map(s=>s.id)};
  });
  const count=sections.reduce((sum,s)=>sum+s.records.length,0),pageCount=boards.reduce((sum,b)=>sum+b.pages,0);
  const width=Math.max(...boards.map(b=>b.width)),height=Math.max(...boards.map(b=>b.height));
  const across=Math.min(pageCount,Math.floor(15040/(width+40)),Math.max(1,Math.ceil(Math.sqrt(pageCount*height/width))));
  const down=across>0?Math.ceil(pageCount/across):Infinity,spanWidth=across*(width+40)-40,spanHeight=down*(height+40)-40;
  if(pageCount>1000||across<1||spanWidth>15000||spanHeight>15000)throw Error('These sections exceed Illustrator’s artboard canvas. Select fewer records.');
  const pages=[];
  for(const board of boards)for(let i=0;i<board.pages;i++){const n=pages.length;pages.push({artboard:board.artboard,boardPage:i,width:board.width,height:board.height,x:-spanWidth/2+(n%across)*(width+40),y:spanHeight/2-Math.floor(n/across)*(height+40)});}
  return {sections,boards,pages,count,pageCount};
}

export function sectionAssignments(plan){
  return plan.sections.flatMap(s=>s.records.map((r,i)=>({id:r.id,record:r.record,excelRow:r.excelRow,sectionId:s.id,section:s.name,artboard:s.artboard+1,page:plan.pages.findIndex(p=>p.artboard===s.artboard&&p.boardPage===Math.floor(i/s.capacity))+1,slot:i%s.capacity+1,cardId:s.slots[i%s.capacity].id})));
}
