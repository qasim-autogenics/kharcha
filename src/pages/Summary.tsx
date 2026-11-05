import { useMemo } from "react";
import { useData } from "../lib/data";
import { Icon } from "../lib/icons";
import { accountBalance, billStatus, buildLoans, friendBalance, myCost, paidOut, sum } from "../lib/calc";
import { fromISO } from "../lib/dates";
import { money } from "../lib/format";
import type { Expense, Settlement, SettlementAllocation } from "../lib/types";

const monthKey = (iso: string) => iso.slice(0, 7);
const monthName = (key: string) => fromISO(`${key}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** Which months a person's open balance comes from. Payments settle the oldest months first. */
function pendingMonths(personId: string, balance: number, expenses: Expense[], settlements: Settlement[], allocations: SettlementAllocation[]) {
  if (balance === 0) return [];
  const sign = balance > 0 ? 1 : -1;
  const byMonth = new Map<string, number>();
  for (const b of billStatus(personId, expenses, settlements, allocations)) {
    if (b.open > 0 && (b.dir === "received" ? 1 : -1) === sign) byMonth.set(monthKey(b.expense.spent_on), (byMonth.get(monthKey(b.expense.spent_on)) ?? 0) + sign * b.open);
  }
  let left = Math.abs(balance);
  const out: { key: string; amount: number }[] = [];
  for (const [key, v] of [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    if (left <= 0) break;
    const take = Math.min(left, Math.abs(v));
    out.push({ key, amount: take });
    left -= take;
  }
  return out;
}

/** Everything, all time: totals, who owes whom and from which month. */
export function Summary({ onBack }: { onBack: () => void }) {
  const { expenses, people, settlements, allocations, loans, loanPayments, incomes, openingBalance } = useData();
  const loanViews = useMemo(() => buildLoans(loans, loanPayments, people), [loans, loanPayments, people]);

  const totalSpent = sum(expenses.map(myCost));
  const acct = accountBalance(openingBalance, expenses, incomes, settlements, loans, loanPayments);

  const claims = expenses.filter((e) => e.split === "reimbursable" && !e.reimbursed_at);
  const claimsTotal = sum(claims.map((e) => e.amount));
  const claimMonths = [...claims.reduce((m, e) => m.set(monthKey(e.spent_on), (m.get(monthKey(e.spent_on)) ?? 0) + e.amount), new Map<string, number>())]
    .sort((a, b) => b[0].localeCompare(a[0]));

  const rows = people.map((p) => {
    const b = friendBalance(p.id, expenses, settlements).balance;
    const gave = sum(loanViews.filter((l) => l.person_id === p.id && l.direction === "gave").map((l) => l.outstanding));
    const borrowed = sum(loanViews.filter((l) => l.person_id === p.id && l.direction === "borrowed").map((l) => l.outstanding));
    return { p, split: b, gave, borrowed, months: pendingMonths(p.id, b, expenses, settlements, allocations), net: b + gave - borrowed };
  }).filter((r) => r.split !== 0 || r.gave > 0 || r.borrowed > 0);

  const theyOwe = rows.filter((r) => r.net > 0);
  const iOwe = rows.filter((r) => r.net < 0);
  const comeTotal = sum(theyOwe.map((r) => r.net)) + claimsTotal;
  const oweTotal = sum(iOwe.map((r) => -r.net));

  const months = [...new Set(expenses.map((e) => monthKey(e.spent_on)))].sort((a, b) => b.localeCompare(a));
  const perMonth = months.map((k) => {
    const l = expenses.filter((e) => monthKey(e.spent_on) === k);
    return { k, spent: sum(l.map(myCost)), cash: sum(l.map(paidOut)), n: l.length };
  });

  const detail = (r: (typeof rows)[number]) => (
    <>
      {r.split !== 0 && r.months.map((m) => (
        <div key={m.key} className="line small"><span className="muted">{monthName(m.key)} · shared bills</span><b>{money(m.amount)}</b></div>
      ))}
      {r.gave > 0 && <div className="line small"><span className="muted">Loan you gave</span><b>{money(r.gave)}</b></div>}
      {r.borrowed > 0 && <div className="line small"><span className="muted">Loan you borrowed</span><b>{money(r.borrowed)}</b></div>}
    </>
  );

  return (
    <>
      <div className="top"><button className="back" onClick={onBack}><span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chev" size={20} /></span> Overview</button></div>
      <div className="hero">
        <div className="lab">Overall summary · all time</div>
        <div className="big serif">{money(totalSpent)}</div>
        <div className="muted small">Your real cost across every month you have entries for.</div>
      </div>

      <div className="lab section">Money</div>
      <div className="card">
        <div className="line"><span>Total spent (real cost)</span><b>{money(totalSpent)}</b></div>
        <div className="line"><span>Money in (all time)</span><b className="pos">{money(acct.in.total)}</b></div>
        <div className="line"><span>Money out (all time)</span><b className="neg">{money(acct.out.total)}</b></div>
        {acct.opening !== 0 && <div className="line"><span>Starting balance</span><b>{money(acct.opening)}</b></div>}
        <div className="line"><span><b>Account balance</b></span><b className={acct.balance >= 0 ? "pos" : "neg"}>{money(acct.balance)}</b></div>
      </div>

      <div className="lab section">Still to come to you · {money(comeTotal)}</div>
      {theyOwe.length === 0 && claimsTotal === 0 && <div className="card"><div className="muted small">Nothing is pending.</div></div>}
      {theyOwe.map((r) => (
        <div key={r.p.id} className="card">
          <div className="line"><span><b>{r.p.name}</b></span><b className="pos">{money(r.net)}</b></div>
          {detail(r)}
        </div>
      ))}
      {claimsTotal > 0 && (
        <div className="card">
          <div className="line"><span><b>Company claims</b></span><b className="pos">{money(claimsTotal)}</b></div>
          {claimMonths.map(([k, v]) => <div key={k} className="line small"><span className="muted">{monthName(k)}</span><b>{money(v)}</b></div>)}
        </div>
      )}

      <div className="lab section">You owe · {money(oweTotal)}</div>
      {iOwe.length === 0 && <div className="card"><div className="muted small">You don't owe anyone.</div></div>}
      {iOwe.map((r) => (
        <div key={r.p.id} className="card owe-card">
          <div className="line"><span><b>{r.p.name}</b></span><b className="neg">{money(-r.net)}</b></div>
          {detail(r)}
        </div>
      ))}
      <p className="hint">Months show the bills still open. A payment you tied to bills settles those; any other payment settles the oldest bills first.</p>

      <div className="lab section">Month by month</div>
      <div className="card">
        {perMonth.length === 0 && <div className="muted small">No entries yet.</div>}
        {perMonth.map((m) => (
          <div key={m.k} className="line"><span>{monthName(m.k)} <span className="muted small">· {m.n} entries</span></span><b>{money(m.spent)}</b></div>
        ))}
      </div>
    </>
  );
}
