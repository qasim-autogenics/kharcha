import { useEffect } from "react";
import { Icon } from "../lib/icons";
import { Logo } from "./Logo";
import { APP } from "../lib/config";
import { usePeriod } from "../lib/period";
import { useBackLayer } from "../lib/backstack";
import type { Period } from "../lib/dates";

const OPTIONS: { id: Period; label: string; hint: string }[] = [
  { id: "day", label: "Day", hint: "Just one day" },
  { id: "week", label: "Week", hint: "Monday to Sunday" },
  { id: "month", label: "Month", hint: "Calendar month" },
  { id: "year", label: "Year", hint: "January to December" },
  { id: "all", label: "All time", hint: "Everything" },
];

export function Drawer({ onClose }: { onClose: () => void }) {
  const { state, set } = usePeriod();
  useBackLayer(true, onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="drawer-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-label="Menu">
        <div className="drawer-head"><Logo size={28} /><span className="serif">{APP.NAME}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><Icon name="close" size={20} /></button></div>
        <div className="lab">Show spending for</div>
        {OPTIONS.map((o) => (
          <button key={o.id} className={`drawer-item ${state.period === o.id ? "on" : ""}`}
            onClick={() => { set({ period: o.id, anchor: o.id === state.period ? state.anchor : new Date() }); onClose(); }}>
            <span><b>{o.label}</b><small>{o.hint}</small></span>{state.period === o.id && <Icon name="check" size={18} />}
          </button>
        ))}
      </aside>
    </div>
  );
}
