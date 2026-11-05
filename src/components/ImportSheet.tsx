import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { Icon } from "../lib/icons";
import { useData } from "../lib/data";
import { parseMonefyCsv, rowKey, type ImportRow } from "../lib/monefy";
import { money } from "../lib/format";
import { prettyDate } from "../lib/dates";
import { sum } from "../lib/calc";

/** Import a Monefy CSV export: preview first, skip rows already in Kharcha, then insert in batches. */
export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { categories, expenses, incomes, importRows } = useData();
  const [name, setName] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ expenses: number; incomes: number; newCategories: number } | null>(null);

  const existingKeys = useMemo(() => {
    const cat = new Map(categories.map((c) => [c.id, c.name]));
    return new Set([
      ...expenses.map((e) => rowKey(e.spent_on, e.amount, cat.get(e.category_id ?? "") ?? "Uncategorized", e.note)),
      ...incomes.map((i) => rowKey(i.received_on, i.amount, "income", i.note)),
    ]);
  }, [expenses, incomes, categories]);

  const fresh = useMemo(() => (rows ?? []).filter((r) => !existingKeys.has(rowKey(r.date, r.amount, r.kind === "income" ? "income" : r.category, r.note))), [rows, existingKeys]);
  const dupes = (rows?.length ?? 0) - fresh.length;
  const exp = fresh.filter((r) => r.kind === "expense");
  const known = new Set(categories.map((c) => c.name.toLowerCase()));
  const perCat = useMemo(() => {
    const m = new Map<string, { n: number; total: number }>();
    for (const r of exp) { const v = m.get(r.category) ?? { n: 0, total: 0 }; v.n++; v.total += r.amount; m.set(r.category, v); }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [exp]);
  const dates = fresh.map((r) => r.date).sort();

  async function pick(f: File | undefined) {
    if (!f) return;
    setErr(""); setRows(null); setDone(null); setName(f.name);
    try {
      const res = parseMonefyCsv(await f.text());
      if (res.error) return setErr(res.error);
      setRows(res.rows);
    } catch { setErr("Couldn't read that file."); }
  }
  async function go() {
    setBusy(true); setErr("");
    try { setDone(await importRows(fresh)); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <Sheet title="Import from Monefy" onClose={onClose}>
      {done ? (
        <>
          <div className="card center"><span className="lab">Imported</span><b className="serif pos">{done.expenses} expenses</b>
            <span className="muted small">{done.newCategories} new {done.newCategories === 1 ? "category" : "categories"}{done.incomes ? ` · ${done.incomes} income entries` : ""}</span></div>
          <p className="hint">All imported entries are marked personal and paid by you. Open any entry to mark it as split, friend-paid or a company claim.</p>
          <button className="btn primary block" onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <p className="hint">In Monefy: ⋮ menu → Export to CSV, with the period set to All. Then choose that file here.</p>
          <label className="btn block" style={{ cursor: "pointer" }}><Icon name="dl" size={16} /> {name || "Choose CSV file"}
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => void pick(e.target.files?.[0])} /></label>
          {err && <p className="error">{err}</p>}
          {rows && (
            <>
              <div className="card" style={{ marginTop: 12 }}>
                <div className="line"><span>New expenses</span><b>{exp.length}</b></div>
                <div className="line"><span>Total</span><b>{money(sum(exp.map((r) => r.amount)))}</b></div>
                {dates.length > 0 && <div className="line"><span>Dates</span><b>{prettyDate(dates[0])} – {prettyDate(dates[dates.length - 1])}</b></div>}
                {fresh.length !== exp.length && <div className="line"><span>Income entries</span><b>{fresh.length - exp.length}</b></div>}
                {dupes > 0 && <div className="line"><span className="muted">Already in Kharcha (skipped)</span><b>{dupes}</b></div>}
              </div>
              {perCat.length > 0 && (
                <div className="card list" style={{ maxHeight: 240, overflowY: "auto" }}>
                  {perCat.map(([c, v]) => (
                    <div key={c} className="row static"><div className="grow"><b>{c}{!known.has(c.toLowerCase()) && <span className="badge">new</span>}</b><small>{v.n} {v.n === 1 ? "entry" : "entries"}</small></div><span className="v serif">{money(v.total)}</span></div>
                  ))}
                </div>
              )}
              <button className="btn primary block" disabled={busy || fresh.length === 0} onClick={go}>
                {busy ? "Importing…" : fresh.length === 0 ? "Nothing new to import" : `Import ${fresh.length} entries`}</button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
