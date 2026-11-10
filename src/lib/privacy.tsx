import { useSyncExternalStore, type ReactNode } from "react";
import { getPref, setPref } from "./prefs";

/** Privacy mode: balance and income figures show as dots until you tap them. */
export const PRIVACY = { PREF_KEY: "hideMoney", REVEAL_MS: 6000, MASK: "Rs ••••" } as const;

let hidden = getPref<"yes" | "no">(PRIVACY.PREF_KEY, "yes", ["yes", "no"]) === "yes"; // on by default
let peeking = false;
let timer: number | undefined;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const masked = () => hidden && !peeking;

export function setHideMoney(on: boolean) {
  hidden = on; peeking = false; window.clearTimeout(timer);
  setPref(PRIVACY.PREF_KEY, on ? "yes" : "no");
  emit();
}
export function peek() {
  peeking = true; emit();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { peeking = false; emit(); }, PRIVACY.REVEAL_MS);
}
export const useMasked = () => useSyncExternalStore(subscribe, masked);
export const useHideMoney = () => useSyncExternalStore(subscribe, () => hidden);

/** Wrap any private amount: shows dots while privacy mode is on; tapping shows every hidden amount for a few seconds. */
export function Secret({ children }: { children: ReactNode }) {
  const m = useSyncExternalStore(subscribe, masked);
  if (!m) return <>{children}</>;
  return <button type="button" className="secret" onClick={peek} aria-label="Hidden amount, tap to show">{PRIVACY.MASK}</button>;
}
