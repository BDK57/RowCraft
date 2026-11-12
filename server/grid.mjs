// The same deterministic card ordering is used by planning, export and manifests.
export function planGrid(template,artboard,layout,mappings,recordCount){
  const board=template.artboards[artboard];
  if(!board)throw Error('Choose a cover.');
  if(!board.cards?.length)throw Error('Analyze this template to detect its editable card groups.');
  const sample=board.cards.find(c=>c.id===layout?.cardId);
  if(!sample)throw Error('Select the sample card to repeat.');
  const slots=board.cards.filter(c=>c.family===sample.family).sort((a,b)=>Math.abs(a.y-b.y)*board.height>2?a.y-b.y:a.x-b.x);
  if(!slots.length)throw Error('This card has no available grid positions.');
  if(!Number.isInteger(recordCount)||recordCount<1||recordCount>5000)throw Error('Choose between 1 and 5,000 records.');
  if(!mappings.some(m=>m.kind==='text'&&sample.targetIds.includes(m.targetId))&&!sample.photos?.some(photo=>photo.id===layout?.photo?.targetId))throw Error('Map at least one text field or photo inside the selected sample card.');
  if(mappings.some(m=>m.kind==='text'&&!sample.targetIds.includes(m.targetId)&&board.cards.some(c=>c.targetIds.includes(m.targetId))))throw Error('Map fields in the selected sample card, rather than another card.');
  const pages=Math.ceil(recordCount/slots.length);
  const maxAcross=Math.floor((15000+40)/(board.width+40));
  const across=Math.min(pages,maxAcross,Math.max(1,Math.ceil(Math.sqrt(pages*board.height/board.width))));
  const down=across>0?Math.ceil(pages/across):Infinity;
  const spanWidth=across*(board.width+40)-40,spanHeight=down*(board.height+40)-40;
  if(pages>1000||across<1||spanWidth>15000||spanHeight>15000)throw Error('This batch exceeds Illustrator’s artboard canvas. Select a smaller range.');
  // Illustrator's canvas extends around the original page, not 15,000pt to its right.
  const shiftX=-(spanWidth-board.width)/2,shiftY=(spanHeight-board.height)/2;
  return {cardId:sample.id,sample,slots,clearCards:board.cards,capacity:slots.length,pages,across,shiftX,shiftY,recordCount};
}

export function splitMappings(plan,mappings){
  return {card:mappings.filter(m=>m.kind==='text'&&plan.sample.targetIds.includes(m.targetId)),page:mappings.filter(m=>m.kind!=='text'||!plan.sample.targetIds.includes(m.targetId))};
}

export function gridAssignments(plan,records){
  return records.map((r,i)=>({id:r.id,record:r.record,excelRow:r.excelRow,page:Math.floor(i/plan.capacity)+1,slot:i%plan.capacity+1,cardId:plan.slots[i%plan.capacity].id}));
}
