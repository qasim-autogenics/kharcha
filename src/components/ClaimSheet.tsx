import { useState } from "react";
import { useData } from "../lib/data";
import { Sheet } from "./Sheet";
import { ExpenseSheet } from "./ExpenseSheet";
import { claimLeft, claimParts, claimReceived } from "../lib/calc";
import { prettyDate, today } from "../lib/dates";
import { money } from "../lib/format";
import { Icon } from "../lib/icons";
import type { ClaimPayment } from "../lib/types";

/** One company claim: see what came back (in as many parts as you like), add, correct or delete a part, edit or delete the claim itself. */
export function ClaimSheet({ expenseId, onClose }: { expenseId: string; onClose: () => void }) {
  const { expenses, claimPayments, deleteExpense, markReimbursed } = useData();
  const e = expenses.find((x) => x.id === expenseId);
  const [part, setPart] = useState<null | "new" | ClaimPayment>(null);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!e) return null;

  const parts = claimParts(e, claimPayments);
  const received = claimReceived(e, claimPayments);
  const left = claimLeft(e, claimPayments);
  const legacyReceived = parts.length === 0 && !!e.reimbursed_at; // marked received before parts existed

  async function remove() {
    if (!e || !confirm(`Delete this claim (${money(e.amount)})? ${parts.length ? "Its received payments are deleted too." : ""}`)) return;
    setBusy(true);
    try { await deleteExpense(e.id); onClose(); } catch (er) { setErr((er as Error).message); setBusy(false); }
  }
  async function unreceive() {
    if (!e) return;
    setBusy(true);
    try { await markReimbursed(e.id, null); } catch (er) { setErr((er as Error).message); }
    setBusy(false);
  }

  return (
    <Sheet title="Company claim" onClose={onClose}>
      <div className="card">
        <div className="line"><span><b>{e.note || "Expense"}</b><br /><small className="muted">{e.reimbursable_from || "—"} · {prettyDate(e.spent_on)}</small></span><b>{money(e.amount)}</b></div>
        <div className="line"><span>Received so far</span><b className="pos">{money(received)}</b></div>
        <div className="line"><span><b>Still to come</b></span><b className={left > 0 ? "neg" : "pos"}>{left > 0 ? money(left) : "All paid back"}</b></div>
      </div>

      {parts.length > 0 && <div className="lab section">Received</div>}
      {parts.map((p) => (
        <button key={p.id} className="line small tl-card" onClick={() => setPart(p)} aria-label="Edit received amount">
          <span>{prettyDate(p.received_on)}{p.note ? ` · ${p.note}` : ""}</span><b className="pos">+{money(p.amount)}</b></button>
      ))}
      {parts.length > 0 && <p className="hint">Tap a received amount to correct or delete it.</p>}

      {legacyReceived && (
        <div className="card"><div className="line small"><span>Marked as received on {prettyDate(e.reimbursed_at!)}</span>
          <button className="btn small" disabled={busy} onClick={() => void unreceive()}>Mark as not received</button></div></div>
      )}

      {part === null && !legacyReceived && (
        <button className="btn primary block" onClick={() => setPart("new")}><Icon name="plus" size={16} /> {left > 0 ? "Record money received" : "Add another amount"}</button>
      )}
      {part !== null && <PartForm key={part === "new" ? "new" : part.id} expenseId={e.id} existing={part === "new" ? undefined : part} suggested={left} onDone={() => setPart(null)} />}

      {err && <p className="error">{err}</p>}
      <div className="btn-row">
        <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit claim</button>
        <button className="btn danger" disabled={busy} onClick={() => void remove()}><Icon name="trash" size={16} /> Delete claim</button>
      </div>
      {editing && <ExpenseSheet existing={e} onClose={() => setEditing(false)} />}
    </Sheet>
  );
}

function PartForm({ expenseId, existing, suggested, onDone }: { expenseId: string; existing?: ClaimPayment; suggested: number; onDone: () => void }) {
  const { addClaimPayment, updateClaimPayment, deleteClaimPayment } = useData();
  const [amount, setAmount] = useState(existing ? String(existing.amount) : suggested > 0 ? String(Math.round(suggested * 100) / 100) : "");
  const [date, setDate] = useState(existing?.received_on ?? today());
  const [note, setNote] = useState(existing?.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    setBusy(true);
    try {
      const v = { amount: amt, note: note.trim(), received_on: date };
      if (existing) await updateClaimPayment(existing.id, v); else await addClaimPayment(expenseId, v);
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!existing || !confirm(`Delete this ${money(existing.amount)} received amount? The claim becomes unpaid by that much.`)) return;
    setBusy(true);
    try { await deleteClaimPayment(existing.id); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="card">
      <div className="lab">{existing ? "Edit received amount" : "Money received"}</div>
      <input inputMode="decimal" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Amount received" />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="lab">Note</label>
      <input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <p className="error">{err}</p>}
      <div className="btn-row">
        <button className="btn" onClick={onDone} disabled={busy}>Cancel</button>
        <button className="btn primary" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {existing && <button className="btn ghost danger block" disabled={busy} onClick={() => void remove()}><Icon name="trash" size={16} /> Delete this amount</button>}
    </div>
  );
}
