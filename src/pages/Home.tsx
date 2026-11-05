import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { PeriodNav } from "../components/PeriodBar";
import { ChartMenu } from "../components/ChartMenu";
import { Overview } from "./Overview";
import { Review } from "./Review";
import { usePeriod } from "../lib/period";
import { ExpenseSheet } from "../components/ExpenseSheet";
import { BarChart, BubbleChart, GaugeChart, Receipt, RingChart } from "../components/charts";
import { Icon } from "../lib/icons";
import { inRange, prettyDate } from "../lib/dates";
import { money } from "../lib/format";
import { chartSlices, namesOf, oweByPerson, friendOwesMe, iOweFriend, myCost, paidOut, rankCategories, sum, type Slice } from "../lib/calc";
import { APP, DEFAULT_CHART_VIEW, SPLIT_LABELS, type ChartView } from "../lib/config";
import { getPref, setPref } from "../lib/prefs";

const VIEWS: readonly ChartView[] = ["receipt", "bubbles", "gauge", "ring", "bar"];

export function Home() {
  const { expenses, categories, people, settlements } = useData();
  const { state: p, range, label } = usePeriod();
  const [overview, setOverview] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [view, setView] = useState<ChartView>(() => getPref<ChartView>("homeView", DEFAULT_CHART_VIEW, VIEWS));
  const [pop, setPop] = useState<Slice | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ e?: import("../lib/types").Expense; cat?: string } | null>(null);

  const inPeriod = useMemo(() => expenses.filter((e) => inRange(e.spent_on, range)), [expenses, range]);
  const ranked = useMemo(() => rankCategories(inPeriod, categories, myCost), [inPeriod, categories]);
  const slices = useMemo(() => chartSlices(ranked), [ranked]);
  const total = sum(ranked.map((s) => s.total));

  const changeView = (v: ChartView) => { setView(v); setPref("homeView", v); };
  const select = (s: Slice) => setPop(s);
  const addTo = (s: Slice) => setEditing({ cat: s.ids.length === 1 && s.id !== "none" ? s.id : undefined });
  const seeEntries = (s: Slice) => {
    setOpenId(s.id);
    window.setTimeout(() => document.getElementById(`cat-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  const claims = sum(inPeriod.filter((e) => e.split === "reimbursable" && !e.reimbursed_at).map((e) => e.amount));
  const chartProps = { slices, total, onSelect: select };

  // Headline = cash you actually paid for yourself and shared bills (company claims come back in full, so they are listed separately).
  const paid = sum(inPeriod.filter((e) => e.split !== "reimbursable").map(paidOut));
  const oweRows = oweByPerson(inPeriod, settlements, people, range).filter((r) => r.net > 0);
  const owe = sum(oweRows.map((r) => r.net));
  const parts = [owe > 0 && `+ ${money(owe)} owed to ${APP.FRIENDS_LABEL}`, claims > 0 && `${money(claims)} claims waiting`].filter(Boolean) as string[];
  const breakdown = parts.length ? `${parts.join(" · ")} · estimated spent ${money(total)}` : total !== paid ? `Estimated spent ${money(total)}` : "Tap for the full picture";
  const toReview = expenses.filter((e) => !e.reviewed).length;
  if (reviewing) return <Review onBack={() => setReviewing(false)} />;
  if (overview) return <Overview onBack={() => setOverview(false)} />;

  return (
    <>
      <PeriodNav />
      {toReview > 0 && (
        <button className="review-banner" onClick={() => setReviewing(true)}><span><b>{toReview} imported {toReview === 1 ? "entry" : "entries"} to review</b><small>Mark splits, claims and what was already paid back</small></span><Icon name="chev" size={18} /></button>
      )}
      <button className="hero hero-btn" onClick={() => setOverview(true)} aria-label="Open overview">
        <span className="lab">Paid by you{p.period === "all" ? " in total" : ` · ${label}`}</span>
        <span className="big serif">{money(paid)}</span>
        <span className="hero-more">{breakdown} <Icon name="chev" size={14} /></span>
      </button>

      <div className="chart-head"><span className="lab">By category</span><ChartMenu value={view} onChange={changeView} views={VIEWS} /></div>

      {view === "receipt" ? (
        <Receipt expenses={inPeriod} categories={categories} people={people} title={label} onEdit={(e) => setEditing({ e })}
          summary={{ spent: total, paidOut: sum(inPeriod.map(paidOut)), friendName: namesOf(people.filter((pp) => inPeriod.some((e) => e.person_id === pp.id))), balanceInPeriod: sum(inPeriod.map(friendOwesMe)) - sum(inPeriod.map(iOweFriend)), claims }} />
      ) : slices.length === 0 ? (
        <p className="empty">Nothing spent in this period yet. Tap + to add an expense.</p>
      ) : view === "bubbles" ? <BubbleChart {...chartProps} />
        : view === "gauge" ? <GaugeChart {...chartProps} />
        : view === "ring" ? <RingChart {...chartProps} /> : <BarChart {...chartProps} />}

      {pop && view !== "receipt" && (() => {
        const live = slices.find((x) => x.id === pop.id) ?? pop;
        const single = live.ids.length === 1;
        return (
          <div className="pop" role="dialog" aria-label={live.name}>
            <button className="icon-btn pop-x" aria-label="Close" onClick={() => setPop(null)}><Icon name="close" size={16} /></button>
            <span className="tile" style={{ ["--c" as string]: live.color }}><Icon name={live.icon} size={20} /></span>
            <div className="grow"><b>{live.name}</b><small>{Math.round((live.total / total) * 100)}% · {live.count} {live.count === 1 ? "entry" : "entries"}</small></div>
            <b className="serif pop-amt">{money(live.total)}</b>
            {single && <div className="pop-actions"><button className="btn primary small" onClick={() => addTo(live)}><Icon name="plus" size={14} /> Add expense</button>
              <button className="btn small" onClick={() => { seeEntries(live); setPop(null); }}>See entries</button></div>}
          </div>
        );
      })()}

      {view !== "receipt" && ranked.length > 0 && (
        <>
          <div className="lab section">All categories · {ranked.length}</div>
          <div className="card list">
            {ranked.map((s) => {
              const on = openId === s.id;
              const items = on ? inPeriod.filter((e) => (e.category_id ?? "none") === s.id && myCost(e) > 0).sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at)) : [];
              return (
                <div key={s.id} id={`cat-${s.id}`} className={`catrow ${on ? "open" : ""}`}>
                  <button className="row" onClick={() => setOpenId(on ? null : s.id)} aria-expanded={on}>
                    <span className="dot" style={{ background: s.color }} />
                    <div className="grow"><b>{s.name}<span className="badge">{s.count}</span></b><small>{Math.round((s.total / total) * 100)}% of spending</small></div>
                    <span className="v serif">{money(s.total)}</span>
                    <span className="chev" style={{ transform: on ? "rotate(90deg)" : undefined }}><Icon name="chev" size={16} /></span>
                  </button>
                  {on && (
                    <div className="entries">
                      {items.map((e) => {
                        const fr = people.find((p) => p.id === e.person_id)?.name;
                        const tag = e.split === "personal" ? "" : e.paid_by === "friend" ? `${fr ?? "Friend"} paid` : `${SPLIT_LABELS[e.split]}${fr ? " · " + fr : ""}`;
                        return (
                          <button key={e.id} className="ent" onClick={() => setEditing({ e })}>
                            <span className="a serif">{money(myCost(e))}{myCost(e) !== e.amount && <small> of {money(e.amount)}</small>}</span>
                            <span className="t">{e.note || s.name}{tag && <small>{tag}</small>}</span>
                            <span className="d">{prettyDate(e.spent_on).replace(/ \d{4}$/, "")}</span>
                          </button>
                        );
                      })}
                      <button className="ent addto" onClick={() => addTo(s)}><Icon name="plus" size={14} /> Add to {s.name}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!pop && <button className="fab" onClick={() => setEditing({})} aria-label="Add expense"><Icon name="plus" size={26} /></button>}
      {editing && <ExpenseSheet existing={editing.e} defaultCategoryId={editing.cat} onClose={() => setEditing(null)} />}
    </>
  );
}
