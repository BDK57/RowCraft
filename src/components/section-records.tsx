import {useEffect,useId,useState} from 'react';
import type {Studio} from '@/hooks/use-studio';
import type {ArtworkSection} from '@/lib/types';
import {sectionRange} from '../../server/sections.mjs';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';

export function SectionRows({s,section,onChange}:{s:Studio;section:ArtworkSection;onChange:(ids:string[],error?:string)=>void}){
 const records=s.sheet?.rows.filter(row=>section.recordIds.includes(row.id))||[];
 const [draft,setDraft]=useState({from:String(records[0]?.record||1),to:String(records.at(-1)?.record||5)}),errorId=useId();
 const first=records[0]?.record,last=records.at(-1)?.record;
 // External selections may be sparse. Reflect their endpoints without expanding them.
 useEffect(()=>{if(!section.rangeError)setDraft({from:String(first||1),to:String(last||5)});},[first,last,section.id]);
 function commit(next:typeof draft){
  const result=sectionRange(s.sheet,next.from,next.to);
  onChange(result.recordIds??section.recordIds,result.error||undefined);
 }
 function change(key:'from'|'to',value:string){const next={...draft,[key]:value};setDraft(next);commit(next);}
 return <div className="section-records"><Label>Excel records for this section</Label><div className="section-range">
  <Input type="number" min={1} max={s.sheet?.rows.length} aria-label="Section record from" aria-invalid={!!section.rangeError} aria-describedby={section.rangeError?errorId:undefined} disabled={s.running} value={draft.from} onChange={e=>change('from',e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit(draft);}}}/><span>to</span>
  <Input type="number" min={1} max={s.sheet?.rows.length} aria-label="Section record to" aria-invalid={!!section.rangeError} aria-describedby={section.rangeError?errorId:undefined} disabled={s.running} value={draft.to} onChange={e=>change('to',e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit(draft);}}}/>
  <Button variant="secondary" size="sm" disabled={s.running} onClick={()=>commit(draft)}>Apply</Button></div>
  {section.rangeError&&<p id={errorId} role="alert" className="text-destructive text-xs">{section.rangeError}</p>}
  <p className="text-xs text-muted-foreground">Valid ranges apply automatically, including both endpoints. {records.length} cards selected.</p>
  <Button variant="ghost" size="sm" disabled={s.running||!s.selectedRows.length} onClick={()=>{onChange(s.selectedRows.map(row=>row.id));setDraft({from:String(s.selectedRows[0]?.record||1),to:String(s.selectedRows.at(-1)?.record||1)});}}>Use selection from People</Button>
 </div>;
}
