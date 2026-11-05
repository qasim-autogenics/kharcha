import { useState } from "react";
import { useData } from "../lib/data";
import { supabase } from "../lib/supabase";
import { useTheme, type ThemePref } from "../lib/theme";
import { Icon, CATEGORY_ICON_KEYS } from "../lib/icons";
import { CHART_VIEWS, DEFAULT_CHART_VIEW, type ChartView } from "../lib/config";
import { getPref, setPref } from "../lib/prefs";
import { Sheet } from "../components/Sheet";
import { ImportSheet } from "../components/ImportSheet";

const THEMES: { id: ThemePref; label: string; icon: string }[] = [
  { id: "light", label: "Light", icon: "sun" }, { id: "dark", label: "Dark", icon: "moon" }, { id: "auto", label: "Auto", icon: "gear" },
];
const VIEWS = CHART_VIEWS.map((v) => v.id) as readonly ChartView[];

export function Settings({ email }: { email?: string }) {
  const { openingBalance, setOpeningBalance, budget, setBudget, targets, addTarget, removeTarget, people, categories, expenses, loans, settlements, addPerson, setRoommate, addCategory, archiveCategory, deleteCategory } = useData();
  const theme = useTheme();
  const [view, setView] = useState<ChartView>(() => getPref<ChartView>("homeView", DEFAULT_CHART_VIEW, VIEWS));
  const [name, setName] = useState("");
  const [cat, setCat] = useState("");
  const [icon, setIcon] = useState("tag");
  const [err, setErr] = useState("");
  const [tname, setTname] = useState("");
  const [bud, setBud] = useState(budget ? String(budget) : "");
  const [ob, setOb] = useState(openingBalance ? String(openingBalance) : "");
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);

  const guard = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } };

  function exportCsv() {
    const cname = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
    const pname = (id: string | null) => people.find((p) => p.id === id)?.name ?? "";
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["date", "amount", "category", "note", "split", "paid_by", "spent_for", "friend", "friend_share", "reimbursable_from", "reimbursed_at"],
      ...expenses.map((e) => [e.spent_on, e.amount, cname(e.category_id), e.note, e.split, e.paid_by, targets.find((t) => t.id === e.target_id)?.name ?? "Myself", pname(e.person_id), e.friend_share, e.reimbursable_from, e.reimbursed_at ?? ""])];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "kharcha-expenses.csv"; a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="lab">Appearance</div>
      <div className="seg">{THEMES.map((t) => <button key={t.id} className={theme.pref === t.id ? "on" : ""} onClick={() => theme.set(t.id)}><Icon name={t.icon} size={16} /> {t.label}</button>)}</div>
      <div className="lab section">Home chart</div>
      <div className="seg">{CHART_VIEWS.map((v) => <button key={v.id} className={view === v.id ? "on" : ""} onClick={() => { setView(v.id); setPref("homeView", v.id); }}>{v.label}</button>)}</div>

      <div className="lab section">Starting balance</div>
      <p className="hint">Money you already had when you started using Kharcha (optional). It is the starting point of your account balance.</p>
      <div className="row-gap"><input inputMode="decimal" placeholder="e.g. 40000" value={ob} onChange={(e) => setOb(e.target.value.replace(/[^0-9.-]/g, ""))} aria-label="Starting balance" />
        <button className="btn small" onClick={() => void guard(() => setOpeningBalance(Number(ob) || 0))}>{openingBalance ? "Update" : "Set"}</button></div>

      <div className="lab section">Monthly budget</div>
      <div className="row-gap"><input inputMode="decimal" placeholder="e.g. 120000" value={bud} onChange={(e) => setBud(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Monthly budget" />
        <button className="btn small" onClick={() => void guard(() => setBudget(Number(bud) > 0 ? Number(bud) : null))}>{budget ? "Update" : "Set"}</button></div>
      <p className="hint">Home shows how much you saved or went over, based on your real cost each month. Leave empty and tap Update to remove it.</p>

      <div className="lab section">Spent for</div>
      <div className="chips">{targets.map((t) => (
        <span key={t.id} className="chip on" style={{ cursor: "default" }}>{t.name}
          <button aria-label={`Remove ${t.name}`} style={{ marginLeft: 4, opacity: .8 }} onClick={() => { if (confirm(`Remove "${t.name}"? Its expenses will count as Myself.`)) void guard(() => removeTarget(t.id)); }}>✕</button></span>))}</div>
      <div className="row-gap"><input placeholder="e.g. Wife, Parents" value={tname} onChange={(e) => setTname(e.target.value)} />
        <button className="btn small" disabled={!tname.trim()} onClick={() => void guard(async () => { await addTarget(tname); setTname(""); })}>Add</button></div>

      <div className="lab section">People</div>
      <div className="card list">
        {people.length === 0 && <div className="row"><div className="grow"><small>No people yet.</small></div></div>}
        {people.map((p) => (
          <div key={p.id} className="row static">
            <Icon name="user" size={18} /><div className="grow"><b>{p.name}</b>{p.is_roommate && <small>Roommate</small>}</div>
            {!p.is_roommate && <button className="btn small" onClick={() => void guard(() => setRoommate(p.id))}>Make roommate</button>}
          </div>
        ))}
      </div>
      <div className="row-gap"><input placeholder="Add a person" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn small" disabled={!name.trim()} onClick={() => void guard(async () => { await addPerson(name, people.length === 0); setName(""); })}>Add</button></div>

      <div className="lab section">Categories · {categories.length}</div>
      <div className="card list">
        {categories.map((c) => (
          <div key={c.id} className="row static">
            <Icon name={c.icon} size={18} /><div className="grow"><b style={c.archived ? { opacity: 0.5 } : undefined}>{c.name}</b>{c.archived && <small>Hidden</small>}</div>
            <button className="btn small" onClick={() => void guard(() => archiveCategory(c.id, !c.archived))}>{c.archived ? "Show" : "Hide"}</button>
            <button className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => { const n = expenses.filter((e) => e.category_id === c.id).length; if (confirm(n ? `Delete "${c.name}"? Its ${n} ${n === 1 ? "entry" : "entries"} will stay but show as Uncategorized.` : `Delete "${c.name}"?`)) void guard(() => deleteCategory(c.id)); }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
      <div className="row-gap">
        <button className="icon-btn boxed" aria-label="Choose icon" onClick={() => setPicking(true)}><Icon name={icon} size={18} /></button>
        <input placeholder="New category" value={cat} onChange={(e) => setCat(e.target.value)} />
        <button className="btn small" disabled={!cat.trim()} onClick={() => void guard(async () => { await addCategory(cat, icon); setCat(""); setIcon("tag"); })}>Add</button>
      </div>
      {picking && (
        <Sheet title="Pick an icon" onClose={() => setPicking(false)}>
          <div className="icon-grid">{CATEGORY_ICON_KEYS.map((k) => <button key={k} className={`chip ${icon === k ? "on" : ""}`} onClick={() => { setIcon(k); setPicking(false); }} aria-label={k}><Icon name={k} size={20} /></button>)}</div>
        </Sheet>
      )}
      {err && <p className="error">{err}</p>}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}

      <div className="lab section">Your data</div>
      <button className="btn block" onClick={() => setImporting(true)}><Icon name="dl" size={16} /> Import from Monefy (CSV)</button>
      <button className="btn block" onClick={exportCsv}><Icon name="dl" size={16} /> Export expenses (CSV)</button>
      <p className="hint">{expenses.length} expenses · {loans.length} loans · {settlements.length} payments. Nothing is ever deleted from loans.</p>
      <button className="btn ghost danger block" onClick={() => void supabase.auth.signOut()}><Icon name="out" size={16} /> Sign out{email ? ` (${email})` : ""}</button>
    </>
  );
}
