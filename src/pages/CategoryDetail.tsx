import { useMemo } from "react";
import { Icon } from "../lib/icons";
import { DayBars } from "../components/charts";
import { fromISO, prettyDate, toISO, type Period } from "../lib/dates";
import { money } from "../lib/format";
import { myCost, sum, type Slice } from "../lib/calc";
import { APP, SPLIT_LABELS } from "../lib/config";
import { useData } from "../lib/data";
import type { Expense } from "../lib/types";

export function CategoryDetail({ slice, expenses, grand, period, range, label, onBack, onEdit, onAdd }: {
  slice: Slice; expenses: Expense[]; grand: number; period: Period; range: { from: string; to: string }; label: string;
  onBack: () => void; onEdit: (e: Expense) => void; onAdd: () => void;
}) {
  const { people } = useData();
  const list = useMemo(() => expenses.filter((e) => slice.ids.includes(e.category_id ?? "none")), [expenses, slice]);
  const total = sum(list.map(myCost));

  const bars = useMemo(() => {
    const monthly = period === "year" || period === "all";
    const m = new Map<string, number>();
    for (const e of list) { const k = monthly ? e.spent_on.slice(0, 7) : e.spent_on; m.set(k, (m.get(k) ?? 0) + myCost(e)); }
    if (!monthly && period !== "day") {
      for (const d = fromISO(range.from), end = fromISO(range.to); d <= end; d.setDate(d.getDate() + 1)) {
        const k = toISO(d); if (!m.has(k)) m.set(k, 0);
      }
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      label: monthly ? fromISO(k + "-01").toLocaleDateString(APP.LOCALE, { month: "short" }) : String(Number(k.slice(8))), value: v,
    }));
  }, [list, period, range]);

  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of list) m.set(e.spent_on, [...(m.get(e.spent_on) ?? []), e]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [list]);

  return (
    <>
      <div className="top">
        <button className="back" onClick={onBack}><span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chev" size={20} /></span> Overview</button>
        <span className="mon">{label}</span>
      </div>
      <div className="cat-head">
        <span className="tile big" style={{ ["--c" as string]: slice.color }}><Icon name={slice.icon} size={24} /></span>
        <div><h1 className="serif">{slice.name}</h1><div className="muted">{list.length} {list.length === 1 ? "entry" : "entries"} · {grand ? Math.round((total / grand) * 100) : 0}% of spending</div></div>
      </div>
      <div className="lab">{money(total)} spent</div>
      {bars.length > 1 && <DayBars data={bars} />}
      {groups.length === 0 && <p className="empty">No entries here for this period.</p>}
      {groups.map(([date, items]) => (
        <section key={date}>
          <div className="day-head"><span>{prettyDate(date)}</span><span>{money(sum(items.map(myCost)))}</span></div>
          <div className="card list">
            {items.map((e) => {
              const fr = people.find((p) => p.id === e.person_id)?.name;
              return (
                <button key={e.id} className="row" onClick={() => onEdit(e)}>
                  <div className="grow"><b>{e.note || slice.name}</b>
                    <small>{e.split === "personal" ? "Personal" : e.paid_by === "friend" ? `${fr ?? "Friend"} paid · ${SPLIT_LABELS[e.split].toLowerCase()}` : `${SPLIT_LABELS[e.split]}${fr ? " with " + fr : ""}`}</small></div>
                  <div className="right"><span className="v serif">{money(myCost(e))}</span>{myCost(e) !== e.amount && <small>of {money(e.amount)}</small>}</div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <button className="fab" onClick={onAdd} aria-label="Add expense"><Icon name="plus" size={26} /></button>
    </>
  );
}
