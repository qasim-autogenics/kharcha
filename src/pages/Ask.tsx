import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Icon } from "../lib/icons";
import { APP } from "../lib/config";

interface Reply { q: string; answer: string; sql: string | null; rows: number; error?: string }

const STEPS = ["Receiving transmission", "Composing query", "Read-only database pass", "Analysing telemetry", "Preparing answer"];
const HISTORY_KEY = "kharcha.askLog";
const HISTORY_MAX = 30;
/**
 * The conversation lives outside the component, so switching tabs does not wipe it.
 * It is also kept in sessionStorage (cleared when the browser tab is closed): answers contain money figures,
 * so they are deliberately not kept for good.
 */
let history: Reply[] = (() => {
  try { const v = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]"); return Array.isArray(v) ? (v as Reply[]) : []; } catch { return []; }
})();
const listeners = new Set<(h: Reply[]) => void>(); // lets a freshly opened Ask tab receive an answer that arrives late
const saveHistory = (next: Reply[]) => {
  history = next.slice(-HISTORY_MAX);
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { /* storage unavailable: keep it in memory only */ }
  listeners.forEach((fn) => fn(history));
};
const clean = (s: string) => s.replace(/[*_`#]/g, "").trim();

/** Show the real server message instead of supabase-js' generic "non-2xx" text. */
async function serverMessage(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try { const j = await ctx.json(); if (j?.error) return String(j.error); } catch { /* fall through */ }
  }
  return (err as Error)?.message ?? "Unknown error";
}

export function Ask() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [log, setLog] = useState<Reply[]>(history);
  const [showSql, setShowSql] = useState<number | null>(null);
  const timer = useRef<number>();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { listeners.add(setLog); return () => { listeners.delete(setLog); window.clearInterval(timer.current); }; }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [log.length, busy]);

  async function send(text: string) {
    const question = text.trim().slice(0, APP.ASK_MAX_CHARS);
    if (!question || busy) return;
    setQ(""); setBusy(true); setStep(0);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    let reply: Reply;
    try {
      const { data, error } = await supabase.functions.invoke(APP.ASK_FUNCTION, { body: { question } });
      if (error) throw new Error(await serverMessage(error));
      if (data?.error && !data?.answer) throw new Error(String(data.error));
      reply = { q: question, answer: clean(String(data?.answer ?? "No answer.")), sql: data?.sql ?? null, rows: Array.isArray(data?.rows) ? data.rows.length : 0 };
    } catch (e) {
      reply = { q: question, answer: "Transmission failed.", sql: null, rows: 0, error: (e as Error).message };
    }
    window.clearInterval(timer.current);
    saveHistory([...history, reply]); setBusy(false);
  }

  return (
    <div className="mission-body">
      <div className="mc-head">
        <div className="radar" aria-hidden="true"><i /></div>
        <div><b className="mono">MISSION CONTROL</b><small className="mono">KHARCHA · FINANCE OPS</small></div>
        {log.length > 0 && <button className="clear-btn mono" onClick={() => { if (confirm("Clear this conversation?")) { saveHistory([]); setLog([]); setShowSql(null); } }}>CLEAR CHAT</button>}
      </div>
      <div className="tele">
        <div><small className="mono">DB LINK</small><b className="mono ok">NOMINAL</b></div>
        <div><small className="mono">ACCESS</small><b className="mono">READ-ONLY</b></div>
        <div><small className="mono">RLS GUARD</small><b className="mono ok">ARMED</b></div>
      </div>

      {log.length === 0 && !busy && (
        <>
          <div className="mc-hint mono">&gt; STANDING BY. SELECT A QUERY OR TRANSMIT YOUR OWN.</div>
          <div className="sugs">{APP.ASK_SUGGESTIONS.map((s) => <button key={s} className="sug" onClick={() => void send(s)}>{s}</button>)}</div>
        </>
      )}

      {log.map((r, i) => (
        <div key={i} className="tx">
          <div className="tx-q mono">&gt; {r.q}</div>
          <div className={`tx-a ${r.error ? "fail" : ""}`}>
            <div className="tx-tag mono">{r.error ? "TRANSMISSION FAILED" : "TRANSMISSION RECEIVED"}</div>
            <p>{r.answer}</p>
            {r.error && <p className="mono small">{r.error}</p>}
            {r.sql && (
              <>
                <button className="log-btn mono" onClick={() => setShowSql(showSql === i ? null : i)}>{showSql === i ? "▾" : "▸"} QUERY LOG · {r.rows} ROWS</button>
                {showSql === i && <pre className="mono">{r.sql}</pre>}
              </>
            )}
          </div>
        </div>
      ))}

      {busy && (
        <div className="steps-box mono" role="status" aria-live="polite">
          {STEPS.map((s, i) => (
            <div key={s} className={i < step ? "done" : i === step ? "now" : ""}>
              <span>{String(i + 1).padStart(2, "0")}</span>{s}{i < step ? " ✓" : i === step ? " …" : ""}
            </div>
          ))}
        </div>
      )}
      <div ref={end} />

      <form className="cons" onSubmit={(e) => { e.preventDefault(); void send(q); }}>
        <input value={q} maxLength={APP.ASK_MAX_CHARS} onChange={(e) => setQ(e.target.value)} placeholder="Transmit a question…" aria-label="Question" disabled={busy} />
        <button className="send" disabled={busy || !q.trim()} aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
    </div>
  );
}
