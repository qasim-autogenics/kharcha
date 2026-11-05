import { useMemo } from "react";
import { Icon } from "../lib/icons";
import { CHART_VIEWS, type ChartView } from "../lib/config";
import { money } from "../lib/format";
import { prettyDate } from "../lib/dates";
import { myCost, sum, type Slice } from "../lib/calc";
import { SPLIT_LABELS } from "../lib/config";
import type { Category, Expense, Person } from "../lib/types";

// ───────── view switcher ─────────
export function ChartSwitcher({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  return (
    <div className="vs" role="tablist" aria-label="Chart style">
      {CHART_VIEWS.map((v) => (
        <button key={v.id} role="tab" aria-selected={value === v.id} aria-label={v.label} title={v.label}
          className={value === v.id ? "on" : ""} onClick={() => onChange(v.id)}><Icon name={v.icon} size={18} /></button>
      ))}
    </div>
  );
}

// ───────── geometry ─────────
const pt = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

interface SliceChartProps { slices: Slice[]; total: number; onSelect: (s: Slice) => void }

function Segments({ slices, total, onSelect, startDeg, sweepDeg, cx, cy, r, thick }: SliceChartProps &
  { startDeg: number; sweepDeg: number; cx: number; cy: number; r: number; thick: number }) {
  const capDeg = 0; // flat ends: segments fill the whole arc, no track showing through
  const gap = 1.2;
  let a = startDeg;
  return (
    <>
      {slices.map((s) => {
        const span = (sweepDeg * s.total) / total;
        const from = a + capDeg + gap / 2;
        const to = Math.max(from + 0.01, a + span - capDeg - gap / 2);
        a += span;
        const mid = (from + to) / 2;
        const [tx, ty] = pt(cx, cy, r, mid);
        const pctv = Math.round((s.total / total) * 100);
        return (
          <g key={s.id}>
          <path d={arc(cx, cy, r, from, to)} fill="none" stroke={s.color} strokeWidth={thick} strokeLinecap="butt"
            className="seg-path" role="button" tabIndex={0} aria-label={`${s.name} ${money(s.total)}`}
            onClick={() => onSelect(s)} onKeyDown={(e) => e.key === "Enter" && onSelect(s)} />
          {span >= 12 && <text x={tx} y={ty} className="seg-pct" textAnchor="middle" dominantBaseline="central" pointerEvents="none">{pctv}%</text>}
          </g>
        );
      })}
    </>
  );
}

function Legend({ slices, total }: { slices: Slice[]; total: number }) {
  return (
    <div className="legend">
      {slices.map((s) => (
        <span key={s.id}><u style={{ background: s.color }} />{s.name} <b>{Math.round((s.total / total) * 100)}%</b></span>
      ))}
    </div>
  );
}

// ───────── half gauge ─────────
export function GaugeChart(p: SliceChartProps) {
  const top = p.slices[0];
  return (
    <div className="chart-box">
      <svg viewBox="0 0 300 168" className="gauge" role="img" aria-label="Spending by category">
        <path d={arc(150, 150, 124, 180, 360)} fill="none" stroke="var(--seg)" strokeWidth={22} strokeLinecap="butt" />
        <Segments {...p} startDeg={180} sweepDeg={180} cx={150} cy={150} r={124} thick={22} />
      </svg>
      <div className="gauge-center">
        <b className="serif">{Math.round((top.total / p.total) * 100)}%</b>
        <span>{top.name}</span>
      </div>
      <Legend slices={p.slices} total={p.total} />
    </div>
  );
}

// ───────── ring ─────────
export function RingChart(p: SliceChartProps) {
  const top = p.slices[0];
  return (
    <div className="chart-box">
      <div className="ring-wrap">
        <svg viewBox="0 0 220 220" className="ring" role="img" aria-label="Spending by category">
          <circle cx={110} cy={110} r={88} fill="none" stroke="var(--seg)" strokeWidth={22} />
          <Segments {...p} startDeg={-90} sweepDeg={359.9} cx={110} cy={110} r={88} thick={22} />
        </svg>
        <div className="ring-center"><b className="serif">{Math.round((top.total / p.total) * 100)}%</b><span>{top.name}</span></div>
      </div>
      <Legend slices={p.slices} total={p.total} />
    </div>
  );
}

// ───────── segmented bar ─────────
export function BarChart(p: SliceChartProps) {
  return (
    <div className="chart-box">
      <div className="segbar" role="img" aria-label="Spending by category">
        {p.slices.map((s) => (
          <button key={s.id} style={{ flex: s.total, background: s.color }} aria-label={`${s.name} ${money(s.total)}`} onClick={() => p.onSelect(s)} />
        ))}
      </div>
      <Legend slices={p.slices} total={p.total} />
    </div>
  );
}

// ───────── bubbles (circle packing) ─────────
interface Placed { x: number; y: number; r: number }
function pack(radii: number[], gap = 4): Placed[] {
  const placed: Placed[] = [];
  for (const r of radii) {
    if (placed.length === 0) { placed.push({ x: 0, y: 0, r }); continue; }
    let best: Placed | null = null;
    for (let d = 0; d < 600 && !best; d += 3) {
      let bestDist = Infinity;
      for (let ang = 0; ang < 360; ang += 12) {
        const x = d * Math.cos((ang * Math.PI) / 180);
        const y = d * Math.sin((ang * Math.PI) / 180) * 0.8; // squash so the field is wider than tall
        if (placed.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r + r + gap)) {
          const dist = Math.hypot(x, y);
          if (dist < bestDist) { bestDist = dist; best = { x, y, r }; }
        }
      }
    }
    placed.push(best ?? { x: 0, y: 0, r });
  }
  return placed;
}

export function BubbleChart({ slices, total, onSelect }: SliceChartProps) {
  const W = 300, H = 250;
  const layout = useMemo(() => {
    const max = slices[0].total;
    const radii = slices.map((s) => Math.max(20, 80 * Math.sqrt(s.total / max)));
    const placed = pack(radii);
    const minX = Math.min(...placed.map((p) => p.x - p.r)), maxX = Math.max(...placed.map((p) => p.x + p.r));
    const minY = Math.min(...placed.map((p) => p.y - p.r)), maxY = Math.max(...placed.map((p) => p.y + p.r));
    const k = Math.min(W / (maxX - minX), H / (maxY - minY), 1.4);
    const ox = (W - (maxX - minX) * k) / 2 - minX * k, oy = (H - (maxY - minY) * k) / 2 - minY * k;
    return placed.map((p) => ({ x: p.x * k + ox, y: p.y * k + oy, r: p.r * k }));
  }, [slices]);
  return (
    <div className="chart-box">
      <div className="bubbles" style={{ height: H }}>
        {slices.map((s, i) => {
          const b = layout[i];
          return (
            <button key={s.id} className="bubble" style={{ width: b.r * 2, height: b.r * 2, left: b.x - b.r, top: b.y - b.r, background: s.color }}
              onClick={() => onSelect(s)} aria-label={`${s.name} ${money(s.total)}`}>
              {b.r >= 24 && <b style={{ fontSize: Math.max(10, Math.min(13, b.r / 4.2)) }}>{s.name}</b>}
              {b.r >= 30 && <span>{Math.round((s.total / total) * 100)}%</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────── receipt ─────────
export interface ReceiptSummary { spent: number; paidOut: number; friendName?: string; balanceInPeriod: number; claims: number }

export function Receipt({ expenses, categories, people, title, summary, onEdit }: {
  expenses: Expense[]; categories: Category[]; people: Person[]; title: string; summary: ReceiptSummary; onEdit: (e: Expense) => void;
}) {
  const rows = [...expenses].sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
  const nf = (n: number) => money(n).replace("Rs ", "");
  return (
    <div className="receipt">
      <div className="receipt-title">{title.toUpperCase()}</div>
      <div className="receipt-sub">STATEMENT</div>
      <div className="dash" />
      {rows.length === 0 && <div className="receipt-sub" style={{ padding: "18px 0" }}>NOTHING YET</div>}
      {rows.map((e) => {
        const cat = categories.find((c) => c.id === e.category_id)?.name ?? "Uncategorized";
        const fr = people.find((p) => p.id === e.person_id)?.name;
        const how = e.split === "personal" ? "PERSONAL"
          : e.split === "reimbursable" ? `CLAIM ${nf(e.amount)}`
          : e.paid_by === "friend" ? `${(fr ?? "FRIEND").toUpperCase()} PAID ${nf(e.amount)}`
          : `SPLIT${fr ? " " + fr.toUpperCase() : ""} · OF ${nf(e.amount)}`;
        return (
          <button key={e.id} className="r-line" onClick={() => onEdit(e)}>
            <span className="r-row"><span className="r-name">{(e.note || cat).toUpperCase()}</span><i /><b>{e.split === "reimbursable" ? "CLAIM" : nf(myCost(e))}</b></span>
            <span className="r-sub">{prettyDate(e.spent_on).toUpperCase()} · {cat.toUpperCase()} · {how}</span>
          </button>
        );
      })}
      <div className="dash" />
      <div className="r-row big"><span>YOU SPENT</span><i /><b>{money(summary.spent).toUpperCase()}</b></div>
      <div className="r-row"><span>PAID OUT</span><i /><b>{nf(summary.paidOut)}</b></div>
      {summary.friendName && summary.balanceInPeriod !== 0 && (
        <div className="r-row"><span>{summary.balanceInPeriod > 0 ? `${summary.friendName.toUpperCase()} OWES YOU` : `YOU OWE ${summary.friendName.toUpperCase()}`}</span><i /><b>{nf(Math.abs(summary.balanceInPeriod))}</b></div>
      )}
      {summary.claims > 0 && <div className="r-row"><span>COMPANY OWES</span><i /><b>{nf(summary.claims)}</b></div>}
    </div>
  );
}

// ───────── small day/month bars ─────────
export function DayBars({ data, height = 70 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.findIndex((d) => d.value === max && max > 1);
  const dense = data.length > 16;
  return (
    <div className="daybars" style={{ height: height + 18 }}>
      {data.map((d, i) => (
        <div key={i} className="daybar" title={`${d.label}: ${money(d.value)}`}>
          <i style={{ height: Math.max(3, (d.value / max) * height), background: i === peak ? "var(--ac)" : "var(--seg-strong)" }} />
          {(!dense || i % 5 === 0 || i === data.length - 1) && <small>{d.label}</small>}
        </div>
      ))}
    </div>
  );
}

export const totalOf = (xs: Slice[]) => sum(xs.map((s) => s.total));
export { SPLIT_LABELS };
