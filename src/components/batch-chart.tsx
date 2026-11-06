import {useId, useMemo} from 'react';
import {ChartNoAxesColumn} from 'lucide-react';
import {useReducedMotion} from 'motion/react';
import {BarChart} from '@/components/charts/bar-chart';
import {Bar} from '@/components/charts/bar';
import {BarXAxis} from '@/components/charts/bar-x-axis';
import {Grid} from '@/components/charts/grid';
import {useYScale} from '@/components/charts/chart-context';
import {ChartTooltip} from '@/components/charts/tooltip';
import type {Job} from '@/lib/types';

function BatchCountAxis() {
  const yScale = useYScale();
  const ticks = yScale.ticks(3).filter(Number.isInteger);
  if (!ticks.includes(0)) ticks.unshift(0);

  return (
    <g>
      <Grid horizontal vertical={false} rowTickValues={ticks} stroke="var(--border)" strokeDasharray="0" fadeHorizontal={false}/>
      {ticks.map(tick => <text key={tick} x={-8} y={yScale(tick)} dominantBaseline="middle" textAnchor="end" fill="var(--muted-foreground)" className="text-[10px] tabular-nums">{tick.toLocaleString()}</text>)}
    </g>
  );
}

export function BatchChart({jobs}: {jobs: Job[]}) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const summaryId = useId();
  const data = useMemo(() => jobs
    .filter(job => job.status === 'complete' && job.type !== 'inspect' && job.result && !job.result.proof)
    .slice(0, 6)
    .reverse()
    .map((job, index) => ({label: String(index + 1), cards: job.result!.count, id: job.id})), [jobs]);
  const total = data.reduce((sum, row) => sum + row.cards, 0);
  const axisWidth = Math.max(32, Math.ceil(Math.max(...data.map(row => row.cards), 0) * 1.2).toLocaleString().length * 6 + 12);

  return (
    <section aria-labelledby={titleId} aria-describedby={summaryId} className="min-w-0 rounded-xl border border-border bg-card text-card-foreground">
      <div className="border-b border-border px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold">Cards per batch</h2>
        <p id={summaryId} className="mt-1 text-xs text-muted-foreground">{data.length >= 2 ? `${total.toLocaleString()} cards across ${data.length} recent exports. Oldest to newest.` : 'Compare card counts across your recent exports.'}</p>
      </div>
      {data.length >= 2 ? (
        <div className="px-3 pb-3 pt-2">
          <div aria-hidden="true">
            <BarChart data={data} xDataKey="label" aspectRatio="2.4 / 1" className="min-h-44" margin={{top: 16, right: 8, bottom: 30, left: axisWidth}} barGap={0.52} animationDuration={0}>
              <BatchCountAxis/>
              <Bar dataKey="cards" fill="var(--chart-1)" lineCap={2} animate={false}/>
              <BarXAxis showAllLabels/>
              <ChartTooltip showDatePill={false} showCrosshair={false} showDots={false} damping={reduceMotion ? 0 : 20} animateSize={!reduceMotion} exit={!reduceMotion} className="shadow-none" rows={point => [{color: 'var(--chart-1)', label: `Batch ${String(point.label)} · cards`, value: Number(point.cards)}]}/>
            </BarChart>
            <p className="px-2 pt-1 text-center text-[11px] text-muted-foreground">Recent batches · oldest to newest</p>
          </div>
          <div className="sr-only"><table>
            <caption>Card counts in recent completed exports, oldest to newest. Proofs are excluded.</caption>
            <thead><tr><th scope="col">Batch</th><th scope="col">Job ID</th><th scope="col">Cards</th></tr></thead>
            <tbody>{data.map(row => <tr key={row.id}><th scope="row">Batch {row.label}</th><td>{row.id}</td><td>{row.cards}</td></tr>)}</tbody>
          </table></div>
        </div>
      ) : (
        <div className="flex min-h-44 items-center gap-3 px-5 py-8">
          <ChartNoAxesColumn className="size-6 shrink-0 text-muted-foreground" aria-hidden="true"/>
          <div><p className="text-sm font-medium">{data.length === 1 ? 'Your first export is ready' : 'Build your export history'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{data.length === 1 ? `${data[0].cards.toLocaleString()} cards exported. A comparison will appear after your next completed export.` : 'After two completed exports, this chart will show their actual card counts. Page proofs are excluded.'}</p></div>
        </div>
      )}
    </section>
  );
}
