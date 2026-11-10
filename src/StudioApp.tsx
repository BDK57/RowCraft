import {lazy,Suspense,useState,useEffect,type CSSProperties} from 'react';
import {AnimatePresence,motion,MotionConfig,useReducedMotion} from 'motion/react';
import {Archive,ArrowRight,Check,CheckCircle2,ChevronRight,FileSpreadsheet,HelpCircle,Layers,LoaderCircle,LockKeyhole,Menu,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {TooltipProvider} from '@/components/ui/tooltip';
import {ThemeProvider} from '@/components/theme-provider';
import {ThemeToggle} from '@/components/theme-toggle';
import {WorkspaceDialogs} from '@/components/workspace-dialogs';
import {useStudio} from '@/hooks/use-studio';
import {AppSidebar} from '@/components/app-sidebar';
import {AppBrand} from '@/components/app-brand';
import {SidebarProvider,SidebarTrigger} from '@/components/ui/sidebar';
import {workflowSteps as steps,type WorkflowView} from '@/lib/workflow';
import {Toaster,toast} from '@/components/ui/toast';

const People=lazy(()=>import('@/components/data-step'));
const Design=lazy(()=>import('@/components/design-step'));
const Review=lazy(()=>import('@/components/review-step'));
function AppShell(){
 const s=useStudio(),reduced=useReducedMotion(),[help,setHelp]=useState(false);
 const current=steps.findIndex(step=>step.id===s.view),peopleReady=s.batchMode==='sections'&&s.sections.length>0?!!s.sheet:!!s.selectedRows.length&&s.selectedRows.length<=5000;
 const complete=[peopleReady,s.ready,s.activeJob?.status==='complete'&&s.activeJob.type==='generate'];
 const working=!!s.activeJob&&['queued','running'].includes(s.activeJob.status);
 useEffect(()=>{if(s.error)toast.add({id:'studio-error',type:'error',title:'Could not complete the action',description:s.error,timeout:0});else toast.close('studio-error');},[s.error]);
 useEffect(()=>{if(s.notice)toast.add({id:'studio-notice',type:'success',title:'Workspace updated',description:s.notice,timeout:6000});},[s.notice]);
 function move(view:WorkflowView){s.setView(view);}
 return <TooltipProvider><SidebarProvider defaultOpen={false} className="studio-shell" style={{'--sidebar-width':'var(--studio-sidebar-width)','--sidebar-width-icon':'var(--studio-sidebar-rail)'} as CSSProperties}>
  <AppSidebar view={s.view} complete={complete} peopleReady={peopleReady} ready={s.ready} selectedCount={s.batchCount} sectionMode={s.batchMode==='sections'} onNavigate={move} onHelp={()=>setHelp(true)}/>
  <main className="studio-main" id="main-workspace"><header className="studio-topbar"><div className="topbar-context"><SidebarTrigger aria-label="Toggle navigation"/><AppBrand compact className="topbar-brand"/><span className="desktop-context"><ChevronRight size={13}/><strong title={s.workbook?.name}>{s.workbook?.name||'New print batch'}</strong></span></div><div className="topbar-tools"><span className={`renderer-status ${s.native?'':'is-offline'}`}><span/>{s.native?'Local Illustrator':'Renderer unavailable'}</span><ThemeToggle/><Button variant="ghost" size="icon" aria-label="Help with this workflow" onClick={()=>setHelp(true)}><HelpCircle/></Button></div></header>
   <div className="studio-sheet"><div className="mobile-stepper" aria-label="Workflow steps">{steps.map((step,index)=><Button variant="ghost" key={step.id} aria-current={s.view===step.id?'step':undefined} disabled={index===1&&!peopleReady||index===2&&!s.ready} onClick={()=>move(step.id)}><span>{complete[index]?<Check size={13}/>:index+1}</span>{step.label}</Button>)}</div>
    <div className="workspace-heading"><div><h1>{s.view==='data'?(s.workbook?'People for this batch':'From rows to print-ready.'):s.view==='design'?'Card & fields':'Review & export'}</h1><p>{s.view==='data'?(s.workbook?'Choose the people who belong in your next print batch.':'Your people. Your design. One beautifully personalized print batch.'):s.view==='design'?(s.batchMode==='sections'?'Define each section and connect its cards, heading, and month.':'Choose one complete card and connect its text to your Excel columns.'):'Check the proof, then create one editable file with the selected cards.'}</p></div><div className="workspace-scope"><span>{s.sheetName||'New workspace'}</span>{s.batchCount>0&&<strong>{s.batchCount.toLocaleString()} {s.batchMode==='sections'?'cards configured':'people selected'}</strong>}</div></div>
    {s.running&&<div className="render-progress" role="status"><div><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none"/><strong>{working?s.activeJob!.message:s.busy}</strong>{working&&s.activeJob!.status==='running'&&<span>{s.activeJob!.progress}%</span>}</div>{working&&<Progress aria-label="Illustrator progress" value={s.activeJob!.progress}/>}<p>{working?'Illustrator is preparing your artwork. You can keep reviewing this batch.':'Your workspace is being updated.'}</p></div>}
    <input ref={s.workbookInput} className="sr-only" type="file" accept=".xlsx,.csv" aria-label="Upload workbook" onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void s.uploadFile(file,'workbooks');}}/>
    <AnimatePresence initial={false} mode="wait"><motion.div key={s.view} initial={reduced?false:{opacity:0,x:6}} animate={{opacity:1,x:0}} exit={reduced?undefined:{opacity:0,x:-4}} transition={{duration:reduced?0:.16,ease:'easeOut'}}><Suspense fallback={<div className="loading-step" role="status"><LoaderCircle className="size-5 animate-spin motion-reduce:animate-none"/>Opening your workspace…</div>}>{s.view==='data'?<People s={s}/>:s.view==='design'?<Design s={s}/>:<Review s={s}/>}</Suspense></motion.div></AnimatePresence>
   </div><footer className="studio-footnote"><span>RowCraft</span><span>Editable AI · Print PDF · Local processing</span></footer>
  </main><WorkspaceDialogs s={s} help={help} onHelp={setHelp}/>
 </SidebarProvider></TooltipProvider>;
}
export default function StudioApp(){return <ThemeProvider><MotionConfig reducedMotion="user"><AppShell/><Toaster/></MotionConfig></ThemeProvider>;}
