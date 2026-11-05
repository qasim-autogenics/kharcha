import { useState } from "react";
import { Icon } from "../lib/icons";
import { CHART_VIEWS, type ChartView } from "../lib/config";

/** Three-dot button that opens a small list of chart styles (saves the space a tab bar used to take). */
export function ChartMenu({ value, onChange, views }: { value: ChartView; onChange: (v: ChartView) => void; views: readonly ChartView[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cmenu">
      <button className="icon-btn" aria-label="Chart style" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="dots" size={20} /></button>
      {open && (
        <>
          <div className="cmenu-back" onClick={() => setOpen(false)} />
          <div className="cmenu-list" role="menu">
            {CHART_VIEWS.filter((v) => views.includes(v.id)).map((v) => (
              <button key={v.id} role="menuitemradio" aria-checked={value === v.id} className={value === v.id ? "on" : ""} onClick={() => { onChange(v.id); setOpen(false); }}>
                <Icon name={v.icon} size={18} /><span>{v.label}</span>{value === v.id && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
