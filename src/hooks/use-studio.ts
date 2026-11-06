import {useEffect,useMemo,useRef,useState} from 'react';
import {getCoreRowModel,getSortedRowModel,useReactTable,type ColumnDef,type SortingState} from '@tanstack/react-table';
import {api,session} from '@/lib/api';
import type {Row,Workbook,Template,Mapping,Job,ArtworkSection} from '@/lib/types';
import {planSections} from '../../server/sections.mjs';

export function useStudio(){
 const [view,setView]=useState<'data'|'design'|'export'>('data');
 const [workbook,setWorkbook]=useState<Workbook|null>(null),[sheetName,setSheetName]=useState(''),[selected,setSelected]=useState<Set<string>>(new Set());
 const [query,setQuery]=useState(''),[page,setPage]=useState(0),[rangeStart,setRangeStart]=useState(1),[rangeEnd,setRangeEnd]=useState(5);
 const [templates,setTemplates]=useState<Template[]>([]),[template,setTemplate]=useState<Template|null>(null),[boardIndex,setBoardIndex]=useState(0);
 const [mappings,setMappings]=useState<Mapping[]>([]),[focus,setFocus]=useState<string|null>(null),[targetSearch,setTargetSearch]=useState('');
 const [cardId,setCardId]=useState(''),[pickingCard,setPickingCard]=useState(true);
 const [batchMode,setBatchMode]=useState<'single'|'sections'>('single'),[sections,setSections]=useState<ArtworkSection[]>([]);
 const [positionMode,setPositionMode]=useState(false),[showFields,setShowFields]=useState(true),[overlay,setOverlay]=useState(false);
 const [previewId,setPreviewId]=useState(''),[presetName,setPresetName]=useState(''),[includePdf,setIncludePdf]=useState(true);
 const [textFit,setTextFit]=useState<'preserve'|'condense'>('preserve');
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[native,setNative]=useState(true);
 const [activeJob,setActiveJob]=useState<Job|null>(null),[jobs,setJobs]=useState<Job[]>([]),[proofImage,setProofImage]=useState<string|null>(null);
 const workbookInput=useRef<HTMLInputElement>(null),templateInput=useRef<HTMLInputElement>(null),canvas=useRef<HTMLDivElement>(null);
 const sheet=workbook?.sheets.find(s=>s.name===sheetName),board=template?.artboards[boardIndex];
 const selectedRows=useMemo(()=>sheet?.rows.filter(r=>selected.has(r.id))||[],[sheet,selected]);
 const filtered=useMemo(()=>sheet?.rows.filter(r=>!query||r.values.some(v=>v.toLowerCase().includes(query.toLowerCase())))||[],[sheet,query]);
 const [sorting,setSorting]=useState<SortingState>([]);
 const tableColumns=useMemo<ColumnDef<Row>[]>(()=>sheet?.columns.map((c,i)=>({id:String(i),header:c,accessorFn:r=>r.values[i],sortingFn:'alphanumeric'}))||[],[sheet]);
 const table=useReactTable({data:filtered,columns:tableColumns,getRowId:r=>r.id,state:{sorting},onSortingChange:setSorting,getCoreRowModel:getCoreRowModel(),getSortedRowModel:getSortedRowModel()});
 const pageRows=table.getRowModel().rows.slice(page*60,(page+1)*60).map(r=>r.original),pages=Math.max(1,Math.ceil(filtered.length/60));
 const previewRow=sheet?.rows.find(r=>r.id===previewId)||selectedRows[0]||sheet?.rows[0];
 const target=board?.targets.find(t=>t.id===focus),focusedMapping=mappings.find(m=>(m.kind==='text'?m.targetId:m.id)===focus);
 const sampleCard=board?.cards?.find(c=>c.id===cardId),gridCards=board?.cards?.filter(c=>sampleCard&&c.family===sampleCard.family)||[];
 const availableTargets=board?.targets.filter(t=>!board.cards?.some(c=>c.targetIds.includes(t.id))||sampleCard?.targetIds.includes(t.id))||[];
 const sectionReview=useMemo(()=>{if(!template||!workbook)return {plan:null,error:'Load a workbook and Illustrator template.'};try{return {plan:planSections(template,workbook,sheetName,sections),error:''};}catch(e){return {plan:null,error:(e as Error).message};}},[template,workbook,sheetName,sections]);
 const batchCount=batchMode==='sections'?sections.reduce((sum,section)=>sum+section.recordIds.length,0):selectedRows.length;
 const batchPages=batchMode==='sections'?sectionReview.plan?.pageCount||0:gridCards.length?Math.ceil(selectedRows.length/gridCards.length):0;
 const ready=batchMode==='sections'?!!sectionReview.plan&&!template?.missingLinks.length:!!sampleCard&&mappings.some(m=>m.kind==='text'&&sampleCard.targetIds.includes(m.targetId||''))&&!!workbook&&!!template&&selectedRows.length>0&&mappings.length>0&&!template.missingLinks.length;
 useEffect(()=>{session().then(s=>setNative(s.nativeAvailable)).catch(e=>setError(e.message));api<Template[]>('/api/templates').then(setTemplates).catch(()=>{});api<Job[]>('/api/jobs').then(setJobs).catch(()=>{});},[]);
 useEffect(()=>{if(!activeJob||['complete','failed'].includes(activeJob.status))return;let stopped=false;const timer=setInterval(async()=>{try{const j=await api<Job>(`/api/jobs/${activeJob.id}`);if(stopped)return;setActiveJob(j);if(j.status==='complete'){setBusy('');if(j.type==='inspect'){const t=j.result as unknown as Template;chooseTemplate(t);setTemplates(ts=>[t,...ts.filter(x=>x.id!==t.id)]);setNotice('Template rendered in Illustrator. Select a cover and map its fields.');setView('design');}else{setJobs(prev=>[j,...prev.filter(x=>x.id!==j.id)]);if(j.result?.proof&&j.result.previews[0])setProofImage(j.result.previews[0]);setNotice(`${j.result?.count} cards generated in one Illustrator file (${j.result?.pages||1} ${(j.result?.pages||1)===1?'page':'pages'}).`);}}else if(j.status==='failed'){setBusy('');setError(j.error||j.message);}}catch(e){if(!stopped){setBusy('');setError((e as Error).message);setActiveJob(null);}}},1200);return()=>{stopped=true;clearInterval(timer);};},[activeJob?.id,activeJob?.status]);
 function chooseSheet(name:string,w=workbook){const s=w?.sheets.find(x=>x.name===name);setSheetName(name);setSections([]);setSelected(new Set(s?.rows.slice(0,5).map(r=>r.id)));setPreviewId(s?.rows[0]?.id||'');setPage(0);setQuery('');setRangeStart(1);setRangeEnd(Math.min(5,s?.rows.length||5));setMappings(template?.preset?.mappings.flatMap(m=>{const col=s?.columns.indexOf(m.columnName||'')??-1;return col>=0?[{...m,column:col}]:[]})||[]);setFocus(null);}
 function acceptWorkbook(w:Workbook){setWorkbook(w);chooseSheet(w.sheets[0]?.name||'',w);setNotice('Workbook loaded. The first five records are selected for a trial.');}
 function chooseTemplate(t:Template){setTemplate(t);setSections([]);const p=t.preset;const next=p?.layout?p.artboard:Math.max(0,t.artboards.findIndex(b=>b.cards?.length));setBoardIndex(next);setCardId(p?.layout?.cardId||'');setPickingCard(!p?.layout?.cardId);setPresetName(p?.name||'');setFocus(null);setMappings(p?.mappings.flatMap(m=>{const col=sheet?.columns.indexOf(m.columnName||'')??-1;return col>=0?[{...m,column:col}]:[]})||[]);}
 async function action(label:string,fn:()=>Promise<void>){setBusy(label);setError('');setNotice('');try{await fn();}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 async function uploadFile(file:File,type:'workbooks'|'templates'){await action(type==='workbooks'?'Reading workbook':'Rendering template',async()=>{const body=new FormData();body.append('file',file);if(type==='workbooks'){acceptWorkbook(await api<Workbook>('/api/workbooks',body));setView('data');}else{const j=await api<Job>('/api/templates',body);setActiveJob(j);}});}
 async function demo(type:'workbook'|'template'){await action(type==='workbook'?'Reading supplied workbook':'Rendering supplied template',async()=>{if(type==='workbook')acceptWorkbook(await api<Workbook>('/api/demo/workbook',{}));else setActiveJob(await api<Job>('/api/demo/template',{}));});}
 function toggle(id:string){setSelected(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next;});}
 function applyRange(){if(!sheet)return;if(!Number.isInteger(rangeStart)||!Number.isInteger(rangeEnd)||rangeStart<1||rangeEnd<rangeStart||rangeEnd>sheet.rows.length){setError(`Choose a record range from 1 through ${sheet.rows.length}.`);return;}setSelected(new Set(sheet.rows.slice(rangeStart-1,rangeEnd).map(r=>r.id)));setError('');}
 function selectCard(id:string){setCardId(id);setPickingCard(false);setFocus(null);setPositionMode(false);setMappings(ms=>ms.filter(m=>m.kind==='position'||!board?.cards?.some(c=>c.targetIds.includes(m.targetId||''))));setNotice('Sample card selected. Map its fields to Excel columns. Other cards are removed and filled from your selected rows.');}
 async function analyzeCards(){if(!template)return;await action('Analyzing card structure',async()=>setActiveJob(await api<Job>(`/api/templates/${template.id}/analyze`,{})));}
 function changeBoard(index:number){setBoardIndex(index);setCardId('');setPickingCard(true);setMappings([]);setFocus(null);setPositionMode(false);setPresetName('');}
 function mapColumn(column:number){if(!focus)return;setMappings(current=>{const others=current.filter(m=>(m.kind==='text'?m.targetId:m.id)!==focus);if(column<0)return others;if(target)return [...others,{kind:'text',targetId:focus,column}];if(focusedMapping)return [...others,{...focusedMapping,column}];return current;});}
 function addPosition(e:React.MouseEvent<HTMLDivElement>){if(!positionMode||!canvas.current||!sheet)return;const r=canvas.current.getBoundingClientRect();const x=Math.min(.95,Math.max(0,(e.clientX-r.left)/r.width)),y=Math.min(.98,Math.max(.02,(e.clientY-r.top)/r.height));const id=`position-${Date.now()}`;setMappings(ms=>[...ms,{kind:'position',id,column:0,x,y,width:Math.min(.35,1-x),fontSize:target?.fontSize||14,font:target?.font||template?.fonts[0]}]);setFocus(id);setPositionMode(false);}
 function updatePosition(key:'x'|'y'|'width'|'fontSize',value:number){setMappings(ms=>ms.map(m=>m.id===focus?{...m,[key]:value}:m));}
 async function savePreset(){if(!template||!sheet)return;await action('Saving mapping',async()=>{const t=await api<Template>(`/api/templates/${template.id}/preset`,{name:presetName||'My cover mapping',artboard:boardIndex,layout:{cardId},mappings,columns:sheet.columns});setTemplate(t);setTemplates(ts=>[t,...ts.filter(x=>x.id!==t.id)]);setNotice('Mapping saved. Reuse this template with another workbook containing the same column names.');});}
 async function refreshTemplates(){await action('Refreshing templates',async()=>{const list=await api<Template[]>('/api/templates');setTemplates(list);const current=list.find(t=>t.id===template?.id);if(current&&!current.missingLinks.length)setTemplate(current);else{const healthy=list.find(t=>!t.missingLinks.length);if(healthy)chooseTemplate(healthy);}setNotice('Template library refreshed. Available linked assets have been checked.');});}
 async function generate(proof:boolean){if(!workbook||!template)return;await action(proof?'Submitting proof':'Submitting export',async()=>{const j=await api<Job>('/api/jobs',{workbookId:workbook.id,templateId:template.id,sheetName,...(batchMode==='sections'?{sections}:{recordIds:selectedRows.map(r=>r.id),artboard:boardIndex,layout:{cardId},mappings}),proof,includePdf,textFit});setActiveJob(j);if(!proof)setView('export');});}
 const running=!!busy||!!activeJob&&!['complete','failed'].includes(activeJob.status);

 function mapTarget(targetId:string,column:number){
   setFocus(targetId);
   setMappings(current=>{const other=current.filter(m=>m.targetId!==targetId);return column<0?other:[...other,{kind:'text',targetId,column}];});
 }
 async function refreshJobs(){await action('Refreshing batches',async()=>setJobs(await api<Job[]>('/api/jobs')));}
 return {batchMode,setBatchMode,sections,setSections,sectionReview,batchCount,batchPages,view,setView,workbook,setWorkbook,sheetName,setSheetName,selected,setSelected,query,setQuery,page,setPage,rangeStart,setRangeStart,rangeEnd,setRangeEnd,templates,setTemplates,template,setTemplate,boardIndex,setBoardIndex,mappings,setMappings,focus,setFocus,targetSearch,setTargetSearch,cardId,setCardId,pickingCard,setPickingCard,positionMode,setPositionMode,showFields,setShowFields,overlay,setOverlay,previewId,setPreviewId,presetName,setPresetName,includePdf,setIncludePdf,textFit,setTextFit,busy,setBusy,error,setError,notice,setNotice,native,setNative,activeJob,setActiveJob,jobs,setJobs,proofImage,setProofImage,sorting,setSorting,workbookInput,templateInput,canvas,sheet,board,selectedRows,filtered,table,pageRows,pages,previewRow,target,focusedMapping,sampleCard,gridCards,availableTargets,ready,running,chooseSheet,chooseTemplate,action,uploadFile,demo,toggle,applyRange,selectCard,analyzeCards,changeBoard,mapColumn,addPosition,updatePosition,savePreset,refreshTemplates,generate,mapTarget,refreshJobs};
}
export type Studio=ReturnType<typeof useStudio>;
