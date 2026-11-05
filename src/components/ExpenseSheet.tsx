import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { Icon } from "../lib/icons";
import { useData } from "../lib/data";
import { APP } from "../lib/config";
import { getPref, setPref } from "../lib/prefs";
import { money, round2 } from "../lib/format";
import { today } from "../lib/dates";
import type { Expense, ExpenseInput, PaidBy } from "../lib/types";

type Mode = "personal" | "split" | "all" | "claim";
const PRESETS = [25, 33, 50, 67, 75];

function initialMode(e?: Expense): Mode {
  if (!e) return "personal";
  if (e.split === "reimbursable") return "claim";
  if (e.split === "personal") return "personal";
  if (e.split === "owed_by_friend") return "all";
  return e.paid_by === "friend" && e.friend_share === 0 ? "all" : "split";
}

export function ExpenseSheet({ existing, defaultCategoryId, onClose }: { existing?: Expense; defaultCategoryId?: string; onClose: () => void }) {
  const { categories, people, roommate, expenses, targets, saveExpense, deleteExpense, addPerson, addCategory, addTarget } = useData();
  const active = useMemo(() => categories.filter((c) => !c.archived || c.id === existing?.category_id), [categories, existing]);
  const recent = useMemo(() => {
    const ids: string[] = [];
    for (const e of expenses) { if (e.category_id && !ids.includes(e.category_id)) ids.push(e.category_id); if (ids.length === 3) break; }
    return ids.map((id) => active.find((c) => c.id === id)).filter(Boolean) as typeof active;
  }, [expenses, active]);

  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? defaultCategoryId ?? null);
  const [note, setNote] = useState(existing?.note ?? "");
  const [date, setDate] = useState(existing?.spent_on ?? today());
  const [paidBy, setPaidBy] = useState<PaidBy>(existing?.paid_by ?? "me");
  const [targetId, setTargetId] = useState<string | null>(() => existing ? existing.target_id : (getPref<string>("target", "") || targets[0]?.id || null));
  const [newTarget, setNewTarget] = useState("");
  const [mode, setMode] = useState<Mode>(initialMode(existing));
  const [personId, setPersonId] = useState<string | null>(existing?.person_id ?? roommate?.id ?? null);
  const [share, setShare] = useState(() => {
    if (!existing || existing.split !== "split") return "";
    return String(existing.paid_by === "friend" ? round2(existing.amount - existing.friend_share) : existing.friend_share);
  });
  const [from, setFrom] = useState(existing?.reimbursable_from || APP.DEFAULT_REIMBURSABLE_FROM);
  const [newFriend, setNewFriend] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const amt = Number(amount) || 0;
  const friendName = people.find((p) => p.id === personId)?.name ?? "friend";
  const needsFriend = mode === "split" || mode === "all";
  const friendPaid = paidBy === "friend";

  const modes: { id: Mode; label: string }[] = friendPaid
    ? [{ id: "split", label: "Split" }, { id: "all", label: "I owe all" }]
    : [{ id: "personal", label: "Personal" }, { id: "split", label: "Split" }, { id: "all", label: "Friend owes all" }, { id: "claim", label: "Company claim" }];

  function pickPaidBy(p: PaidBy) {
    setPaidBy(p);
    if (p === "friend" && (mode === "personal" || mode === "claim")) setMode("split");
  }

  // "the number you type" = my share when the friend paid, the friend's share when I paid
  const typed = share === "" ? round2((amt * APP.DEFAULT_SPLIT_PERCENT) / 100) : Number(share);
  const friendShare = mode === "all" ? (friendPaid ? 0 : amt) : mode === "split" ? (friendPaid ? round2(amt - typed) : typed) : 0;
  const myShare = mode === "claim" ? 0 : round2(amt - friendShare);
  const youOwe = friendPaid ? myShare : 0;
  const friendOwes = !friendPaid ? friendShare : 0;

  const filtered = active.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const exact = active.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());

  async function submit() {
    setErr("");
    if (!(amt > 0)) return setErr("Enter an amount greater than 0");
    if (needsFriend && !personId) return setErr("Choose who this is split with");
    if (mode === "split" && (typed < 0 || typed > amt)) return setErr("That share can't be more than the bill");
    setBusy(true);
    try {
      const input: ExpenseInput = {
        amount: amt, category_id: categoryId, note: note.trim(), spent_on: date, paid_by: paidBy, target_id: targetId,
        split: mode === "personal" ? "personal" : mode === "claim" ? "reimbursable" : mode === "all" && !friendPaid ? "owed_by_friend" : "split",
        person_id: needsFriend ? personId : null,
        friend_share: needsFriend ? round2(friendShare) : 0,
        reimbursable_from: mode === "claim" ? from.trim() : "",
        reimbursed_at: mode === "claim" ? existing?.reimbursed_at ?? null : null, reviewed: true,
      };
      await saveExpense(input, existing?.id);
      if (targetId) setPref("target", targetId);
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  async function createFriend() {
    if (!newFriend.trim()) return;
    try { const p = await addPerson(newFriend); setPersonId(p.id); setNewFriend(""); } catch (e) { setErr((e as Error).message); }
  }
  async function createCategory() {
    try { const c = await addCategory(query, "tag"); setCategoryId(c.id); setQuery(""); } catch (e) { setErr((e as Error).message); }
  }
  async function remove() {
    if (!existing || !confirm("Delete this expense?")) return;
    try { await deleteExpense(existing.id); onClose(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <Sheet title={existing ? "Edit expense" : "Add expense"} onClose={onClose}>
      <div className="amount-wrap">
        <span>{APP.CURRENCY_LABEL}</span>
        <input className="amount serif" inputMode="decimal" autoFocus placeholder="0" value={amount} aria-label="Amount"
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
      </div>

      <label className="lab">Spent for</label>
      <div className="chips">
        {targets.map((t) => <button key={t.id} className={`chip ${targetId === t.id ? "on" : ""}`} onClick={() => setTargetId(t.id)}>{t.name}</button>)}
        <span className="chip add"><input placeholder="+ New" value={newTarget} onChange={(e) => setNewTarget(e.target.value)}
          onKeyDown={async (e) => { if (e.key === "Enter" && newTarget.trim()) { e.preventDefault(); try { const t = await addTarget(newTarget); setTargetId(t.id); setNewTarget(""); } catch (er) { setErr((er as Error).message); } } }} /></span>
      </div>

      <label className="lab">Who paid?</label>
      <div className="seg"><button className={!friendPaid ? "on" : ""} onClick={() => pickPaidBy("me")}>I paid</button>
        <button className={friendPaid ? "on" : ""} onClick={() => pickPaidBy("friend")}>{friendName === "friend" ? "Friend" : friendName} paid</button></div>

      <label className="lab">How to divide</label>
      <div className="seg">{modes.map((m) => <button key={m.id} className={mode === m.id ? "on" : ""} onClick={() => setMode(m.id)}>{m.label}</button>)}</div>

      {needsFriend && (
        <div className="panel">
          <select value={personId ?? ""} onChange={(e) => setPersonId(e.target.value || null)} aria-label="Friend">
            <option value="">Choose friend…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_roommate ? " (roommate)" : ""}</option>)}
          </select>
          <div className="row-gap"><input placeholder="Or add a new person" value={newFriend} onChange={(e) => setNewFriend(e.target.value)} />
            <button className="btn small" onClick={createFriend} disabled={!newFriend.trim()}>Add</button></div>
          {mode === "split" && (
            <>
              <label className="lab">{friendPaid ? "My share" : `${friendName}'s share`} ({APP.CURRENCY_LABEL})</label>
              <div className="chips">{PRESETS.map((p) => <button key={p} className="chip" disabled={!amt} onClick={() => setShare(String(round2((amt * p) / 100)))}>{p}%</button>)}</div>
              <input inputMode="decimal" value={share} placeholder={String(round2((amt * APP.DEFAULT_SPLIT_PERCENT) / 100))}
                onChange={(e) => setShare(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Share" />
            </>
          )}
        </div>
      )}

      {mode === "claim" && (
        <div className="panel">
          <label className="lab">Who will pay you back?</label>
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Company, client…" />
          <p className="hint">Not counted as your spending. It stays under “Waiting to be reimbursed” until you mark it received.</p>
        </div>
      )}

      {amt > 0 && (
        <div className="card tight">
          <div className="line"><span>Total bill</span><b>{money(amt)}</b></div>
          <div className="line"><span>My share{mode === "claim" ? " (claim, not counted)" : ""}</span><b>{money(myShare)}</b></div>
          {friendOwes > 0 && <div className="line"><span>{friendName} owes me</span><b className="pos">{money(friendOwes)}</b></div>}
          {youOwe > 0 && <div className="line"><span>I owe {friendName}</span><b className="neg">{money(youOwe)}</b></div>}
        </div>
      )}

      <label className="lab">Category</label>
      {recent.length > 0 && !query && (
        <div className="chips">{recent.map((c) => (
          <button key={c.id} className={`chip ${categoryId === c.id ? "on" : ""}`} onClick={() => setCategoryId(c.id)}><Icon name={c.icon} size={14} /> {c.name}</button>))}</div>
      )}
      <input placeholder="Search or add a category…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search categories" />
      <div className="picker">
        {filtered.map((c) => (
          <button key={c.id} className={`pick ${categoryId === c.id ? "on" : ""}`} onClick={() => setCategoryId(c.id)}>
            <Icon name={c.icon} size={16} /><span>{c.name}</span>{categoryId === c.id && <Icon name="check" size={16} />}
          </button>
        ))}
        {query.trim() && !exact && <button className="pick add" onClick={createCategory}><Icon name="plus" size={16} /><span>Add “{query.trim()}”</span></button>}
        {filtered.length === 0 && !query.trim() && <div className="hint" style={{ padding: 10 }}>No categories yet.</div>}
      </div>

      <label className="lab">Note</label>
      <input placeholder="e.g. Dinner at Monal" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="lab">Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={submit} disabled={busy}>{busy ? "Saving…" : existing ? "Save changes" : "Save expense"}</button>
      {existing && <button className="btn ghost danger block" onClick={remove}><Icon name="trash" size={16} /> Delete expense</button>}
    </Sheet>
  );
}
