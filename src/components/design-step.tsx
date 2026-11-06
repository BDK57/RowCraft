import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, FileImage, MousePointer2, Plus, Save, Upload } from 'lucide-react';
import ZoomCanvas from '@/ZoomCanvas';
import type { Studio } from '@/hooks/use-studio';
import type { Target } from '@/lib/types';
import { ChoiceSelect } from '@/components/choice-select';
import { SectionEditor } from '@/components/section-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const clean = (text: string) => text.replace(/[\r\n]+/g, ' ') || '(empty text)';

export default function DesignStep({ s }: { s: Studio }) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [fieldTab, setFieldTab] = useState('card');
  const reduceMotion = useReducedMotion();
  const fieldRows = useRef(new Map<string, HTMLElement>());
  const [fieldNavigation, setFieldNavigation] = useState<{ id: string } | null>(null);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const cards = [...(s.board?.cards || [])].sort((a, b) => Math.abs(a.y - b.y) > .002 ? a.y - b.y : a.x - b.x);
  const cardTargets = (s.board?.targets || []).filter(t => s.sampleCard?.targetIds.includes(t.id));
  const pageTargets = s.availableTargets.filter(t => !s.sampleCard?.targetIds.includes(t.id) && (!s.targetSearch || t.text.toLowerCase().includes(s.targetSearch.toLowerCase())));
  const columnOptions = [{ value: '-1', label: 'Keep original text' }, ...(s.sheet?.columns.map((label, i) => ({ value: String(i), label })) || [])];
  const previewRows = [...s.selectedRows];
  if (s.previewRow && !previewRows.some(row => row.id === s.previewRow?.id)) previewRows.unshift(s.previewRow);
  const sampleNumber = cards.findIndex(card => card.id === s.cardId) + 1;
  const positionMappings = s.mappings.filter(m => m.kind === 'position');

  // Run after React mounts the selected tab and clears any page-text filter.
  useEffect(() => {
    if (!fieldNavigation) return;
    let highlightTimer: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() => {
      const row = fieldRows.current.get(fieldNavigation.id);
      if (!row) return;
      row.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth', block: 'start', inline: 'nearest' });
      setHighlightedField(fieldNavigation.id);
      highlightTimer = setTimeout(() => setHighlightedField(null), 1800);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(highlightTimer); };
  }, [fieldNavigation, reduceMotion]);

  function locateField(id: string) {
    s.setFocus(id);
    s.setPositionMode(false);
    setFieldTab(s.sampleCard?.targetIds.includes(id) ? 'card' : 'page');
    s.setTargetSearch('');
    setHighlightedField(null);
    setFieldNavigation({ id }); // A fresh request also locates a field clicked twice.
  }

  function registerField(id: string, node: HTMLElement | null) {
    if (node) fieldRows.current.set(id, node);
    else fieldRows.current.delete(id);
  }

  function renderFields(targets: Target[]) {
    return <div className="field-list">{targets.map((target, index) => {
      const mapping = s.mappings.find(m => m.kind === 'text' && m.targetId === target.id);
      const value = mapping ? s.previewRow?.values[mapping.column] : undefined;
      return <article key={target.id} ref={node => registerField(target.id, node)} onFocusCapture={() => s.setFocus(target.id)} data-field-id={target.id} data-navigating={highlightedField === target.id || undefined} className={`mapping-row ${s.focus === target.id ? 'focused' : ''}`}>
        <button type="button" className="mapping-field-heading" aria-current={s.focus === target.id ? 'true' : undefined} onClick={() => { s.setFocus(target.id); s.setPositionMode(false); }}>
          <span className="field-number">{index + 1}</span><strong>{clean(target.text)}</strong>{mapping && <Check className="size-4 text-primary" aria-label="Mapped" />}
        </button>
        <ChoiceSelect label={`Excel column for ${clean(target.text)}`} value={String(mapping?.column ?? -1)} options={columnOptions} disabled={!s.sheet || s.running} onChange={value => s.mapTarget(target.id, Number(value))} />
        <div className="mapping-value"><span className="text-xs text-muted-foreground">{mapping ? 'Excel preview' : 'Original text'}</span><p className="whitespace-pre-wrap break-words">{mapping ? value === undefined ? 'No preview record' : value === '' ? '(empty cell)' : value : clean(target.text)}</p></div>
        <details className="source-type-details"><summary>Original typography</summary><p>{target.font || 'Original Illustrator font'} · {target.fontSize.toFixed(1)} pt</p><p>Font, size, color and alignment stay in the Illustrator design.</p></details>
      </article>;
    })}</div>;
  }

  return <div className="design-step space-y-5">
    <input className="hidden" type="file" ref={s.templateInput} accept=".ai,.zip" aria-label="Upload Illustrator template" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void s.uploadFile(file, 'templates'); event.currentTarget.value = ''; }} />
    <section className="work-panel source-toolbar">
      <div><span className="eyebrow">02 / DESIGN</span><h2>Illustrator template</h2><p className="text-muted-foreground">Choose the whole card first, then match its labels to your Excel columns.</p></div>
      <div className="source-actions flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1"><ChoiceSelect value={s.template?.id || ''} label="Saved Illustrator template" placeholder="Choose a saved design" options={s.templates.map(t => ({ value: t.id, label: t.preset?.name ? `${t.preset.name} · ${t.name}` : t.name }))} disabled={s.running || !s.templates.length} onChange={id => { const template = s.templates.find(t => t.id === id); if (template) s.chooseTemplate(template); }} /></div>
        <Button variant="outline" disabled={s.running} onClick={() => s.templateInput.current?.click()}><Upload />Upload AI / ZIP</Button>
        <Button variant="secondary" disabled={s.running} onClick={() => void s.demo('template')}>Use supplied design</Button>
      </div>
    </section>

    <div className="batch-mode-switch" role="group" aria-label="Batch layout mode"><Button variant={s.batchMode === 'single' ? 'secondary' : 'ghost'} aria-pressed={s.batchMode === 'single'} disabled={s.running} onClick={() => s.setBatchMode('single')}>Single card batch</Button><Button variant={s.batchMode === 'sections' ? 'secondary' : 'ghost'} aria-pressed={s.batchMode === 'sections'} disabled={s.running} onClick={() => s.setBatchMode('sections')}>Multiple sections</Button><span>Independent row ranges, headings, and months</span></div>

    {!s.board || !s.template ? <section className="work-panel design-empty">
      <FileImage className="size-10 text-primary" /><h3>Start with your Illustrator artwork</h3><p className="text-muted-foreground">Render the supplied design or upload an AI file with editable text. A ZIP can include its linked artwork.</p>
      <Button disabled={s.running} onClick={() => void s.demo('template')}>Use supplied design<ArrowRight /></Button>
      {!!s.templates.length && <div className="template-gallery">{s.templates.filter(t => t.artboards[0]?.preview).slice(0, 3).map(t => <button key={t.id} className="template-tile" disabled={s.running} onClick={() => s.chooseTemplate(t)}><img src={t.artboards[0].preview} alt={t.name} /><strong>{t.preset?.name || t.name}</strong></button>)}</div>}
    </section> : s.batchMode === 'sections' ? <SectionEditor s={s}/> : <>
      {!!s.template.missingLinks.length && <section className="work-panel border-destructive/40" role="alert"><h3>Linked artwork needs attention</h3><p>Upload a ZIP containing the AI file and its linked images, or restore the links and refresh.</p><ul>{s.template.missingLinks.map((link, i) => <li key={i} className="break-all text-sm">{link}</li>)}</ul><Button variant="outline" disabled={s.running} onClick={() => void s.refreshTemplates()}>Refresh linked assets</Button></section>}
      <section className="artboard-strip" aria-label="Choose an artboard">{s.template.artboards.map((board, index) => <button key={index} type="button" className={`artboard-thumbnail ${s.boardIndex === index ? 'selected' : ''}`} aria-pressed={s.boardIndex === index} disabled={s.running} onClick={() => s.changeBoard(index)}><img src={board.preview} alt={`Artboard ${index + 1}: ${board.name}`} /><span><strong>{board.name || `Artboard ${index + 1}`}</strong><small>{Math.round(board.width)} × {Math.round(board.height)} pt</small></span>{s.boardIndex === index && <Check className="size-4" />}</button>)}</section>
      <section className="work-panel card-choice-panel">
        <div><span className="eyebrow">1. CHOOSE THE WHOLE CARD</span><h3>{s.sampleCard ? `Card ${sampleNumber} is your sample` : 'Which card should repeat?'}</h3><p className="text-muted-foreground">{cards.length ? `${cards.length} card positions found. One Excel row fills one card.` : 'Analyze the artwork to find its editable card groups.'}</p></div>
        <div className="flex flex-wrap items-center gap-2">{cards.length ? <>
          <div className="min-w-52"><ChoiceSelect label="Sample card to repeat" value={s.cardId || ''} placeholder="Select a sample card" disabled={s.running} options={cards.map((card, i) => ({ value: card.id, label: `Card ${i + 1} · ${card.targetIds.length} fields` }))} onChange={s.selectCard} /></div>
          {!s.sampleCard && <Button disabled={s.running} onClick={() => s.selectCard(cards[0].id)}>Use first card</Button>}
          <Button variant={s.pickingCard ? 'secondary' : 'outline'} aria-pressed={s.pickingCard} disabled={s.running} onClick={() => { s.setPickingCard(true); s.setPositionMode(false); }}><MousePointer2 />{s.pickingCard ? 'Click a card below' : 'Choose another card'}</Button>
        </> : <Button variant="outline" disabled={s.running} onClick={() => void s.analyzeCards()}>Analyze cards</Button>}</div>
        {s.sampleCard && <p className="card-summary text-sm"><strong>{s.selectedRows.length} people → {s.selectedRows.length} cards</strong> · {s.gridCards.length} positions per page · {Math.ceil(s.selectedRows.length / (s.gridCards.length || 1))} {s.selectedRows.length <= s.gridCards.length ? 'page' : 'pages'}. Unused cards are removed; original spacing stays.</p>}
      </section>

      <div className="mapping-workbench">
        <section className="work-panel canvas-panel">
          <div className="canvas-heading"><div><span className="eyebrow">ILLUSTRATOR ARTWORK</span><h3>{s.pickingCard ? 'Click the whole card you want to repeat' : s.positionMode ? 'Click to place a page text field' : 'Your selected card, up close'}</h3></div><Button size="sm" variant={s.positionMode ? 'secondary' : 'outline'} disabled={!s.sheet || s.running} aria-pressed={s.positionMode} onClick={() => { s.setPositionMode(!s.positionMode); s.setPickingCard(false); setFieldTab('page'); }}><Plus />{s.positionMode ? 'Cancel placement' : 'Add page text'}</Button></div>
          <div className="canvas-options flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><Checkbox checked={s.showFields} onCheckedChange={value => s.setShowFields(value === true)} />Show field outlines</label><label className="flex items-center gap-2"><Checkbox checked={s.overlay} onCheckedChange={value => s.setOverlay(value === true)} />Quick data overlay</label></div>
          <div className="canvas-surround"><ZoomCanvas key={`${s.template.id}-${s.boardIndex}`} focusId={!s.pickingCard && !s.positionMode && s.sampleCard ? `studio-card-${s.sampleCard.id}` : undefined}>
            <div className={`artboard ${s.positionMode ? 'place-mode' : ''}`} ref={s.canvas} style={{ position: 'relative', aspectRatio: `${s.board.width}/${s.board.height}` }} onClick={s.addPosition}>
              <img className="artboard-image" src={s.board.preview} alt="Illustrator-rendered cover preview" draggable={false} style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
              {cards.filter(card => s.pickingCard || card.id === s.cardId).map(card => <button type="button" key={card.id} id={`studio-card-${card.id}`} className={`card-target ${s.pickingCard ? 'picking' : ''} ${card.id === s.cardId ? 'selected' : ''}`} aria-label={`Use card ${cards.indexOf(card) + 1}, ${card.targetIds.length} text fields`} aria-pressed={card.id === s.cardId} tabIndex={s.pickingCard ? 0 : -1} disabled={s.running || !s.pickingCard || s.positionMode} style={{ position: 'absolute', left: `${card.x * 100}%`, top: `${card.y * 100}%`, width: `${card.width * 100}%`, height: `${card.height * 100}%`, pointerEvents: s.pickingCard && !s.positionMode ? 'auto' : 'none', zIndex: 2 }} onClick={event => { event.stopPropagation(); s.selectCard(card.id); }}><span>{card.id === s.cardId ? 'SAMPLE CARD' : `CARD ${cards.indexOf(card) + 1}`}</span></button>)}
              {s.showFields && !s.pickingCard && !s.positionMode && s.availableTargets.map(target => { const mapped = s.mappings.find(m => m.targetId === target.id); return <button type="button" key={target.id} className={`text-target ${s.focus === target.id ? 'focused' : ''} ${mapped ? 'mapped' : ''}`} style={{ position: 'absolute', left: `${target.x * 100}%`, top: `${target.y * 100}%`, width: `${Math.max(target.width, .003) * 100}%`, height: `${Math.max(target.height, .003) * 100}%`, zIndex: 3 }} aria-label={`Map field: ${clean(target.text)}`} title={clean(target.text)} onClick={event => { event.stopPropagation(); locateField(target.id); }}>
                {s.overlay && mapped && <span>{s.previewRow?.values[mapped.column] ?? ''}</span>}
              </button>; })}
              {!s.pickingCard && !s.positionMode && positionMappings.map(mapping => <button type="button" key={mapping.id} className={`position-target ${s.focus === mapping.id ? 'focused' : ''}`} aria-label="Edit added page text" style={{ position: 'absolute', left: `${(mapping.x || 0) * 100}%`, top: `${(mapping.y || 0) * 100}%`, width: `${(mapping.width || .3) * 100}%`, fontSize: `${(mapping.fontSize || 14) * .75}px`, zIndex: 3 }} onClick={event => { event.stopPropagation(); if (mapping.id) locateField(mapping.id); }}>{s.previewRow?.values[mapping.column] ?? '(no preview record)'}</button>)}
            </div>
          </ZoomCanvas></div>
          <div className="canvas-footer"><span>{Math.round(s.board.width)} × {Math.round(s.board.height)} pt</span><span>{s.board.targets.length} editable labels</span></div>
          <p className="preview-note">The artwork keeps its original typography and colors. Quick overlays show data placement; a native proof shows the final populated grid.</p>
        </section>

        <aside className="work-panel mapping-inspector">
          <div className="inspector-heading"><span className="eyebrow">2. CONNECT EXCEL COLUMNS</span><h3>All fields, in one place <Badge variant="secondary">{s.mappings.length} mapped</Badge></h3><p className="text-sm text-muted-foreground">Leave a field on “Keep original text” to preserve its label.</p></div>
          {!s.sheet ? <div className="mapping-empty"><p>Load a workbook to connect its columns.</p><Button variant="outline" onClick={() => s.setView('data')}>Go to people</Button></div> : <>
            <div className="preview-record space-y-2"><Label>Preview person</Label><ChoiceSelect label="Preview person" value={s.previewRow?.id || ''} disabled={!previewRows.length} options={previewRows.map(row => ({ value: row.id, label: `#${row.record} · ${row.values[s.sheet!.columns.findIndex(column => /shop|first.?name|name/i.test(column))] || row.values[0] || `Excel row ${row.excelRow}`}${s.selected.has(row.id) ? '' : ' (not selected)'}` }))} onChange={s.setPreviewId} /></div>
            <Tabs value={fieldTab} onValueChange={setFieldTab} className="mapping-tabs"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="card">Card fields ({cardTargets.length})</TabsTrigger><TabsTrigger value="page">Page text</TabsTrigger></TabsList>
              <TabsContent value="card">{s.sampleCard ? cardTargets.length ? renderFields(cardTargets) : <p className="mapping-empty">This card has no editable labels. Choose a card with live text, or add page text to flattened artwork.</p> : <div className="mapping-empty"><MousePointer2 className="size-7" /><h4>Choose a whole card first</h4><p>Use the first card or click a card on the artwork. Its labels will appear here together.</p>{cards.length > 0 && <Button disabled={s.running} onClick={() => s.selectCard(cards[0].id)}>Use first card</Button>}</div>}</TabsContent>
              <TabsContent value="page"><p className="text-sm text-muted-foreground">Page fields use the first selected person. Card fields repeat for every person.</p><Input className="my-3" aria-label="Find page text" placeholder="Find page text…" value={s.targetSearch} onChange={event => s.setTargetSearch(event.target.value)} />{renderFields(pageTargets)}{!pageTargets.length && <p className="mapping-empty">No matching page text.</p>}
                <div className="position-fields">{positionMappings.map((mapping, index) => <article key={mapping.id} ref={node => { if (mapping.id) registerField(mapping.id, node); }} data-field-id={mapping.id} data-navigating={highlightedField === mapping.id || undefined} className={`mapping-row ${s.focus === mapping.id ? 'focused' : ''}`}><button type="button" className="mapping-field-heading" onClick={() => s.setFocus(mapping.id || null)}><strong>Added page text {index + 1}</strong></button>
                  <ChoiceSelect label={`Excel column for added text ${index + 1}`} value={String(mapping.column)} options={columnOptions.filter(option => option.value !== '-1')} onChange={value => s.setMappings(current => current.map(item => item.id === mapping.id ? { ...item, column: Number(value) } : item))} />
                  <div className="mapping-value"><span className="text-xs text-muted-foreground">Excel preview</span><p>{s.previewRow ? s.previewRow.values[mapping.column] === '' ? '(empty cell)' : s.previewRow.values[mapping.column] ?? '(empty cell)' : 'No preview record'}</p></div>
                  <Label className="mt-3 block">Font family and weight</Label><ChoiceSelect label={`Font for added text ${index + 1}`} value={mapping.font || s.template?.fonts[0] || ''} options={(s.template?.fonts || []).map(font => ({ value: font, label: font }))} onChange={font => s.setMappings(current => current.map(item => item.id === mapping.id ? { ...item, font } : item))} />
                  <div className="position-settings grid grid-cols-2 gap-2">{(['x', 'y', 'width', 'fontSize'] as const).map(key => <label key={key} className="space-y-1 text-xs">{{ x: 'X (%)', y: 'Y (%)', width: 'Width (%)', fontSize: 'Size (pt)' }[key]}<Input type="number" aria-label={`Added text ${index + 1} ${key}`} min={key === 'fontSize' ? 1 : 0} max={key === 'fontSize' ? undefined : 100} step={key === 'fontSize' ? 1 : .1} value={key === 'fontSize' ? mapping.fontSize || 14 : Number(((mapping[key] || 0) * 100).toFixed(1))} onChange={event => { const value = Number(event.target.value) / (key === 'fontSize' ? 1 : 100); s.setMappings(current => current.map(item => item.id === mapping.id ? { ...item, [key]: value } : item)); }} /></label>)}</div>
                  <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => { s.setMappings(current => current.filter(item => item.id !== mapping.id)); if (s.focus === mapping.id) s.setFocus(null); }}>Remove added text</Button>
                </article>)}</div><Button variant="outline" className="mt-3" disabled={s.running} onClick={() => { s.setPositionMode(true); s.setPickingCard(false); }}><Plus />Add page text position</Button>
              </TabsContent>
            </Tabs>
          </>}
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}><DialogTrigger asChild><Button variant="outline" className="mt-4 w-full" disabled={!s.ready || s.running}><Save />Save this mapping</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Save your template mapping</DialogTitle><DialogDescription>Reuse this card and its field connections with another workbook that has the same column names.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="preset-name">Mapping name</Label><Input id="preset-name" value={s.presetName} onChange={event => s.setPresetName(event.target.value)} placeholder="Monthly winner cards" /></div><DialogFooter><Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button><Button disabled={!s.ready || s.running} onClick={() => { void s.savePreset(); setSaveOpen(false); }}>Save mapping</Button></DialogFooter></DialogContent></Dialog>
        </aside>
      </div>
      {!!s.template.warnings.length && <details className="work-panel source-warnings"><summary>{s.template.warnings.length} artwork notes</summary><ul>{s.template.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
    </>}
    {s.batchMode === 'single' && <footer className="workflow-footer"><Button variant="outline" onClick={() => s.setView('data')}><ArrowLeft />People</Button><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!s.ready || s.running || !s.native} onClick={() => void s.generate(true)}>Render native proof</Button><Button disabled={!s.ready || s.running} onClick={() => s.setView('export')}>Review & export<ArrowRight /></Button></div></footer>}
  </div>;
}
