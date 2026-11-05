import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { PeriodNav } from "../components/PeriodBar";
import { ChartMenu } from "../components/ChartMenu";
import { usePeriod } from "../lib/period";
import { BarChart, BubbleChart, DayBars, GaugeChart, RingChart } from "../components/charts";
import { addPeriod, fromISO, inRange, periodRange, toISO } from "../lib/dates";
import { money } from "../lib/format";
import { chartSlices, friendOwesMe, iOweFriend, myCost, paidOut, rankCategories, sum } from "../lib/calc";
import { APP, DEFAULT_TARGET_NAME, type ChartView } from "../lib/config";
import { getPref, setPref } from "../lib/prefs";

const VIEWS: readonly ChartView[] = ["bubbles", "gauge", "ring", "bar"];

export function Analytics() {
  const { expenses, categories, targets } = useData();
  const { state: p, range } = usePeriod();
  const [view, setView] = useState<ChartView>(() => getPref<ChartView>("statsView", "ring", VIEWS));
  const [measure, setMeasure] = useState<"mine" | "paid">("mine");
  const fn = measure === "mine" ? myCost : paidOut;

  const list = useMemo(() => expenses.filter((e) => inRange(e.spent_on, range)), [expenses, range]);
  const ranked = useMemo(() => rankCategories(list, categories, fn), [list, categories, fn]);
  const slices = useMemo(() => chartSlices(ranked), [ranked]);
  const total = sum(ranked.map((s) => s.total));

  const prevTotal = useMemo(() => {
    if (p.period === "all") return null;
    const r = periodRange(addPeriod(p.anchor, p.period, -1), p.period);
    // current period is still running: compare with the same number of days of the previous one
    const now = toISO(new Date());
    if (p.period !== "day" && inRange(now, range)) {
      const elapsed = Math.round((fromISO(now).getTime() - fromISO(range.from).getTime()) / 864e5);
      const end = fromISO(r.from); end.setDate(end.getDate() + elapsed);
      r.to = toISO(end) < r.to ? toISO(end) : r.to;
    }
    return sum(expenses.filter((e) => inRange(e.spent_on, r)).map(fn));
  }, [expenses, p, fn, range]);

  const bars = useMemo(() => {
    const monthly = p.period === "year" || p.period === "all";
    const m = new Map<string, number>();
    for (const e of list) { const k = monthly ? e.spent_on.slice(0, 7) : e.spent_on; m.set(k, (m.get(k) ?? 0) + fn(e)); }
    if (!monthly && p.period !== "day") {
      for (const d = fromISO(range.from), end = fromISO(range.to); d <= end; d.setDate(d.getDate() + 1)) { const k = toISO(d); if (!m.has(k)) m.set(k, 0); }
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      label: monthly ? fromISO(k + "-01").toLocaleDateString(APP.LOCALE, { month: "short" }) : String(Number(k.slice(8))), value: v }));
  }, [list, p.period, range, fn]);

  const days = useMemo(() => {
    if (p.period !== "all") return Math.max(1, Math.round((fromISO(range.to).getTime() - fromISO(range.from).getTime()) / 864e5) + 1);
    const first = list.reduce((m, e) => (e.spent_on < m ? e.spent_on : m), list[0]?.spent_on ?? toISO(new Date()));
    return Math.max(1, Math.round((Date.now() - fromISO(first).getTime()) / 864e5) + 1);
  }, [list, p.period, range]);

  const biggest = [...list].sort((a, b) => fn(b) - fn(a))[0];
  const delta = prevTotal !== null && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const changeView = (v: ChartView) => { setView(v); setPref("statsView", v); };
  const cp = { slices, total, onSelect: () => {} };

  return (
    <>
      <PeriodNav />
      <div className="seg"><button className={measure === "mine" ? "on" : ""} onClick={() => setMeasure("mine")}>My real cost</button>
        <button className={measure === "paid" ? "on" : ""} onClick={() => setMeasure("paid")}>Out of my account</button></div>
      <div className="chart-head"><span className="lab">By category</span><ChartMenu value={view === "receipt" ? "ring" : view} onChange={changeView} views={VIEWS} /></div>
      {slices.length === 0 ? <p className="empty">Nothing to analyse in this period.</p> : (
        <>
          {view === "bubbles" ? <BubbleChart {...cp} /> : view === "gauge" ? <GaugeChart {...cp} /> : view === "bar" ? <BarChart {...cp} /> : <RingChart {...cp} />}
          <div className="stats">
            <div><span className="muted">Total</span><b className="serif">{money(total)}</b></div>
            <div><span className="muted">Per day</span><b className="serif">{money(total / days)}</b></div>
            <div><span className="muted">Entries</span><b className="serif">{list.length}</b></div>
          </div>
          <div className="lab section">{p.period === "year" || p.period === "all" ? "By month" : "By day"}</div>
          <DayBars data={bars} height={90} />
          <div className="lab section">Insights</div>
          <div className="card">
            {biggest && <div className="line"><span>Biggest expense</span><b>{money(fn(biggest))}{biggest.note ? ` · ${biggest.note}` : ""}</b></div>}
            {ranked[0] && <div className="line"><span>Top category</span><b>{ranked[0].name}</b></div>}
            {delta !== null && <div className="line"><span>Vs previous {p.period}{p.period !== "day" && inRange(toISO(new Date()), range) ? " (same days)" : ""}</span><b className={delta > 0 ? "neg" : "pos"}>{delta > 0 ? "+" : ""}{delta}%</b></div>}
            {targets.map((t) => (
              <div key={t.id} className="line"><span>Spent for {t.name}</span><b>{money(sum(list.filter((e) => (e.target_id ? e.target_id === t.id : t.name === DEFAULT_TARGET_NAME)).map(fn)))}</b></div>
            ))}
            <div className="line"><span>Friends owe you (this period)</span><b>{money(sum(list.map(friendOwesMe)))}</b></div>
            <div className="line"><span>You owe friends (this period)</span><b>{money(sum(list.map(iOweFriend)))}</b></div>
            <div className="line"><span>Company claims pending</span><b>{money(sum(list.filter((e) => e.split === "reimbursable" && !e.reimbursed_at).map((e) => e.amount)))}</b></div>
          </div>
        </>
      )}
    </>
  );
}
