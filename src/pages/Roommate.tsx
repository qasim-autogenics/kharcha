import { useEffect, useMemo, useState } from "react";
import { useData } from "../lib/data";
import { Sheet } from "../components/Sheet";
import { fromISO, inRange, prettyDate, today } from "../lib/dates";
import { usePeriod } from "../lib/period";
import { useNav } from "../lib/nav";
import { PeriodNav } from "../components/PeriodBar";
import { allocate, billStatus, friendBalance, friendOwesMe, iOweFriend, rankCategories, sum, type Bill } from "../lib/calc";
import { money } from "../lib/format";
import { Icon } from "../lib/icons";
import { deletePersonMessage } from "../lib/people";
import type { Expense, PayDirection, Settlement } from "../lib/types";

export function Roommate() {
  const { people, expenses, settlements, loans, allocations, categories, markReimbursed, deletePerson } = useData();
  const [pid, setPid] = useState<string | null>(null);
  const [monthOpen, setMonthOpen] = useState<Record<string, boolean>>({}); // newest month starts open, the rest collapsed
  const [claimsOpen, setClaimsOpen] = useState(false);
  const [paying, setPaying] = useState<PayDirection | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const { intent, clearIntent } = useNav();
  // arriving from a tapped "You owe …" / "… owes you" card: pick that person and open the payment sheet with the amount filled in
  useEffect(() => {
    if (!intent) return;
    setPid(intent.personId); setPayAmount(intent.amount); setPaying(intent.direction); clearIntent();
  }, [intent, clearIntent]);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Settlement | null>(null);

  const { range } = usePeriod();
  const pending = expenses.filter((e) => e.split === "reimbursable" && !e.reimbursed_at);

  // everyone you share bills with, plus the roommate even before the first bill
  const sharing = people.filter((x) => x.is_roommate || expenses.some((e) => e.person_id === x.id) || settlements.some((t) => t.person_id === x.id));
  const person = sharing.find((x) => x.id === pid) ?? sharing.find((x) => x.is_roommate) ?? sharing[0];
  if (!person) return <p className="empty">Add your roommate in <b>Settings → People</b>, then tag expenses as “Split” to track who owes whom.</p>;

  const mine = expenses.filter((e) => e.person_id === person.id && inRange(e.spent_on, range));
  const bal = friendBalance(person.id, expenses, settlements);
  const owedList = mine.filter((e) => friendOwesMe(e) > 0);
  const oweList = mine.filter((e) => iOweFriend(e) > 0);
  const history = settlements.filter((s) => s.person_id === person.id);
  const historyMonths = [...history.reduce((m, x) => m.set(x.paid_on.slice(0, 7), [...(m.get(x.paid_on.slice(0, 7)) ?? []), x]), new Map<string, Settlement[]>())].sort((a, b) => b[0].localeCompare(a[0]));
  // per-bill status: what is settled and what is still open (ticked bills first, then older loose payments, oldest bills first)
  const bills = billStatus(person.id, expenses, settlements, allocations);
  const billOf = new Map(bills.map((b) => [b.expense.id, b]));
  const monthBills = bills.filter((b) => inRange(b.expense.spent_on, range));
  const owedM = sum(monthBills.filter((b) => b.dir === "received").map((b) => b.total));
  const oweM = sum(monthBills.filter((b) => b.dir === "paid").map((b) => b.total));
  const openOwedM = sum(monthBills.filter((b) => b.dir === "received").map((b) => b.open));
  const openOweM = sum(monthBills.filter((b) => b.dir === "paid").map((b) => b.open));
  const netM = openOwedM - openOweM;

  const status = (e: Expense) => {
    const b = billOf.get(e.id);
    if (!b) return null;
    return b.open === 0 ? <span className="chip-ok"> · Settled</span> : b.settled > 0 ? <span className="chip-part"> · {money(b.open)} left</span> : <span className="chip-open"> · Open</span>;
  };

  const group = (list: Expense[], fn: (e: Expense) => number, key: string) => (
    rankCategories(list, categories, fn).map((c) => {
      const items = list.filter((e) => (e.category_id ?? "none") === c.id && fn(e) > 0);
      const k = `${key}-${c.id}`;
      return (
        <div key={k} className="card">
          <button className="row" onClick={() => setOpen(open === k ? null : k)}>
            <span className="dot" style={{ background: c.color }} /><div className="grow"><b>{c.name}</b><small>{c.count} {c.count === 1 ? "entry" : "entries"}</small></div>
            <span className="v serif">{money(c.total)}</span>
            <span className="chev" style={{ transform: open === k ? "rotate(90deg)" : undefined }}><Icon name="chev" size={16} /></span>
          </button>
          {open === k && items.map((e) => (
            <div key={e.id} className="line small"><span>{prettyDate(e.spent_on)} · {e.note || "—"}</span><b>{money(fn(e))}{fn(e) !== e.amount ? <span className="muted"> of {money(e.amount)}</span> : ""}{status(e)}</b></div>
          ))}
        </div>
      );
    })
  );

  return (
    <>
      {pending.length > 0 && (
        <div className="card">
          <button className="row" onClick={() => setClaimsOpen(!claimsOpen)}>
            <div className="grow"><b>Company claims waiting</b><small>Not part of anyone's split</small></div>
            <span className="v serif">{money(sum(pending.map((e) => e.amount)))}</span>
            <span className="chev" style={{ transform: claimsOpen ? "rotate(90deg)" : undefined }}><Icon name="chev" size={16} /></span>
          </button>
          {claimsOpen && pending.map((e) => (
            <div key={e.id} className="line small"><span>{e.note || "Expense"} <span className="muted">· {e.reimbursable_from || "—"} · {prettyDate(e.spent_on)}</span></span>
              <span className="right-actions"><b>{money(e.amount)}</b><button className="btn small" onClick={() => void markReimbursed(e.id, today()).catch((er) => alert(er.message))}>Received</button></span></div>
          ))}
        </div>
      )}
      {sharing.length > 1 && (
        <div className="chips" role="tablist" aria-label="Person">
          {sharing.map((x) => {
            const b = friendBalance(x.id, expenses, settlements).balance;
            return <button key={x.id} role="tab" aria-selected={x.id === person.id} className={`chip ${x.id === person.id ? "on" : ""}`} onClick={() => setPid(x.id)}>
              {x.name}{b !== 0 && <small className={b > 0 ? "pos" : "neg"}> {b > 0 ? "+" : "−"}{money(Math.abs(b))}</small>}</button>;
          })}
        </div>
      )}
      <div className="card hero-card">
        <span className="lab">{bal.balance > 0 ? `${person.name} owes you` : bal.balance < 0 ? `You owe ${person.name}` : `All settled with ${person.name}`}</span>
        <b className={`big serif ${bal.balance > 0 ? "pos" : bal.balance < 0 ? "neg" : ""}`}>{money(Math.abs(bal.balance))}</b>
        <span className="muted small">Owed to you {money(bal.owedToMe)} · you owe {money(bal.iOwe)}</span>
        <span className="muted small">Paid to you {money(bal.received)} · you paid {money(bal.paidToFriend)}</span>
        <div className="btn-row">
          <button className="btn primary" onClick={() => { setPayAmount(0); setPaying("received"); }}>{person.name} paid me</button>
          <button className="btn" onClick={() => { setPayAmount(0); setPaying("paid"); }}>I paid {person.name}</button>
        </div>
      </div>

      <PeriodNav />

      <div className="two">
        <div className="card center"><span className="lab">{netM >= 0 ? `${person.name} still owes` : "You still owe"}</span>
          <b className={`serif ${netM > 0 ? "pos" : netM < 0 ? "neg" : ""}`}>{money(Math.abs(netM))}</b>
          <span className="muted small">{netM === 0 && (owedM > 0 || oweM > 0) ? "All settled in this period" : "this period, still open"}</span></div>
        <div className="card center"><span className="lab">{person.name} paid back</span><b className="serif">{money(owedM - openOwedM)}</b>
          <span className="muted small">of {money(owedM)} he owed you</span></div>
      </div>

      <div className="lab section">{person.name}'s share of what you paid</div>
      {owedList.length === 0 ? <p className="empty small">None in this period.</p> : group(owedList, friendOwesMe, "owed")}
      <div className="lab section">Your share of what {person.name} paid</div>
      {oweList.length === 0 ? <p className="empty small">None in this period.</p> : group(oweList, iOweFriend, "owe")}

      <div className="lab section">Payments between you and {person.name}</div>
      {history.length === 0 && <p className="empty small">No payments recorded yet.</p>}
      {historyMonths.map(([key, list], i) => {
        const net = sum(list.map((x) => (x.direction === "received" ? x.amount : -x.amount)));
        const isOpen = monthOpen[key] ?? i === 0;
        return (
          <div key={key} className="card">
            <button className="row" onClick={() => setMonthOpen({ ...monthOpen, [key]: !isOpen })}>
              <div className="grow"><b>{monthName(key)}</b><small>{list.length} {list.length === 1 ? "payment" : "payments"}</small></div>
              <span className={`v serif ${net >= 0 ? "pos" : "neg"}`}>{net >= 0 ? "+" : "−"}{money(Math.abs(net))}</span>
              <span className="chev" style={{ transform: isOpen ? "rotate(90deg)" : undefined }}><Icon name="chev" size={16} /></span>
            </button>
            {isOpen && list.map((s) => (
              <button key={s.id} className="line small tl-card" onClick={() => setEditing(s)} aria-label="Edit payment"><span>{prettyDate(s.paid_on)} · {s.direction === "received" ? `${person.name} paid you` : `You paid ${person.name}`}{s.note ? ` · ${s.note}` : ""}</span>
                <b className={s.direction === "received" ? "pos" : "neg"}>{s.direction === "received" ? "+" : "−"}{money(s.amount)}</b></button>
            ))}
          </div>
        );
      })}
      {history.length > 0 && <p className="hint">Tap a payment to correct or delete it.</p>}
      <button className="btn danger block" onClick={() => { if (confirm(deletePersonMessage(person, expenses, settlements, loans))) { setPid(null); void deletePerson(person.id).catch((er) => alert(er.message)); } }}>Delete {person.name}</button>

      {editing && <EditPaymentSheet pay={editing} name={person.name} onClose={() => setEditing(null)} />}
      {paying && <PaySheet direction={paying} initialAmount={payAmount} bills={bills} personId={person.id} name={person.name} onClose={() => setPaying(null)} />}
    </>
  );
}

const monthName = (key: string) => fromISO(`${key}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

/** Record a payment and say which bills it settles: tick bills, tick a whole month, or just type an amount (oldest bills first). */
function PaySheet({ direction, initialAmount, bills, personId, name, onClose }: { direction: PayDirection; initialAmount: number; bills: Bill[]; personId: string; name: string; onClose: () => void }) {
  const { addSettlement } = useData();
  const [dir, setDir] = useState<PayDirection>(direction);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState(initialAmount > 0 ? String(Math.round(initialAmount * 100) / 100) : "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const open = useMemo(() => bills.filter((b) => b.dir === dir && b.open > 0).sort((a, b) => a.expense.spent_on.localeCompare(b.expense.spent_on)), [bills, dir]);
  const months = useMemo(() => {
    const m = new Map<string, Bill[]>();
    for (const b of open) m.set(b.expense.spent_on.slice(0, 7), [...(m.get(b.expense.spent_on.slice(0, 7)) ?? []), b]);
    return [...m.entries()];
  }, [open]);

  const pool = picked.size ? open.filter((b) => picked.has(b.expense.id)) : open;
  const amt = Number(amount) || 0;
  const { allocs, extra } = allocate(amt, pool);
  const openOf = (id: string) => open.find((b) => b.expense.id === id)?.open ?? 0;
  const fully = allocs.filter((a) => a.amount >= openOf(a.expense_id) - 0.005).length;
  const partly = allocs.length - fully;

  const pick = (next: Set<string>) => {
    setPicked(next);
    const t = sum(open.filter((b) => next.has(b.expense.id)).map((b) => b.open));
    setAmount(next.size ? String(Math.round(t * 100) / 100) : "");
  };
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); pick(n); };
  const toggleMonth = (list: Bill[]) => {
    const n = new Set(picked);
    const all = list.every((b) => n.has(b.expense.id));
    list.forEach((b) => (all ? n.delete(b.expense.id) : n.add(b.expense.id)));
    pick(n);
  };
  const switchDir = (d: PayDirection) => { setDir(d); setPicked(new Set()); setAmount(""); };

  async function save() {
    if (!(amt > 0)) return setErr("Enter an amount, or tick the bills this payment covers");
    setBusy(true);
    try { await addSettlement({ person_id: personId, amount: amt, note: note.trim(), paid_on: date, direction: dir }, allocs); onClose(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Sheet title="Record a payment" onClose={onClose}>
      <div className="seg"><button className={dir === "received" ? "on" : ""} onClick={() => switchDir("received")}>{name} paid me</button>
        <button className={dir === "paid" ? "on" : ""} onClick={() => switchDir("paid")}>I paid {name}</button></div>

      <label className="lab">Which bills? <span className="muted small">Tick bills or a whole month, or skip and just type an amount.</span></label>
      {months.length === 0 && <p className="empty small">No open bills in this direction.</p>}
      {months.map(([key, list]) => {
        const allOn = list.every((b) => picked.has(b.expense.id));
        return (
          <div key={key} className="card payset">
            <div className="line"><span><b>{monthName(key)}</b> <span className="muted small">· {money(sum(list.map((b) => b.open)))} open</span></span>
              <button className="btn small" onClick={() => toggleMonth(list)}>{allOn ? "Unselect month" : "Select month"}</button></div>
            {list.map((b) => (
              <label key={b.expense.id} className="line small bill-pick">
                <span><input type="checkbox" checked={picked.has(b.expense.id)} onChange={() => toggle(b.expense.id)} /><span>{prettyDate(b.expense.spent_on)} · {b.expense.note || "—"}</span></span>
                <b>{money(b.open)}{b.settled > 0 ? <span className="muted"> of {money(b.total)}</span> : ""}</b>
              </label>
            ))}
          </div>
        );
      })}

      <label className="lab">Amount paid</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 250" />
      {amt > 0 && (
        <p className="hint">
          {allocs.length === 0 ? "Not tied to any bill." : `Settles ${fully} ${fully === 1 ? "bill" : "bills"}${partly ? ` and part of ${partly} more` : ""}, oldest first${picked.size ? " among the ticked ones" : ""}.`}
          {extra > 0 ? ` ${money(extra)} is extra and stays as a general payment.` : ""}
        </p>
      )}
      <label className="lab">Note</label>
      <input placeholder="e.g. October settlement" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save payment"}</button>
    </Sheet>
  );
}

function EditPaymentSheet({ pay, name, onClose }: { pay: Settlement; name: string; onClose: () => void }) {
  const { updateSettlement, deleteSettlement } = useData();
  const [dir, setDir] = useState<PayDirection>(pay.direction);
  const [amount, setAmount] = useState(String(pay.amount));
  const [note, setNote] = useState(pay.note);
  const [date, setDate] = useState(pay.paid_on);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    setBusy(true);
    try { await updateSettlement(pay.id, { amount: amt, note: note.trim(), paid_on: date, direction: dir }); onClose(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Delete this ${money(pay.amount)} payment? The bills it settled become open again.`)) return;
    setBusy(true);
    try { await deleteSettlement(pay.id); onClose(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Sheet title="Edit payment" onClose={onClose}>
      <div className="seg"><button className={dir === "received" ? "on" : ""} onClick={() => setDir("received")}>{name} paid me</button>
        <button className={dir === "paid" ? "on" : ""} onClick={() => setDir("paid")}>I paid {name}</button></div>
      <label className="lab">Amount</label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      <label className="lab">Note</label>
      <input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <p className="hint">If you change the amount or direction, the bills this payment was ticked against are released and it is applied to the oldest open bills.</p>
      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      <button className="btn block danger" onClick={remove} disabled={busy}>Delete payment</button>
    </Sheet>
  );
}
