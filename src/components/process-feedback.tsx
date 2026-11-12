import {useEffect,useRef} from 'react';
import {useReducedMotion} from 'motion/react';
import {LoaderCircle} from 'lucide-react';
import {Progress} from '@/components/ui/progress';
import {toast} from '@/components/ui/toast';
import type {Job} from '@/lib/types';

export type ProcessStart={id:number;label:string};
export function ProcessFeedback({start,running,busy,job}:{start:ProcessStart|null;running:boolean;busy:string;job:Job|null}){
 const progress=useRef<HTMLDivElement>(null),reduced=useReducedMotion();
 const working=!!job&&['queued','running'].includes(job.status);
 useEffect(()=>{
  if(!start)return;
  toast.close('studio-notice');
  toast.add({id:'studio-process',type:'loading',title:'Process started',description:`${start.label}. Follow its progress above.`,timeout:6000});
  const frame=requestAnimationFrame(()=>progress.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start',inline:'nearest'}));
  return()=>cancelAnimationFrame(frame);
 },[start?.id,reduced]);
 useEffect(()=>{if(!running)toast.close('studio-process');},[running]);
 if(!running)return null;
 return <div ref={progress} className="render-progress" role="status" aria-label="Process progress" tabIndex={-1}><div><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none"/><strong>{working?job!.message:busy||'Loading saved images'}</strong>{working&&job!.status==='running'&&<span>{job!.progress}%</span>}</div>{working&&<Progress aria-label="Illustrator progress" value={job!.progress}/>}<p>{working?'Illustrator is preparing your artwork. You can keep reviewing this batch.':'Your workspace is being updated.'}</p></div>;
}
