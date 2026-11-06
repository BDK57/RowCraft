import {useId,useState} from 'react';
import {Archive,ArrowDownToLine,FileCheck,ChevronDown,Eye,FolderOpen,RefreshCw} from 'lucide-react';
import {motion,useReducedMotion} from 'motion/react';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import type {Job} from '@/lib/types';

type BatchHistoryProps={jobs:Job[];onPreview:(src:string)=>void;onRefresh:()=>void;busy:boolean};
const createdTimeFormat=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true});

function BatchCreatedTime({job}:{job:Job}){
 const date=job.createdAt?new Date(job.createdAt):null;
 if(!date||Number.isNaN(date.getTime()))return <span className="batch-created">Creation time unavailable</span>;
 const label=createdTimeFormat.format(date).replace(/\b(am|pm)\b/g,value=>value.toUpperCase());
 return <span className="batch-created">Created <time dateTime={date.toISOString()} title={job.createdAtSource==='folder'?'Local time · based on this older batch’s job-folder creation time':'Local time'}>{label}</time></span>;
}

function BatchDetails({job,onPreview}:{job:Job;onPreview:(src:string)=>void}){
 const [showWarnings,setShowWarnings]=useState(false);
 const result=job.result!,previews=result.previews??[],warnings=result.warnings??[],shortId=job.id.slice(0,8);
 return <div className="batch-details">
  <p>{result.proof?'First populated page for checking your layout.':'Editable artwork with only your selected people.'}</p>
  <div className="batch-downloads">
   {result.ai&&<Button asChild variant="outline" size="sm"><a href={result.ai} download aria-label={'Download Illustrator file for batch '+shortId}><ArrowDownToLine aria-hidden="true"/>Illustrator .ai</a></Button>}
   {result.pdf&&<Button asChild variant="outline" size="sm"><a href={result.pdf} download aria-label={'Download PDF for batch '+shortId}><ArrowDownToLine aria-hidden="true"/>PDF</a></Button>}
   {result.archive&&<Button asChild variant="outline" size="sm"><a href={result.archive} download aria-label={'Download ZIP for batch '+shortId}><Archive aria-hidden="true"/>ZIP</a></Button>}
   {previews[0]&&<Button variant="ghost" size="sm" onClick={()=>onPreview(previews[0])} aria-label={'Preview first page of batch '+shortId}><Eye aria-hidden="true"/>Preview</Button>}
  </div>
  {previews.length>1&&<div className="batch-pages"><span>Page previews</span>{previews.map((src,i)=><Button key={src} variant="secondary" size="sm" onClick={()=>onPreview(src)} aria-label={'Preview page '+(i+1)+' of batch '+shortId}>Page {i+1}</Button>)}</div>}
  {!!warnings.length&&<div className="batch-warnings"><strong>{warnings.length} {warnings.length===1?'item':'items'} to review</strong><ul>{(showWarnings?warnings:warnings.slice(0,5)).map((warning,i)=><li key={i}>{warning}</li>)}</ul>{warnings.length>5&&<Button variant="ghost" size="sm" aria-expanded={showWarnings} onClick={()=>setShowWarnings(v=>!v)}>{showWarnings?'Show fewer notes':`Show all ${warnings.length} review notes`}</Button>}</div>}
  {result.folder&&<div className="batch-folder"><span><FolderOpen aria-hidden="true"/>Saved folder</span><code>{result.folder}</code><p>Download buttons save a separate copy to your browser’s download folder.</p></div>}
 </div>;
}

export function BatchHistory({jobs,onPreview,onRefresh,busy}:BatchHistoryProps){
 const [showAll,setShowAll]=useState(false),reduce=useReducedMotion(),titleId=useId(),listId=useId();
 const completed=jobs.filter(job=>job.status==='complete'&&job.type!=='inspect'&&job.result);
 const visible=showAll?completed:completed.slice(0,6);
 return <section aria-labelledby={titleId} className="work-panel batch-history">
  <div className="panel-top"><div><div className="batch-history-title"><h2 id={titleId}>Batch history</h2><Badge variant="secondary">{completed.length}</Badge></div><p>Expand a batch for its files, previews, and review notes.</p></div><Button variant="ghost" size="icon" onClick={onRefresh} disabled={busy} aria-label="Refresh batch history"><RefreshCw aria-hidden="true" className={busy&&!reduce?'animate-spin':''}/></Button></div>
  {completed.length?<Accordion type="single" collapsible defaultValue={completed[0]?.id} id={listId} className="batch-accordion">
   {visible.map(job=>{const result=job.result!;return <AccordionItem key={job.id} value={job.id}>
    <AccordionTrigger className="batch-trigger" aria-label={(result.proof?'Page proof':'Batch export')+' '+job.id.slice(0,8)+', '+result.count+' cards'}>
     <span className="batch-state"><FileCheck aria-hidden="true"/></span>
     <span className="batch-identity"><strong>{result.proof?'Page proof':'Batch export'} <span>#{job.id.slice(0,8)}</span></strong><small>{result.count.toLocaleString()} {result.count===1?'card':'cards'} · {result.pages??1} {(result.pages??1)===1?'page':'pages'}</small><BatchCreatedTime job={job}/></span>
     {!!result.warnings?.length&&<Badge variant="secondary" className="batch-review-count">{result.warnings.length} to review</Badge>}
    </AccordionTrigger>
    <AccordionContent className="batch-accordion-content"><motion.div initial={reduce?false:{opacity:0,y:3}} animate={{opacity:1,y:0}} transition={{duration:reduce?0:.16}}><BatchDetails job={job} onPreview={onPreview}/></motion.div></AccordionContent>
   </AccordionItem>;})}
  </Accordion>:<div className="batch-empty"><Archive aria-hidden="true"/><h3>No completed batches yet</h3><p>Your proofs and generated artwork will appear here.</p></div>}
  {completed.length>6&&<div className="batch-history-more"><Button variant="ghost" className="w-full" aria-expanded={showAll} aria-controls={listId} onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer batches':'Show all '+completed.length+' batches'}<ChevronDown aria-hidden="true" className={showAll?'rotate-180':''}/></Button></div>}
 </section>;
}
