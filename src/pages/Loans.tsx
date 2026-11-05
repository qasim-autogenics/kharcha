import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { Sheet } from "../components/Sheet";
import { Icon } from "../lib/icons";
import { buildLoans, sum, type LoanView } from "../lib/calc";
import { money } from "../lib/format";
import { prettyDate, today } from "../lib/dates";
import type { LoanDirection, LoanPayment } from "../lib/types";

type Filter = "all" | "open" | "settled";
const statusLabel = { open: "Open", partial: "Partly returned", settled: "Settled" } as const;

export function Loans() {
  const { loans, loanPayments, people } = useData();
  const [filter, setFilter] = useState<Filter>("open");
  const [adding, setAdding] = useState(false);
  const [repaying, setRepaying] = useState<LoanView | null>(null);
  const [editing, setEditing] = useState<LoanView | null>(null);
  const [editPay, setEditPay] = useState<{ loan: LoanView; pay: LoanPayment } | null>(null);

  const views = useMemo(() => buildLoans(loans, loanPayments, people), [loans, loanPayments, people]);
  const owedToMe = sum(views.filter((l) => l.direction === "gave").map((l) => l.outstanding));
  const iOwe = sum(views.filter((l) => l.direction === "borrowed").map((l) => l.outstanding));
  const shown = views.filter((l) => filter === "all" || (filter === "settled") === (l.status === "settled"));

  return (
    <>
      <div className="two">
        <div className="card center"><span className="lab">Owed to you</span><b className="serif pos">{money(owedToMe)}</b></div>
        <div className="card center"><span className="lab">You owe</span><b className="serif neg">{money(iOwe)}</b></div>
      </div>
      <div className="seg">{(["open", "settled", "all"] as Filter[]).map((f) => <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>)}</div>

      {shown.length === 0 && <p className="empty">{filter === "open" ? "No open loans. Settled ones stay under “Settled”." : "Nothing here yet."}</p>}
      {shown.map((l) => {
        const name = l.person?.name ?? "Someone";
        return (
          <div key={l.id} className="card loan">
            <div className="loan-top">
              <div><b>{l.direction === "gave" ? `You gave ${name}` : `${name} gave you`}</b><div className="muted small">{money(l.amount)} · {prettyDate(l.loan_date)}{l.note ? ` · ${l.note}` : ""}</div></div>
              <span className={`pill status ${l.status}`}>{statusLabel[l.status]}</span>
            </div>
            <div className="bar"><i style={{ width: `${(l.repaid / l.amount) * 100}%` }} /></div>
            <div className="line small"><span className="muted">Returned {money(l.repaid)}</span><b>{l.outstanding > 0 ? `${money(l.outstanding)} left` : "All returned"}</b></div>
            <div className="timeline">
              <div>{l.direction === "gave" ? `Gave ${name}` : `Borrowed from ${name}`} {money(l.amount)} <span className="muted">· {prettyDate(l.loan_date)}</span></div>
              {l.payments.map((pp) => <button key={pp.id} className="tl-row" onClick={() => setEditPay({ loan: l, pay: pp })} aria-label="Edit repayment">{l.direction === "gave" ? `${name} returned` : "You returned"} {money(pp.amount)} <span className="muted">· {prettyDate(pp.paid_on)}{pp.note ? ` · ${pp.note}` : ""} · edit</span></button>)}
              {l.status === "settled" && <div className="ok">Fully settled</div>}
            </div>
            <div className="btn-row">
              {l.outstanding > 0 && <button className="btn small" onClick={() => setRepaying(l)}>{l.direction === "gave" ? "Record money returned" : "Record repayment"}</button>}
              <button className="btn small" onClick={() => setEditing(l)}>Edit loan</button>
            </div>
          </div>
        );
      })}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Add loan"><Icon name="plus" size={26} /></button>
      {adding && <LoanSheet onClose={() => setAdding(false)} />}
      {editing && <EditLoanSheet loan={editing} onClose={() => setEditing(null)} />}
      {editPay && <EditPaySheet loan={editPay.loan} pay={editPay.pay} onClose={() => setEditPay(null)} />}
      {repaying && <RepaySheet loan={repaying} onClose={() => setRepaying(null)} />}
    </>
  );
}

function LoanSheet({ onClose }: { onClose: () => void }) {
  const { people, addPerson, addLoan } = useData();
  const [direction, setDirection] = useState<LoanDirection>("gave");
  const [personId, setPersonId] = useState("");
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr("");
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    if (!personId && !newName.trim()) return setErr("Choose or add a person");
    setBusy(true);
    try {
      const pid = personId || (await addPerson(newName)).id;
      await addLoan({ person_id: pid, direction, amount: amt, note: note.trim(), loan_date: date });
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Sheet title="New loan" onClose={onClose}>
      <div className="seg"><button className={direction === "gave" ? "on" : ""} onClick={() => setDirection("gave")}>I gave</button>
        <button className={direction === "borrowed" ? "on" : ""} onClick={() => setDirection("borrowed")}>I borrowed</button></div>
      <label className="lab">Person</label>
      <select value={personId} onChange={(e) => setPersonId(e.target.value)}><option value="">New person…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      {!personId && <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />}
      <label className="lab">Amount</label>
      <input inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      <label className="lab">Note</label>
      <input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save loan"}</button>
    </Sheet>
  );
}

function RepaySheet({ loan, onClose }: { loan: LoanView; onClose: () => void }) {
  const { addLoanPayment } = useData();
  const [amount, setAmount] = useState(String(loan.outstanding));
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    if (amt > loan.outstanding) return setErr(`Only ${money(loan.outstanding)} is outstanding`);
    setBusy(true);
    try { await addLoanPayment({ loan_id: loan.id, amount: amt, note: note.trim(), paid_on: date }); onClose(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Sheet title={loan.direction === "gave" ? `${loan.person?.name ?? "They"} returned money` : "Record repayment"} onClose={onClose}>
      <p className="hint">The original loan stays in your history. This just adds a repayment entry.</p>
      <p className="hint"><b>{money(loan.amount)}</b> loan · {money(loan.repaid)} returned so far · {money(loan.outstanding)} left</p>
      <label className="lab">Amount (outstanding {money(loan.outstanding)})</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      <label className="lab">Note</label>
      <input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
    </Sheet>
  );
}

function EditLoanSheet({ loan, onClose }: { loan: LoanView; onClose: () => void }) {
  const { updateLoan, deleteLoan } = useData();
  const [amount, setAmount] = useState(String(loan.amount));
  const [note, setNote] = useState(loan.note);
  const [date, setDate] = useState(loan.loan_date);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const name = loan.person?.name ?? "this person";

  async function save() {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    if (amt < loan.repaid) return setErr(`${money(loan.repaid)} has already been returned. The loan can't be smaller than that.`);
    setBusy(true);
    try { await updateLoan(loan.id, { amount: amt, note: note.trim(), loan_date: date }); onClose(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() {
    const n = loan.payments.length;
    if (!confirm(`Delete this ${money(loan.amount)} loan with ${name}${n ? ` and its ${n} ${n === 1 ? "repayment" : "repayments"}` : ""}? This cannot be undone.`)) return;
    setBusy(true);
    try { await deleteLoan(loan.id); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Sheet title="Edit loan" onClose={onClose}>
      <label className="lab">Amount</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      <label className="lab">Note</label>
      <input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      <button className="btn block danger" onClick={remove} disabled={busy}>Delete loan</button>
    </Sheet>
  );
}

function EditPaySheet({ loan, pay, onClose }: { loan: LoanView; pay: LoanPayment; onClose: () => void }) {
  const { updateLoanPayment, deleteLoanPayment } = useData();
  const [amount, setAmount] = useState(String(pay.amount));
  const [note, setNote] = useState(pay.note);
  const [date, setDate] = useState(pay.paid_on);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const room = loan.outstanding + pay.amount;

  async function save() {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    if (amt > room) return setErr(`At most ${money(room)} can be returned on this loan`);
    setBusy(true);
    try { await updateLoanPayment(pay.id, { amount: amt, note: note.trim(), paid_on: date }); onClose(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Delete this ${money(pay.amount)} repayment? The loan goes back to owing ${money(loan.outstanding + pay.amount)}.`)) return;
    setBusy(true);
    try { await deleteLoanPayment(pay.id); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Sheet title="Edit repayment" onClose={onClose}>
      <p className="hint">{money(loan.amount)} loan · this repayment can be at most {money(room)}.</p>
      <label className="lab">Amount</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      <label className="lab">Note</label>
      <input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      <button className="btn block danger" onClick={remove} disabled={busy}>Delete repayment</button>
    </Sheet>
  );
}
