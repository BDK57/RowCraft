import ExcelJS from 'exceljs';
import path from 'node:path';

export function cellValue(cell){
  let value=cell.value;
  if(value===null||value===undefined)return '';
  if(value&&typeof value==='object'&&('formula' in value||'sharedFormula' in value)){
    if(value.result===undefined||value.result===null)throw Error(`Cell ${cell.address}: recalculate and save the workbook in Excel first.`);
    value=value.result;
  }
  if(value instanceof Date){if(Number.isNaN(value.getTime()))throw Error(`Invalid date at ${cell.address}`);return value.toISOString().slice(0,10);}
  if(typeof value==='object'){
    if('error' in value)throw Error(`Excel error ${value.error} at ${cell.address}`);
    if('richText' in value)return value.richText.map(r=>r.text).join('');
    if('text' in value)return String(value.text);
    throw Error(`Unsupported cell value at ${cell.address}`);
  }
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw Error(`Invalid number at ${cell.address}`);
    const fmt=cell.numFmt||'';
    if(/^0+$/.test(fmt)&&Number.isInteger(value))return String(value).padStart(fmt.length,'0');
    if(fmt.includes('%'))return `${Number((value*100).toFixed(2))}%`;
    return Number.isInteger(value)?String(value):String(Number(value.toPrecision(15)));
  }
  return String(value);
}
export function normalizeSheet(name,raw){
  if(!raw.length)return {name,columns:[],rows:[],skippedHeaders:[]};
  const [headerRow,header]=raw[0],width=Math.max(...raw.map(([,v])=>v.length));
  const seen=new Map(),original=Array.from({length:width},(_,i)=>header[i]||'');
  const columns=original.map((v,i)=>{const base=v.trim()||`Column ${i+1}`;const n=(seen.get(base)||0)+1;seen.set(base,n);return n===1?base:`${base} (${n})`;});
  const rows=[],skippedHeaders=[];
  for(const [excelRow,data,imageRefs] of raw.slice(1)){
    const values=Array.from({length:width},(_,i)=>data[i]||'');
    if(values.every((v,i)=>v.trim()===original[i].trim())){skippedHeaders.push(excelRow);continue;}
    rows.push({id:`${name}:${excelRow}`,record:rows.length+1,excelRow,values,...(imageRefs&&Object.keys(imageRefs).length?{imageRefs}:{})});
  }
  return {name,headerRow,columns,rows,skippedHeaders};
}
export async function readWorkbook(source){
  const wb=new ExcelJS.Workbook();
  if(path.extname(source).toLowerCase()==='.csv')await wb.csv.readFile(source);else await wb.xlsx.readFile(source);
  const sheets=[];
  for(const sheet of wb.worksheets){
    if(sheet.rowCount>100000||sheet.columnCount>500)throw Error('This workbook exceeds the preview limit of 100,000 rows or 500 columns per sheet.');
    const raw=[];sheet.eachRow({includeEmpty:false},row=>{const imageRefs={};const values=Array.from({length:sheet.columnCount},(_,i)=>{const cell=row.getCell(i+1);if(typeof cell.hyperlink==='string'&&cell.hyperlink)imageRefs[i]=cell.hyperlink;return cellValue(cell);});if(values.some(v=>v.trim()))raw.push([row.number,values,imageRefs]);});
    if(raw.length)sheets.push(normalizeSheet(sheet.name,raw));
  }
  if(!sheets.length)throw Error('Workbook contains no populated worksheets.');
  return {sheets};
}
