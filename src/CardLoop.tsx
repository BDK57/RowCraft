import type {PhotoTarget} from './lib/types';
export type Card = { id: string; groupIndex: number; family: string; x: number; y: number; width: number; height: number; targetIds: string[]; photos?:PhotoTarget[] };

type Props = { cards: Card[] | undefined; cardId: string; count: number; picking: boolean; running: boolean; onPick: () => void; onSelect: (id: string) => void; onAnalyze: () => void };
const inReadingOrder = (cards: Card[]) => [...cards].sort((a, b) => Math.abs(a.y - b.y) > .002 ? a.y - b.y : a.x - b.x);

export function CardLoopPanel({ cards, cardId, count, picking, running, onPick, onSelect, onAnalyze }: Props) {
    const sample = cards?.find(c => c.id === cardId), family = sample ? cards?.filter(c => c.family === sample.family) : [];
    return <section className="panel card-loop-panel" aria-label="Repeat a card">
        <div><span className="eyebrow">ONE EXCEL ROW = ONE CARD</span><h2>Choose the card to repeat</h2><p>{cards?.length ? 'Click a whole card in the preview, then map the text inside it.' : 'Analyze the design to find its editable card groups.'}</p></div>
        {cards?.length ? <><label>Sample card<select aria-label="Sample card" value={cardId} onChange={e => onSelect(e.target.value)}><option value="">Choose a card…</option>{inReadingOrder(cards).map((c, i) => <option key={c.id} value={c.id}>Card {i + 1} · {c.targetIds.length} text fields</option>)}</select></label><button className={`button ${picking ? 'primary' : 'secondary'}`} onClick={onPick}>{picking ? 'Click a card in the preview' : 'Select another card'}</button></> : <button className="button secondary" disabled={running} onClick={onAnalyze}>Analyze card structure</button>}
        {sample && <div className="loop-summary" role="status"><strong>{count} selected people → {count} cards</strong><span>{family?.length} positions per page · {Math.ceil(count / (family?.length || 1))} {Math.ceil(count / (family?.length || 1)) === 1 ? 'page' : 'pages'} in one AI file</span><small>Existing gaps are preserved. Every unused card is removed. Unmapped headings and footer stay unchanged.</small></div>}
    </section>;
}

export function CardOutlines({ cards, cardId, picking, onSelect }: { cards: Card[]; cardId: string; picking: boolean; onSelect: (id: string) => void }) {
    return <>{inReadingOrder(cards).map((c, i) => (picking || c.id === cardId) ? <button type="button" key={c.id} aria-label={`Repeat card ${i + 1}`} title="Use this whole card as one Excel row" className={`card-outline ${picking ? 'picking' : ''} ${c.id === cardId ? 'chosen-card' : ''}`} style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.width * 100}%`, height: `${c.height * 100}%` }} tabIndex={picking ? 0 : -1} onClick={e => { e.stopPropagation(); onSelect(c.id); }}><span>{c.id === cardId ? 'REPEATING CARD' : 'SELECT CARD'}</span></button> : null)}</>;
}
