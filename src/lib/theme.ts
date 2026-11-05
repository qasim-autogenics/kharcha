import { useCallback, useEffect, useState } from "react";
import { getPref, setPref } from "./prefs";

export type ThemePref = "auto" | "light" | "dark";
const OPTIONS = ["auto", "light", "dark"] as const;
const META_COLORS = { light: "#b4472a", dark: "#14100d" };

function apply(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  const dark = pref === "dark" || (pref === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? META_COLORS.dark : META_COLORS.light);
}

export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>(() => getPref<ThemePref>("theme", "auto", OPTIONS));
  useEffect(() => { apply(pref); }, [pref]);
  const set = useCallback((p: ThemePref) => { setPref("theme", p); setPrefState(p); }, []);
  return { pref, set };
}
