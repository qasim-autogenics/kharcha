import { addPeriod } from "../lib/dates";
import { usePeriod } from "../lib/period";
import { Icon } from "../lib/icons";

/** Slim previous / label / next row. The Day-Week-Month-Year-All choice lives in the menu under the Kharcha name. */
export function PeriodNav() {
  const { state, set, label } = usePeriod();
  const { period, anchor } = state;
  if (period === "all") return <div className="period-nav"><span className="period-label">{label}</span></div>;
  return (
    <div className="period-nav">
      <button className="icon-btn" aria-label="Previous" onClick={() => set({ period, anchor: addPeriod(anchor, period, -1) })}>
        <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><Icon name="chev" size={20} /></span></button>
      <button className="period-label" onClick={() => set({ period, anchor: new Date() })} title="Jump to today">{label}</button>
      <button className="icon-btn" aria-label="Next" onClick={() => set({ period, anchor: addPeriod(anchor, period, 1) })}><Icon name="chev" size={20} /></button>
    </div>
  );
}
