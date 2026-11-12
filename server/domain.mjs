export function selectedRecords(workbook,sheetName,ids){
  const sheet=workbook.sheets.find(s=>s.name===sheetName);
  if(!sheet)throw new Error('Choose an existing worksheet.');
  if(!Array.isArray(ids)||!ids.length||ids.length>5000)throw new Error('Choose between 1 and 5,000 records.');
  const selected=new Set(ids);
  if(selected.size!==ids.length)throw new Error('Duplicate record selections are not allowed.');
  const rows=sheet.rows.filter(r=>selected.has(r.id));
  if(rows.length!==selected.size)throw new Error('The selection contains records outside this worksheet.');
  return {sheet,rows};
}
export function validateMappings(mappings,template,artboard,columns,{allowEmpty=false}={}){
  if(!Number.isInteger(artboard)||!template.artboards[artboard])throw new Error('Choose a cover.');
  if(!Array.isArray(mappings)||(!mappings.length&&!allowEmpty)||mappings.length>100)throw new Error('Map at least one field.');
  const seen=new Set();
  return mappings.map((m,index)=>{
    if(!Number.isInteger(m.column)||m.column<0||m.column>=columns.length)throw new Error('A mapping refers to a missing Excel column.');
    if(m.kind==='text'){
      const target=template.artboards[artboard].targets.find(t=>t.id===m.targetId);
      if(!target)throw new Error('A selected text field does not belong to this cover.');
      if(seen.has(m.targetId))throw new Error('Map each existing text field only once.');
      seen.add(m.targetId);return {kind:'text',targetId:m.targetId,index:target.index,column:m.column,label:target.text};
    }
    if(m.kind!=='position'||![m.x,m.y,m.width,m.fontSize].every(Number.isFinite)||m.x<0||m.y<0||m.x>1||m.y>1||m.width<0.02||m.width>1||m.x+m.width>1.001||m.fontSize<4||m.fontSize>120)throw new Error('A new text position or size is invalid.');
    if(m.font!==undefined&&(!Array.isArray(template.fonts)||!template.fonts.includes(m.font)))throw new Error('Choose a font used by this Illustrator template.');
    return {kind:'position',id:`position-${index}`,column:m.column,x:m.x,y:m.y,width:m.width,fontSize:m.fontSize,font:m.font||template.fonts?.[0]};
  });
}
export function safeName(value){return String(value).replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,80)||'cover';}
export function validateTextFit(value='preserve'){if(!['preserve','condense'].includes(value))throw Error('Choose a supported text-fitting option.');return value;}
