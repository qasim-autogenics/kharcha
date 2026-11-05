import { useState } from "react";
import { useData } from "../lib/data";
import { Icon } from "../lib/icons";
import { APP } from "../lib/config";
import { setPref } from "../lib/prefs";

export function Setup({ onDone }: { onDone: () => void }) {
  const { categories, addPerson, archiveCategory } = useData();
  const [friend, setFriend] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const toggle = (id: string) => setOff((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function finish() {
    setBusy(true); setErr("");
    try {
      if (friend.trim()) await addPerson(friend, true);
      for (const id of off) await archiveCategory(id, true);
      setPref("setup", "done");
      onDone();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const skip = () => { setPref("setup", "done"); onDone(); };

  return (
    <div className="auth setup">
      <div className="steps"><i className="on" /><i className="on" /><i /></div>
      <h1 className="serif">Who do you<br />split costs with?</h1>
      <p className="muted">Add your roommate to track what they owe you (or what you owe them). You can add more people later.</p>
      <label className="field"><Icon name="user" size={18} /><input placeholder="Roommate's name (optional)" value={friend} onChange={(e) => setFriend(e.target.value)} /></label>

      <div className="lab" style={{ marginTop: 26 }}>Categories to start with</div>
      <div className="chips">
        {categories.map((c) => (
          <button key={c.id} className={`chip ${off.has(c.id) ? "" : "on"}`} onClick={() => toggle(c.id)} aria-pressed={!off.has(c.id)}>
            <Icon name={off.has(c.id) ? c.icon : "check"} size={14} /> {c.name}
          </button>
        ))}
      </div>
      <p className="hint">Unselected categories are hidden. You can bring them back in More.</p>

      <div className="lab" style={{ marginTop: 18 }}>Currency</div>
      <div className="field static"><span>Pakistani Rupee ({APP.CURRENCY_LABEL})</span></div>

      {err && <p className="error">{err}</p>}
      <button className="btn primary block" onClick={finish} disabled={busy}>{busy ? "Setting up…" : "Start tracking"}</button>
      <button className="link center" onClick={skip}>Skip for now</button>
    </div>
  );
}
