import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {useReducedMotion} from 'motion/react';
import {ArrowRight,Check,MousePointer2,Plus,Scan,Trash2,X} from 'lucide-react';
import ZoomCanvas from '@/ZoomCanvas';
import type {Studio} from '@/hooks/use-studio';
import type {ArtworkSection,SectionLabel} from '@/lib/types';
import {sectionCards} from '../../server/sections.mjs';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Badge} from '@/components/ui/badge';
import {ChoiceSelect} from '@/components/choice-select';
import {SectionRows} from '@/components/section-records';
import {PhotoEditor,PhotoFrame,useResolvedPhoto} from '@/components/card-images';

const clean=(text:string)=>text.replace(/[\r\n]+/g,' ')||'(empty text)';
type Box=ArtworkSection['box'];


export function SectionEditor({s}:{s:Studio}){
 const [activeId,setActiveId]=useState(s.sections.find(section=>section.artboard===s.boardIndex)?.id||''),[drawing,setDrawing]=useState(false),[draft,setDraft]=useState<Box|null>(null),[pickLabel,setPickLabel]=useState<SectionLabel['role']|null>(null),[drawError,setDrawError]=useState('');
 const [precise,setPrecise]=useState<Box>({x:0,y:0,width:1,height:1});
 const start=useRef<{x:number;y:number}|null>(null),surface=useRef<HTMLDivElement>(null),rows=useRef(new Map<string,HTMLElement>()),reduce=useReducedMotion();
 const [navigation,setNavigation]=useState<{id:string}|null>(null),[flash,setFlash]=useState<string|null>(null);
 const active=s.sections.find(section=>section.id===activeId),board=s.board;
 const slots=sectionCards(board,active?.artboard===s.boardIndex?active.box:undefined),sample=slots.find(card=>card.id===active?.cardId);
 const targets=board?.targets.filter(target=>sample?.targetIds.includes(target.id))||[];
 const pageTargets=board?.targets.filter(target=>!board.cards?.some(card=>card.targetIds.includes(target.id)))||[];
 const [photoRows,setPhotoRows]=useState<Record<string,string>>({});
 const photoRowsInSection=s.sheet?.rows.filter(row=>active?.recordIds.includes(row.id))||[];
 const photoRow=photoRowsInSection.find(row=>row.id===photoRows[activeId])||photoRowsInSection[0];
 const photoTarget=sample?.photos?.find(p=>p.id===active?.photoTargetId)||sample?.photos?.[0];
 const resolvedPhoto=useResolvedPhoto(s,photoRow);
 const first=s.sheet?.rows.find(row=>active?.recordIds.includes(row.id));
 const columns=s.sheet?.columns.map((label,index)=>({value:String(index),label}))||[];
 const onBoard=s.sections.filter(section=>section.artboard===s.boardIndex);

 useEffect(()=>{if(activeId&&!active)setActiveId(s.sections.find(section=>section.artboard===s.boardIndex)?.id||'');},[activeId,active,s.sections,s.boardIndex]);
 useEffect(()=>{
  if(!navigation)return;let timer:ReturnType<typeof setTimeout>;
  const frame=requestAnimationFrame(()=>{const row=rows.current.get(navigation.id);if(row){row.scrollIntoView({behavior:reduce?'instant':'smooth',block:'start',inline:'nearest'});setFlash(navigation.id);timer=setTimeout(()=>setFlash(null),1800);}});
  return()=>{cancelAnimationFrame(frame);clearTimeout(timer);};
 },[navigation,reduce]);

 function update(change:Partial<ArtworkSection>){s.setSections(current=>current.map(section=>section.id===activeId?{...section,...change}:section));}
 function choose(section:ArtworkSection){setActiveId(section.id);s.setBoardIndex(section.artboard);s.setFocus(null);setPickLabel(null);setDrawing(false);setDrawError('');}
 function locate(id:string){s.setFocus(id);setFlash(null);setNavigation({id});}
 function register(id:string,node:HTMLElement|null){if(node)rows.current.set(id,node);else rows.current.delete(id);}
 function point(e:PointerEvent<HTMLDivElement>){const rect=surface.current!.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))};}
 function move(e:PointerEvent<HTMLDivElement>){if(!start.current)return;const end=point(e);setDraft({x:Math.min(start.current.x,end.x),y:Math.min(start.current.y,end.y),width:Math.abs(end.x-start.current.x),height:Math.abs(end.y-start.current.y)});}
 function addSection(box:Box){
  if(![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.x<0||box.y<0||box.width<=0||box.height<=0||box.x+box.width>1.001||box.y+box.height>1.001){setDrawError('Keep the selection inside the artboard with a positive width and height.');return;}
  const cards=sectionCards(board,box);
  if(!cards.length){setDrawError('Include at least one complete card inside the box.');return;}
  if(cards.some(card=>card.family!==cards[0].family)){setDrawError('Choose cards with the same design. Draw a smaller section.');return;}
  if(onBoard.some(section=>sectionCards(board,section.box).some(card=>cards.some(candidate=>candidate.id===card.id)))){setDrawError('This box includes cards already assigned to another section.');return;}
  if(s.sections.length>=20){setDrawError('You can configure up to 20 sections.');return;}
  const section:ArtworkSection={id:crypto.randomUUID(),name:`Section ${s.sections.length+1}`,artboard:s.boardIndex,box,cardId:cards[0].id,recordIds:s.selectedRows.length?s.selectedRows.map(row=>row.id):s.sheet?.rows.slice(0,5).map(row=>row.id)||[],mappings:[],labels:[]};
  s.setSections(current=>[...current,section]);setActiveId(section.id);s.setFocus(null);setDrawing(false);setDraft(null);setDrawError('');setPickLabel(null);
 }
 function end(e:PointerEvent<HTMLDivElement>){if(!start.current)return;const p=point(e),a=start.current;start.current=null;e.currentTarget.releasePointerCapture(e.pointerId);addSection({x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)});setDraft(null);}
 function assignLabel(id:string){
  if(!active||!pickLabel)return;
  if(s.sections.some(section=>section.artboard===s.boardIndex&&section.labels.some(label=>label.targetId===id&&(section.id!==active.id||label.role!==pickLabel)))){setDrawError('That label already belongs to another section or role.');return;}
  const target=pageTargets.find(target=>target.id===id);if(!target)return;
  update({labels:[...active.labels.filter(label=>label.role!==pickLabel),{role:pickLabel,targetId:id,source:'literal',value:target.text,column:0}]});setPickLabel(null);setDrawError('');locate(id);
 }
 function patchLabel(role:SectionLabel['role'],patch:Partial<SectionLabel>){if(active)update({labels:active.labels.map(label=>label.role===role?{...label,...patch}:label)});}

 if(!board||!s.template)return null;
 return <div className="section-builder space-y-5">
  <section className="work-panel sections-toolbar"><div><h2>Sections in this file <Badge variant="secondary">{s.sections.length}</Badge></h2><p>Each box has its own people, card fields, heading, and month. Artwork outside the boxes stays unchanged.</p></div><Button disabled={s.running||!s.sheet||s.sections.length>=20} variant={drawing?'secondary':'default'} onClick={()=>{setDrawing(!drawing);setPickLabel(null);setDraft(null);setDrawError('');}}>{drawing?<X/>:<Plus/>}{drawing?'Cancel drawing':'Draw a section'}</Button></section>
  {!!s.sections.length&&<div className="section-tabs" aria-label="Artwork sections">{s.sections.map(section=><Button key={section.id} variant={section.id===activeId?'secondary':'outline'} aria-pressed={section.id===activeId} onClick={()=>choose(section)}>{section.name}<span className="text-xs text-muted-foreground">Artboard {section.artboard+1} · {section.recordIds.length} cards</span></Button>)}</div>}
  <div className="section-board-selector"><ChoiceSelect label="Section artboard" value={String(s.boardIndex)} options={s.template.artboards.map((b,i)=>({value:String(i),label:`Artboard ${i+1} · ${b.name}`}))} disabled={s.running} onChange={value=>{s.setBoardIndex(Number(value));setActiveId(s.sections.find(section=>section.artboard===Number(value))?.id||'');setPickLabel(null);s.setFocus(null);}}/><span className="text-xs text-muted-foreground">{board.cards?.length||0} detected card positions</span></div>
  {drawError&&<p className="section-feedback" role="alert">{drawError}</p>}
  <div className="mapping-workbench">
   <section className="work-panel canvas-panel"><div className="canvas-heading"><h3>{drawing?'Drag a box around the cards for this section':pickLabel?`Click the ${pickLabel} label on the artwork`:active?`${active.name} · click a card field to map it`:'Add your first section'}</h3>{pickLabel&&<Button variant="ghost" size="sm" onClick={()=>setPickLabel(null)}>Cancel</Button>}</div>
    <ZoomCanvas key={`${s.template.id}-${s.boardIndex}`} interactionLocked={drawing}>
     <div ref={surface} className="artboard section-artboard" style={{position:'relative',aspectRatio:`${board.width}/${board.height}`}}>
      <img className="artboard-image" src={board.preview} alt="Illustrator section preview" draggable={false} style={{width:'100%',height:'100%',display:'block',pointerEvents:'none'}}/>
      {onBoard.map(section=><div key={section.id} className={`section-region ${section.id===activeId?'active':''}`} style={{left:`${section.box.x*100}%`,top:`${section.box.y*100}%`,width:`${section.box.width*100}%`,height:`${section.box.height*100}%`}}><button type="button" disabled={drawing} onClick={()=>choose(section)}>{section.name}</button></div>)}
      {!drawing&&active?.artboard===s.boardIndex&&(pickLabel?pageTargets:targets).map(target=><button key={target.id} type="button" className={`text-target ${s.focus===target.id?'focused':''}`} aria-label={`${pickLabel?'Choose '+pickLabel+' label':'Map section field'}: ${clean(target.text)}`} style={{position:'absolute',left:`${target.x*100}%`,top:`${target.y*100}%`,width:`${Math.max(target.width,.003)*100}%`,height:`${Math.max(target.height,.003)*100}%`,zIndex:5}} onClick={()=>pickLabel?assignLabel(target.id):locate(target.id)}/>)}
      {!drawing&&!pickLabel&&active?.artboard===s.boardIndex&&s.images.source!=='keep'&&sample?.photos?.map(photo=><button key={photo.id} type="button" className="photo-target" aria-label={`Adjust section ${photo.name}`} aria-pressed={photo.id===photoTarget?.id} style={{left:`${photo.x*100}%`,top:`${photo.y*100}%`,width:`${photo.width*100}%`,height:`${photo.height*100}%`,pointerEvents:resolvedPhoto.asset&&photo.id===photoTarget?.id?'none':'auto'}} onClick={()=>{update({photoTargetId:photo.id});locate('__photo');}}/>)}
      {!drawing&&!pickLabel&&active?.artboard===s.boardIndex&&s.images.source!=='keep'&&photoTarget&&resolvedPhoto.asset&&photoRow&&<PhotoFrame asset={resolvedPhoto.asset} target={photoTarget} value={s.images.adjustment(active.id,photoTarget.id,photoRow.id)} onChange={value=>s.images.adjust(active.id,photoTarget.id,photoRow.id,value)} disabled={s.running} style={{position:'absolute',zIndex:5,left:`${photoTarget.x*100}%`,top:`${photoTarget.y*100}%`,width:`${photoTarget.width*100}%`,height:`${photoTarget.height*100}%`}}/>}
      {drawing&&<div className="section-draw-surface" role="group" aria-label="Draw section on artboard" tabIndex={0} onKeyDown={event=>{if(event.key==='Escape'){setDrawing(false);start.current=null;setDraft(null);}}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();start.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);setDraft({...start.current,width:0,height:0});}} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{start.current=null;setDraft(null);}}>{draft&&<div className="section-draft" style={{left:`${draft.x*100}%`,top:`${draft.y*100}%`,width:`${draft.width*100}%`,height:`${draft.height*100}%`}}/>}</div>}
     </div>
    </ZoomCanvas><div className="canvas-footer"><span>Artboard {s.boardIndex+1} · {Math.round(board.width)} × {Math.round(board.height)} pt</span><span>{onBoard.length} sections</span></div>
    {drawing&&<div className="section-drawing-help"><p>Include complete cards. Drawing temporarily locks zoom and pan. Escape cancels.</p><Button size="sm" variant="outline" onClick={()=>addSection({x:0,y:0,width:1,height:1})}><Scan/>Use all cards on this artboard</Button><details className="section-precise"><summary>Precise selection / keyboard alternative</summary><div>{(['x','y','width','height'] as const).map(key=><label key={key}>{key==='x'?'Left':key==='y'?'Top':key==='width'?'Width':'Height'} (%)<Input type="number" min={0} max={100} step={.1} aria-label={`Section box ${key} percent`} value={Number((precise[key]*100).toFixed(2))} onChange={event=>setPrecise(current=>({...current,[key]:Number(event.target.value)/100}))}/></label>)}</div><Button variant="secondary" size="sm" onClick={()=>addSection(precise)}>Use this selection</Button></details></div>}
   </section>
   <aside className="work-panel mapping-inspector section-inspector">{active?.artboard===s.boardIndex?<>
    <div className="inspector-heading"><h3>{active.name}</h3><p>{slots.length} positions per page · {Math.ceil(active.recordIds.length/(slots.length||1))} {active.recordIds.length<=slots.length?'page':'pages'} for this section</p></div>
    <div className="section-name"><Label htmlFor="section-name">Section name</Label><Input id="section-name" value={active.name} maxLength={80} onChange={e=>update({name:e.target.value})}/></div>
    <SectionRows key={active.id} s={s} section={active} onChange={(recordIds,rangeError)=>update({recordIds,rangeError})}/>
    <div className="section-sample"><Label>Sample card to repeat</Label><ChoiceSelect label="Section sample card" value={active.cardId} options={slots.map((card,i)=>({value:card.id,label:`Card ${i+1} · ${card.targetIds.length} fields`}))} onChange={cardId=>{update({cardId,mappings:[],photoTargetId:undefined});s.setFocus(null);}}/><p className="text-xs text-muted-foreground">Preview: {first?.values[s.sheet?.columns.findIndex(column=>/shop|first.?name|name/i.test(column))??0]||first?.values[0]||'No people selected'}</p></div>
    {s.images.source!=='keep'&&<div ref={node=>register('__photo',node)} className="space-y-3"><Label>Photo preview person</Label><ChoiceSelect label="Section photo preview person" value={photoRow?.id||''} options={photoRowsInSection.map(row=>({value:row.id,label:`Record ${row.record} · ${row.values[0]}`}))} onChange={id=>setPhotoRows(current=>({...current,[activeId]:id}))}/><PhotoEditor s={s} card={sample} scope={active.id} row={photoRow} targetId={photoTarget?.id} onTarget={id=>update({photoTargetId:id})} resolved={resolvedPhoto}/></div>}
    <h4 className="section-subheading">Card fields</h4>
    <div className="field-list">{targets.map((target,index)=>{const mapping=active.mappings.find(m=>m.targetId===target.id);return <article key={target.id} ref={node=>register(target.id,node)} onFocusCapture={()=>s.setFocus(target.id)} data-field-id={target.id} data-navigating={flash===target.id||undefined} className={`mapping-row ${s.focus===target.id?'focused':''}`}><button type="button" className="mapping-field-heading" onClick={()=>s.setFocus(target.id)} aria-current={s.focus===target.id?'true':undefined}><span className="field-number">{index+1}</span><strong>{clean(target.text)}</strong>{mapping&&<Check className="size-4"/>}</button><ChoiceSelect label={`Section Excel column for ${clean(target.text)}`} value={String(mapping?.column??-1)} options={[{value:'-1',label:'Keep original text'},...columns]} disabled={s.running} onChange={value=>{s.setFocus(target.id);update({mappings:[...active.mappings.filter(m=>m.targetId!==target.id),...(Number(value)<0?[]:[{kind:'text' as const,targetId:target.id,column:Number(value)}])]});}}/><div className="mapping-value"><span className="text-xs text-muted-foreground">{mapping?'Excel preview':'Original text'}</span><p>{mapping?first?.values[mapping.column]??'(empty cell)':clean(target.text)}</p></div></article>;})}</div>
    <h4 className="section-subheading">Section heading & month</h4>
    {(['heading','month'] as const).map(role=>{const label=active.labels.find(label=>label.role===role),target=board.targets.find(t=>t.id===label?.targetId);return <article key={role} ref={node=>{if(label)register(label.targetId,node);}} data-field-id={label?.targetId} data-navigating={flash===label?.targetId||undefined} className={`mapping-row section-label ${label&&s.focus===label.targetId?'focused':''}`}><div className="mapping-field-heading"><span className="field-number">{role==='heading'?'H':'M'}</span><strong>{role==='heading'?'Heading':'Month / year'}</strong></div><Button variant={pickLabel===role?'secondary':'outline'} size="sm" onClick={()=>{setPickLabel(pickLabel===role?null:role);setDrawing(false);setDrawError('');surface.current?.scrollIntoView({behavior:reduce?'instant':'smooth',block:'center'});}}><MousePointer2/>{label?'Choose another label':`Select ${role} in artwork`}</Button>{label&&<><p className="text-xs text-muted-foreground section-original">Original: {clean(target?.text||'')}</p><ChoiceSelect label={`${role} value source`} value={label.source} options={[{value:'literal',label:'Type a fixed value'},{value:'column',label:'Use an Excel column'}]} onChange={value=>patchLabel(role,{source:value as 'literal'|'column'})}/>{label.source==='literal'?<Input aria-label={`${role} text`} value={label.value} maxLength={1000} onFocus={()=>s.setFocus(label.targetId)} onChange={e=>patchLabel(role,{value:e.target.value})}/>:<><ChoiceSelect label={`Excel column for section ${role}`} value={String(label.column)} options={columns} onChange={value=>patchLabel(role,{column:Number(value)})}/><p className="text-xs text-muted-foreground">Uses this section’s first selected record: {first?.values[label.column]}</p></>}<Button variant="ghost" size="sm" onClick={()=>update({labels:active.labels.filter(item=>item.role!==role)})}>Keep original {role}</Button></>}</article>;})}
    <Button variant="ghost" className="text-destructive" disabled={s.running} onClick={()=>{s.setSections(current=>current.filter(section=>section.id!==active.id));s.setFocus(null);setPickLabel(null);}}> <Trash2/>Remove section</Button>
   </>:<div className="mapping-empty"><Scan className="size-8"/><h3>Define a section</h3><p>Draw a box around its cards, or select a section above to edit it.</p><Button variant="outline" onClick={()=>setDrawing(true)}>Draw a section</Button></div>}</aside>
  </div>
  {s.sectionReview.error&&<p className="section-feedback" role="status">{s.sectionReview.error}</p>}
  <footer className="workflow-footer"><span>{s.sections.length} {s.sections.length===1?'section':'sections'} · {s.batchCount} cards · {s.batchPages||'—'} {s.batchPages===1?'page':'pages'} in one AI file</span><div className="flex gap-2"><Button variant="outline" disabled={!s.ready||s.running||!s.native} onClick={()=>void s.generate(true)}>Preview section pages</Button><Button disabled={!s.canReview||s.running} onClick={()=>s.setView('export')}>Review & export<ArrowRight/></Button></div></footer>
 </div>;
}
