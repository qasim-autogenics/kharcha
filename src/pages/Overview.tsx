import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { usePeriod } from "../lib/period";
import { PeriodNav } from "../components/PeriodBar";
import { Sheet } from "../components/Sheet";
import { Icon } from "../lib/icons";
import { accountBalance, buildLoans, friendBalance, friendOwesMe, iOweFriend, incoming, myCost, namesOf, oweByPerson, paidOut, sum } from "../lib/calc";
import { CHART_COLORS, DEFAULT_TARGET_NAME } from "../lib/config";
import { inRange, prettyDate, today } from "../lib/dates";
import { money } from "../lib/format";
import { Summary } from "./Summary";
import { useNav } from "../lib/nav";
import { Secret, peek, useMasked } from "../lib/privacy";
import { useBackLayer } from "../lib/backstack";

/** The full money picture for the selected period. Home stays minimal; this is one tap away. */
export function Overview({ onBack }: { onBack: () => void }) {
  const { expenses, people, settlements, loans, loanPayments, budget, targets, incomes, openingBalance, addIncome, deleteIncome } = useData();
  const { state, range, label } = usePeriod();
  const [adding, setAdding] = useState(false);
  const [summary, setSummary] = useState(false);
  const { openPay } = useNav();

  const list = useMemo(() => expenses.filter((e) => inRange(e.spent_on, range)), [expenses, range]);
  const inc = useMemo(() => incomes.filter((i) => inRange(i.received_on, range)), [incomes, range]);
  const loanViews = useMemo(() => buildLoans(loans, loanPayments, people), [loans, loanPayments, people]);

  const net = sum(list.map(myCost));
  const back = incoming(expenses, settlements, loanViews, people);
  const balances = people.map((pp) => ({ person: pp, bal: friendBalance(pp.id, expenses, settlements).balance }));
  const incomeHidden = useMasked();
  const acct = accountBalance(openingBalance, expenses, incomes, settlements, loans, loanPayments);

  // ── "coming back", scoped to the selected period ──
  const mineP = list.filter((e) => e.person_id);
  const shareP = sum(mineP.map(friendOwesMe)) - sum(mineP.map(iOweFriend));            // net the roommate owes from this period's expenses
  const paidBackP = sum(settlements.filter((s) => inRange(s.paid_on, range)).map((s) => (s.direction === "received" ? s.amount : -s.amount)));
  const roommateP = Math.max(0, shareP - paidBackP);
  const claimsP = sum(list.filter((e) => e.split === "reimbursable" && !e.reimbursed_at).map((e) => e.amount));
  const claimsRecvP = sum(expenses.filter((e) => e.split === "reimbursable" && e.reimbursed_at && inRange(e.reimbursed_at, range)).map((e) => e.amount));
  const gaveP = loanViews.filter((l) => l.direction === "gave" && inRange(l.loan_date, range));
  const loansP = sum(gaveP.map((l) => l.outstanding));
  const loanBackP = sum(loanViews.filter((l) => l.direction === "gave").flatMap((l) => l.payments).filter((x) => inRange(x.paid_on, range)).map((x) => x.amount));
  const comingP = roommateP + claimsP + loansP;
  // reconciliation: net spent = cash paid - friend shares - company claims + your share of bills the friend paid
  const shareBackAll = sum(list.map(friendOwesMe));
  const claimsOut = sum(list.filter((e) => e.split === "reimbursable").map((e) => e.amount));
  const oweGross = sum(list.map(iOweFriend));
  const paidNow = sum(list.filter((e) => e.split !== "reimbursable").map(paidOut));
  const oweRows = oweByPerson(list, settlements, people, range).filter((r) => r.net > 0);
  // per person: what they still owe you from this period's bills, net of what they already paid you in it
  const owedRows = people.map((person) => {
    const gross = sum(list.filter((e) => e.person_id === person.id).map(friendOwesMe));
    const got = sum(settlements.filter((x) => x.person_id === person.id && x.direction === "received" && inRange(x.paid_on, range)).map((x) => x.amount));
    return { person, net: Math.max(0, gross - got) };
  }).filter((r) => r.net > 0);
  const friendsIn = namesOf(people.filter((pp) => list.some((e) => e.person_id === pp.id && friendOwesMe(e) > 0)));
  const friendsOut = namesOf(oweRows.map((r) => r.person));
  const incomingAll = back.total;
  const left = (budget ?? 0) - net;
  const perTarget = targets.map((t, i) => ({
    t, color: CHART_COLORS[i % CHART_COLORS.length],
    v: sum(list.filter((e) => (e.target_id ? e.target_id === t.id : t.name === DEFAULT_TARGET_NAME)).map(myCost)),
  })).filter((x) => x.v > 0);

  useBackLayer(summary, () => setSummary(false));
  if (summary) return <Summary onBack={() => setSummary(false)} />;
  return (
    <>
      <div className="top"><button className="back" onClick={onBack}><span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chev" size={20} /></span> Home</button></div>
      <PeriodNav />

      <div className="hero">
        <div className="lab">Paid by you · {label}</div>
        <div className="big serif">{money(paidNow)}</div>
        <div className="muted small">Cash that left your pocket for yourself and shared bills.</div>
      </div>

      <div className="lab section">Estimated spent</div>
      <div className="card">
        <div className="line"><span>Cash you paid</span><b>{money(paidNow)}</b></div>
        {shareBackAll > 0 && <div className="line"><span>minus what {friendsIn} owes you</span><b className="pos">−{money(shareBackAll)}</b></div>}
        {oweGross > 0 && <div className="line"><span>plus what you owe {namesOf(oweByPerson(list, settlements, people, range).map((r) => r.person))}</span><b className="neg">+{money(oweGross)}</b></div>}
        <div className="line"><span><b>Estimated spent</b></span><b>{money(net)}</b></div>
      </div>
      {claimsOut > 0 && <p className="hint">Company claims you paid ({money(claimsOut)}) are not counted above because they come back in full.</p>}
      {owedRows.length > 0 && (
        <div className="card owed-card">
          {owedRows.map((r) => (
            <button key={r.person.id} className="line tap" onClick={() => openPay({ personId: r.person.id, direction: "received", amount: r.net })}>
              <span><b>{r.person.name} owes you</b><span className="muted small"> · not received yet</span></span>
              <span className="tap-r"><b className="pos">{money(r.net)}</b><Icon name="chev" size={14} /></span>
            </button>
          ))}
          <p className="hint" style={{ margin: 0 }}>Tap a name when they pay you. The amount is filled in, change it if they paid less.</p>
        </div>
      )}
      {oweRows.length > 0 && (
        <div className="card owe-card">
          {oweRows.map((r) => (
            <button key={r.person.id} className="line tap" onClick={() => openPay({ personId: r.person.id, direction: "paid", amount: r.net })}>
              <span><b>You owe {r.person.name}</b><span className="muted small"> · not paid yet</span></span>
              <span className="tap-r"><b className="neg">{money(r.net)}</b><Icon name="chev" size={14} /></span>
            </button>
          ))}
          <p className="hint" style={{ margin: 0 }}>Bills {friendsOut} paid for you in this period. Tap a name when you pay. The amount is filled in, change it for a part payment.</p>
        </div>
      )}

      <div className="lab section">Coming back · {label}</div>
      <div className="card">
        <div className="line"><span><b>Still to come from this period</b></span><b className="pos">{money(comingP)}</b></div>
        {people.length > 0 && <div className="line"><span>Friends' share of this period</span><b>{money(Math.max(0, shareP))}</b></div>}
        {people.length > 0 && <div className="line"><span>Paid back by friends in this period</span><b className="pos">{money(Math.max(0, paidBackP))}</b></div>}
        <div className="line"><span>Company claims pending</span><b>{money(claimsP)}</b></div>
        {claimsRecvP > 0 && <div className="line"><span>Claims received in this period</span><b className="pos">{money(claimsRecvP)}</b></div>}
        <div className="line"><span>Loans you gave in this period, unpaid</span><b>{money(loansP)}</b></div>
        {loanBackP > 0 && <div className="line"><span>Loan money returned in this period</span><b className="pos">{money(loanBackP)}</b></div>}
        {balances.filter((x) => x.bal < 0).map((x) => <div key={x.person.id} className="line"><span>You owe {x.person.name} (all time)</span><b className="neg">{money(-x.bal)}</b></div>)}
        <div className="line small"><span className="muted">Still owed to you across all time</span><b>{money(back.total)}</b></div>
      </div>
      <p className="hint">Tap Roommates → “… paid me” when money arrives. It shows up here under “Paid back by friends”, and in the payment history on the Roommates tab.</p>

      {state.period === "month" && (
        <>
          <div className="lab section">Monthly budget</div>
          <div className="card budget">
            {budget === null ? <p className="muted small" style={{ margin: 0 }}>No budget set. Set one in Settings (gear icon) → Monthly budget to see what you save or overspend.</p> : (
              <>
                <div className="line"><span>{money(net)} of {money(budget)}</span><b className={left >= 0 ? "pos" : "neg"}>{left >= 0 ? `${money(left)} saved` : `${money(-left)} over`}</b></div>
                <div className="bar"><i style={{ width: `${Math.min(100, (net / budget) * 100)}%`, background: left >= 0 ? "var(--pos)" : "var(--neg)" }} /></div>
              </>
            )}
          </div>
        </>
      )}

      <div className="lab section">Account balance · all time</div>
      <div className="card">
        {acct.opening !== 0 && <div className="line"><span>Starting balance</span><b>{money(acct.opening)}</b></div>}
        <div className="line"><span>Money in</span><b className="pos">{money(acct.in.total)}</b></div>
        {acct.in.income > 0 && <div className="line small"><span className="muted">Income</span><b><Secret>{money(acct.in.income)}</Secret></b></div>}
        {acct.in.claims > 0 && <div className="line small"><span className="muted">Company claims paid back</span><b>{money(acct.in.claims)}</b></div>}
        {acct.in.friends > 0 && <div className="line small"><span className="muted">Friends paid you</span><b>{money(acct.in.friends)}</b></div>}
        {acct.in.loansBack > 0 && <div className="line small"><span className="muted">Loan money returned</span><b>{money(acct.in.loansBack)}</b></div>}
        {acct.in.borrowed > 0 && <div className="line small"><span className="muted">Money you borrowed</span><b>{money(acct.in.borrowed)}</b></div>}
        <div className="line"><span>Money out</span><b className="neg">−{money(acct.out.total)}</b></div>
        <div className="line small"><span className="muted">Paid for expenses (incl. company claims)</span><b>{money(acct.out.spent)}</b></div>
        {acct.out.friends > 0 && <div className="line small"><span className="muted">Paid to friends</span><b>{money(acct.out.friends)}</b></div>}
        {acct.out.loansGiven > 0 && <div className="line small"><span className="muted">Loans you gave</span><b>{money(acct.out.loansGiven)}</b></div>}
        {acct.out.loansRepaid > 0 && <div className="line small"><span className="muted">Loans you repaid</span><b>{money(acct.out.loansRepaid)}</b></div>}
        <div className="line"><span><b>Balance</b></span><b className={acct.balance >= 0 ? "pos" : "neg"}>{money(acct.balance)}</b></div>
        {incomingAll > 0 && <div className="line small"><span className="muted">Once everything owed to you comes back</span><b>{money(acct.balance + incomingAll)}</b></div>}
      </div>
      {incomeHidden ? (
        <button className="btn block" onClick={peek}><Icon name="eye" size={16} /> Income is hidden · tap to show</button>
      ) : (
        <>
      {inc.length > 0 && (
        <div className="card list">
          {inc.map((i) => (
            <div key={i.id} className="row static">
              <div className="grow"><b>{i.note || "Income"}</b><small>{prettyDate(i.received_on)}</small></div>
              <span className="v serif pos">+{money(i.amount)}</span>
              <button className="icon-btn" aria-label="Delete income" onClick={() => { if (confirm("Delete this income entry?")) void deleteIncome(i.id).catch((e) => alert(e.message)); }}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <button className="btn block" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add income</button>
        </>
      )}

      {perTarget.length > 0 && (
        <>
          <div className="lab section">Spent for</div>
          <div className="card">
            {perTarget.map(({ t, v, color }) => (
              <div key={t.id} className="tgt">
                <div className="line"><span><u className="dotu" style={{ background: color }} />{t.name}</span><b>{money(v)} <span className="muted small">· {net ? Math.round((v / net) * 100) : 0}%</span></b></div>
                <div className="bar"><i style={{ width: `${net ? (v / net) * 100 : 0}%`, background: color }} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn block" style={{ marginTop: 16 }} onClick={() => setSummary(true)}>Overall summary · all time</button>

      {adding && <IncomeSheet onClose={() => setAdding(false)} onSave={addIncome} />}
    </>
  );
}

function IncomeSheet({ onClose, onSave }: { onClose: () => void; onSave: (v: { amount: number; note: string; received_on: string }) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    setBusy(true);
    try { await onSave({ amount: amt, note: note.trim(), received_on: date }); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Sheet title="Add income" onClose={onClose}>
      <label className="lab">Amount</label>
      <input inputMode="decimal" autoFocus placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      <label className="lab">Note</label>
      <input placeholder="e.g. October salary" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save income"}</button>
    </Sheet>
  );
}
