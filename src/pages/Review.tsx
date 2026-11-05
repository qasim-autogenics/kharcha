import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../lib/data";
import { Icon } from "../lib/icons";
import { ExpenseSheet } from "../components/ExpenseSheet";
import { APP } from "../lib/config";
import { suggest } from "../lib/monefy";
import { money, round2 } from "../lib/format";
import { prettyDate } from "../lib/dates";
import type { Expense, ExpenseInput } from "../lib/types";

const PRESETS = [25, 33, 50, 67, 75];
type Mode = null | "split" | "claim";

const toInput = (e: Expense, patch: Partial<ExpenseInput>): ExpenseInput => {
  const { id: _id, created_at: _c, ...rest } = e;
  return { ...rest, ...patch, reviewed: true };
};

/** Go through imported entries one at a time and say what each really was. */
export function Review({ onBack }: { onBack: () => void }) {
  const { expenses, categories, people, roommate, saveExpense, markReviewed, addSettlement } = useData();
  const pending = useMemo(() => expenses.filter((e) => !e.reviewed).sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at)), [expenses]);
  const initial = useRef(pending.length);
  const [skipped, setSkipped] = useState<string[]>([]);
  const queue = useMemo(() => [...pending.filter((e) => !skipped.includes(e.id)), ...pending.filter((e) => skipped.includes(e.id))], [pending, skipped]);
  const cur = queue[0];

  const [mode, setMode] = useState<Mode>(null);
  const [personId, setPersonId] = useState<string>(roommate?.id ?? "");
  const [pct, setPct] = useState<number>(APP.DEFAULT_SPLIT_PERCENT);
  const [share, setShare] = useState("");
  const [from, setFrom] = useState<string>(APP.DEFAULT_REIMBURSABLE_FROM);
  const [repaid, setRepaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => { setMode(null); setShare(""); setPct(APP.DEFAULT_SPLIT_PERCENT); setRepaid(false); setErr(""); }, [cur?.id]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  const done = initial.current - pending.length;
  if (!cur) {
    return (
      <>
        <div className="top"><button className="back" onClick={onBack}><span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chev" size={20} /></span> Home</button></div>
        <div className="card center" style={{ marginTop: 20 }}><span className="lab">All reviewed</span><b className="serif pos">Nothing left to sort out</b></div>
        <button className="btn primary block" onClick={onBack}>Back to Home</button>
      </>
    );
  }

  const cat = categories.find((c) => c.id === cur.category_id)?.name ?? "Uncategorized";
  const hint = suggest(cur.note);
  const shareAmt = share !== "" ? Number(share) : round2((cur.amount * pct) / 100);
  const friend = people.find((p) => p.id === personId);

  const savePersonal = () => act(() => markReviewed([cur.id]));
  const saveSplit = () => act(async () => {
    if (!personId) throw new Error("Choose who it was split with");
    if (!(shareAmt >= 0 && shareAmt <= cur.amount)) throw new Error("That share can't be more than the bill");
    await saveExpense(toInput(cur, { split: "split", paid_by: "me", person_id: personId, friend_share: shareAmt }), cur.id);
    if (repaid && shareAmt > 0) await addSettlement({ person_id: personId, amount: shareAmt, note: `Repaid: ${cur.note}`.slice(0, 80), paid_on: cur.spent_on, direction: "received" });
  });
  const saveClaim = () => act(() => saveExpense(toInput(cur, { split: "reimbursable", paid_by: "me", person_id: null, friend_share: 0, reimbursable_from: from.trim(), reimbursed_at: repaid ? cur.spent_on : null }), cur.id));
  const skip = () => setSkipped((s) => [...s.filter((x) => x !== cur.id), cur.id]);
  const allPersonal = () => { if (confirm(`Mark all ${pending.length} remaining entries as personal?`)) void act(() => markReviewed(pending.map((e) => e.id))); };

  return (
    <>
      <div className="top"><button className="back" onClick={onBack}><span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chev" size={20} /></span> Home</button>
        <button className="link" onClick={allPersonal}>Rest are personal</button></div>
      <div className="lab" style={{ marginTop: 6 }}>Review · {done} of {initial.current} done</div>
      <div className="bar"><i style={{ width: `${(done / Math.max(1, initial.current)) * 100}%` }} /></div>

      <div className="card rv">
        <span className="muted small">{prettyDate(cur.spent_on)} · {cat}</span>
        <b className="big serif">{money(cur.amount)}</b>
        <span className="rv-note">{cur.note || "(no note)"}</span>
        {hint && <span className="pill alt">Looks like a {hint.kind === "claim" ? "company claim" : "split"}: {hint.why}</span>}
      </div>

      {mode === null && (
        <div className="rv-actions">
          <button className="btn primary block" disabled={busy} onClick={savePersonal}><Icon name="check" size={16} /> Personal, all mine</button>
          <div className="btn-row">
            <button className="btn" onClick={() => setMode("split")}>Split with…</button>
            <button className="btn" onClick={() => setMode("claim")}>Company claim</button>
          </div>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setEditing(true)}><Icon name="edit" size={15} /> Full editor</button>
            <button className="btn ghost" onClick={skip}>Skip for now</button>
          </div>
        </div>
      )}

      {mode === "split" && (
        <div className="panel">
          {people.length === 0 ? <p className="hint">Add your roommate or friend in Settings → People first.</p> : (
            <>
              <select value={personId} onChange={(e) => setPersonId(e.target.value)} aria-label="Friend">
                <option value="">Choose who…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_roommate ? " (roommate)" : ""}</option>)}
              </select>
              <label className="lab">{friend?.name ?? "Their"} share</label>
              <div className="chips">{PRESETS.map((p) => <button key={p} className={`chip ${share === "" && pct === p ? "on" : ""}`} onClick={() => { setShare(""); setPct(p); }}>{p}%</button>)}</div>
              <input inputMode="decimal" value={share} placeholder={String(round2((cur.amount * pct) / 100))} onChange={(e) => setShare(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Share amount" />
              <label className="check"><input type="checkbox" checked={repaid} onChange={(e) => setRepaid(e.target.checked)} /> {friend?.name ?? "They"} already paid me {money(shareAmt)}</label>
            </>
          )}
          <div className="btn-row"><button className="btn" onClick={() => setMode(null)}>Back</button>
            <button className="btn primary" disabled={busy || people.length === 0} onClick={saveSplit}>Save split</button></div>
        </div>
      )}

      {mode === "claim" && (
        <div className="panel">
          <label className="lab">Who pays you back?</label>
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Company, client…" />
          <label className="check"><input type="checkbox" checked={repaid} onChange={(e) => setRepaid(e.target.checked)} /> Already received</label>
          <div className="btn-row"><button className="btn" onClick={() => setMode(null)}>Back</button>
            <button className="btn primary" disabled={busy} onClick={saveClaim}>Save claim</button></div>
        </div>
      )}

      {err && <p className="error">{err}</p>}
      {pending.length > 1 && <p className="hint">Next: {queue[1].note || "(no note)"} · {money(queue[1].amount)}</p>}
      {editing && <ExpenseSheet existing={cur} onClose={() => setEditing(false)} />}
    </>
  );
}
