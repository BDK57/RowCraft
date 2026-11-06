import {useState} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {ArrowDown,ArrowUp,ArrowRight,Check,ChevronLeft,ChevronRight,FileSpreadsheet,FileCheck,ScanText,LockKeyhole,Search,Upload,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {Label} from '@/components/ui/label';
import {Badge} from '@/components/ui/badge';
import {ChoiceSelect} from '@/components/choice-select';
import type {Studio} from '@/hooks/use-studio';

export default function DataStep({s}:{s:Studio}){
 const [dragging,setDragging]=useState(false);
 const reduce=useReducedMotion();
 const guideMotion={hidden:{opacity:0,y:10},visible:{opacity:1,y:0,transition:{duration:reduce?0:.24}}};
 const identity=s.sheet?.columns.findIndex(c=>/shop.?name|first.?name|^name$/i.test(c))??-1;
 const headers=s.table.getFlatHeaders();
 const orderedHeaders=identity>=0?[...headers.filter(h=>h.id===String(identity)),...headers.filter(h=>h.id!==String(identity))]:headers;
 const validRange=!!s.sheet&&Number.isInteger(s.rangeStart)&&Number.isInteger(s.rangeEnd)&&s.rangeStart>=1&&s.rangeEnd>=s.rangeStart&&s.rangeEnd<=s.sheet.rows.length;
 const pageChecked=s.pageRows.length>0&&s.pageRows.every(r=>s.selected.has(r.id));
 const pageSome=s.pageRows.some(r=>s.selected.has(r.id));
 function drop(e:React.DragEvent){e.preventDefault();setDragging(false);const file=e.dataTransfer.files[0];if(file&&!s.running)void s.uploadFile(file,'workbooks');}
 return <div className="step-body">
  <div className={`source-file ${dragging?'is-dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={drop}>
   <FileSpreadsheet size={26} strokeWidth={1.5} aria-hidden="true"/>
   <div className="min-w-0 flex-1"><h2>{s.workbook?.name||'Your Excel workbook'}</h2><p>{s.workbook?`${s.workbook.sheets.length} worksheets · XLSX / CSV · Stored on this computer`:'Upload a winner list, or drop your XLSX or CSV file here.'}</p></div>
   <div className="source-actions"><Button variant="ghost" disabled={s.running} onClick={()=>void s.demo('workbook')}>Use supplied workbook</Button><Button variant={s.workbook?'outline':'default'} disabled={s.running} onClick={()=>s.workbookInput.current?.click()}><Upload aria-hidden="true"/>{s.workbook?'Replace file':'Upload workbook'}</Button></div>
  </div>
  {s.sheet?<section className="work-panel people-panel" aria-label="Workbook preview">
   <div className="panel-top"><div><h2>People in this batch</h2><p>{s.sheet.rows.length.toLocaleString()} people available in {s.sheetName}</p></div><div className="worksheet-control"><Label>Worksheet</Label><ChoiceSelect label="Worksheet" value={s.sheetName} onChange={s.chooseSheet} options={s.workbook!.sheets.map(sheet=>({value:sheet.name,label:sheet.name}))}/></div></div>
   <div className="people-toolbar"><div className="search-input"><Search size={16} aria-hidden="true"/><Input aria-label="Search records" placeholder="Search a shop, city, or phone…" value={s.query} onChange={e=>{s.setQuery(e.target.value);s.setPage(0);}}/>{s.query&&<button aria-label="Clear search" onClick={()=>{s.setQuery('');s.setPage(0);}}><X size={14}/></button>}</div><div className="range-control"><span>Record range</span><Input aria-label="First record" type="number" min={1} max={s.sheet.rows.length} value={s.rangeStart} onChange={e=>s.setRangeStart(Number(e.target.value))} onKeyDown={e=>{if(e.key==='Enter')s.applyRange();}}/><span>to</span><Input aria-label="Last record" type="number" min={1} max={s.sheet.rows.length} value={s.rangeEnd} onChange={e=>s.setRangeEnd(Number(e.target.value))} onKeyDown={e=>{if(e.key==='Enter')s.applyRange();}}/><Button variant="outline" onClick={s.applyRange} disabled={!validRange}>Select range</Button></div></div>
   {!validRange&&<p className="inline-field-error" role="alert">Enter a range between 1 and {s.sheet.rows.length.toLocaleString()}, with the last record after the first.</p>}
   <div className="selection-toolbar"><span className="selected-count"><Check size={14} aria-hidden="true"/><strong>{s.selectedRows.length.toLocaleString()}</strong> selected</span><Button variant="ghost" size="sm" onClick={()=>s.setSelected(new Set(s.sheet!.rows.map(r=>r.id)))}>Select all {s.sheet.rows.length.toLocaleString()}</Button><Button variant="ghost" size="sm" disabled={!s.selectedRows.length} onClick={()=>s.setSelected(new Set())}>Clear selection</Button><span className="selection-hint">One person becomes one card.</span></div>
   <div className="people-table-scroll" tabIndex={0} aria-label="Scrollable Excel data"><table className="people-table"><thead><tr><th className="selection-col"><Checkbox aria-label="Select current page" checked={pageChecked?true:pageSome?'indeterminate':false} onCheckedChange={checked=>s.setSelected(current=>{const next=new Set(current);s.pageRows.forEach(r=>checked===true?next.add(r.id):next.delete(r.id));return next;})}/></th><th className="record-col">Record</th>{orderedHeaders.map(h=><th key={h.id} aria-sort={h.column.getIsSorted()==='asc'?'ascending':h.column.getIsSorted()==='desc'?'descending':'none'} className={/scoring|amount|count|total/i.test(String(h.column.columnDef.header))?'numeric':''}><button className="column-sort" onClick={()=>{h.column.toggleSorting();s.setPage(0);}}>{String(h.column.columnDef.header)}{h.column.getIsSorted()&&(h.column.getIsSorted()==='asc'?<ArrowUp size={13}/>:<ArrowDown size={13}/>)}</button></th>)}<th className="preview-col"><span className="sr-only">Preview</span></th></tr></thead><tbody>{s.pageRows.map(r=><tr key={r.id} data-selected={s.selected.has(r.id)}><td><Checkbox aria-label={`Select record ${r.record}`} checked={s.selected.has(r.id)} onCheckedChange={()=>s.toggle(r.id)}/></td><td className="record-col" title={`Excel row ${r.excelRow}`}>{r.record}</td>{orderedHeaders.map(h=>{const i=Number(h.id),numeric=/scoring|amount|count|total/i.test(String(h.column.columnDef.header));return <td key={h.id} className={`${i===identity?'identity-cell':''} ${numeric?'numeric':''} ${/msisdn|phone|mobile number/i.test(String(h.column.columnDef.header))?'identifier':''}`} title={r.values[i]}>{r.values[i]||<span className="text-muted-foreground">—</span>}</td>;})}<td><Button variant="ghost" size="sm" aria-label={`Preview record ${r.record}`} onClick={()=>{s.setPreviewId(r.id);s.setNotice(`Record ${r.record} will be used for the sample values in the mapping view.`);}}>{s.previewRow?.id===r.id?<Badge variant="secondary">Sample</Badge>:'Use as sample'}</Button></td></tr>)}{!s.pageRows.length&&<tr><td colSpan={orderedHeaders.length+3} className="table-empty"><Search size={22}/><strong>No people match “{s.query}”</strong><Button variant="link" onClick={()=>s.setQuery('')}>Clear search</Button></td></tr>}</tbody></table></div>
   <div className="table-pagination"><span>{s.filtered.length?`${s.page*60+1}–${Math.min((s.page+1)*60,s.filtered.length)} of ${s.filtered.length.toLocaleString()} people`:'0 matches'}{s.sheet.skippedHeaders.length>0&&` · ${s.sheet.skippedHeaders.length} repeated headers skipped`}</span><div><Button variant="ghost" size="icon" aria-label="Previous page" disabled={s.page===0} onClick={()=>s.setPage(p=>p-1)}><ChevronLeft/></Button><span>{s.page+1} / {s.pages}</span><Button variant="ghost" size="icon" aria-label="Next page" disabled={s.page+1>=s.pages} onClick={()=>s.setPage(p=>p+1)}><ChevronRight/></Button></div></div>
  </section>:<section className="batch-getting-started" aria-label="How your print batch comes together">
   <motion.div className="batch-guide-grid" initial={reduce?false:'hidden'} animate="visible" variants={{visible:{transition:{staggerChildren:reduce?0:.06}}}}>
    <motion.article variants={guideMotion} className="batch-guide-card"><FileSpreadsheet aria-hidden="true"/><h2>Start with <br/>your people.</h2><p>Upload your workbook and choose exactly who belongs in this batch.</p><div className="guide-bottom"><span>Excel & CSV</span></div></motion.article>
    <motion.article variants={guideMotion} className="batch-guide-card"><ScanText aria-hidden="true"/><h2>Make every <br/>field yours.</h2><p>Choose one card. Connect its name, score, city, or any label to your columns.</p><div className="guide-bottom"><span>Your Illustrator design</span></div></motion.article>
    <motion.article variants={guideMotion} className="batch-guide-card"><FileCheck aria-hidden="true"/><h2>Ready for <br/>the print run.</h2><p>Preview the result, then download one editable file with only your selected cards.</p><div className="guide-bottom"><span>Editable AI · Print PDF</span></div></motion.article>
   </motion.div>
   <p className="batch-local-message"><LockKeyhole aria-hidden="true"/>Made on this computer. Your files stay with you.</p>
  </section>}
  <div className="workflow-footer"><div><strong>{s.selectedRows.length.toLocaleString()} people selected</strong><p>Records exclude headers. Original Excel row numbers are available on hover.</p></div><Button disabled={!s.selectedRows.length||s.selectedRows.length>5000} onClick={()=>s.setView('design')}>Continue to card mapping<ArrowRight aria-hidden="true"/></Button></div>
  {s.selectedRows.length>5000&&<p className="inline-field-error">Choose up to 5,000 people per batch.</p>}
 </div>;
}
