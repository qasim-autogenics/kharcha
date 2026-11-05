import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { periodLabel, periodRange, type Period } from "./dates";
import { getPref, setPref } from "./prefs";

export interface PeriodState { period: Period; anchor: Date }
const PERIODS: readonly Period[] = ["day", "week", "month", "year", "all"];

interface Ctx { state: PeriodState; set: (s: PeriodState) => void; range: { from: string; to: string }; label: string }
const C = createContext<Ctx | null>(null);

/** One period filter shared by Home, Overview and Stats (chosen from the menu under the Kharcha name). */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PeriodState>(() => ({ period: getPref<Period>("period", "month", PERIODS), anchor: new Date() }));
  const value = useMemo<Ctx>(() => ({
    state,
    set: (s) => { setPref("period", s.period); setState(s); },
    range: periodRange(state.anchor, state.period),
    label: periodLabel(state.anchor, state.period),
  }), [state]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const usePeriod = () => {
  const c = useContext(C);
  if (!c) throw new Error("usePeriod outside PeriodProvider");
  return c;
};
