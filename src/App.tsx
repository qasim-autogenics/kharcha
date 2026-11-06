import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isConfigured, supabase } from "./lib/supabase";
import { DataProvider, useData } from "./lib/data";
import { Auth } from "./pages/Auth";
import { Splash } from "./pages/Splash";
import { Setup } from "./pages/Setup";
import { Home } from "./pages/Home";
import { Analytics } from "./pages/Analytics";
import { Loans } from "./pages/Loans";
import { Roommate } from "./pages/Roommate";
import { Ask } from "./pages/Ask";
import { Settings } from "./pages/Settings";
import { Logo } from "./components/Logo";
import { Icon } from "./lib/icons";
import { APP } from "./lib/config";
import { getPref, setPref } from "./lib/prefs";
import { useTheme } from "./lib/theme";
import { PeriodProvider } from "./lib/period";
import { Drawer } from "./components/Drawer";
import { Nav, type PayIntent } from "./lib/nav";
import { useBackLayer } from "./lib/backstack";

const TABS = [
  { id: "home", label: "Home", icon: "home_nav" },
  { id: "stats", label: "Stats", icon: "stats" },
  { id: "loans", label: "Loans", icon: "loans" },
  { id: "room", label: "Roommates", icon: "people" },
  { id: "ask", label: "Ask AI", icon: "ask" },
] as const;
type TabId = (typeof TABS)[number]["id"] | "more";
const IDS = [...TABS.map((t) => t.id), "more"] as const;

function Shell({ email }: { email?: string }) {
  const { loading, error, refresh, people, expenses } = useData();
  const [tab, setTab] = useState<TabId>(() => getPref<TabId>("tab", "home", IDS));
  const [setupDone, setSetupDone] = useState(() => getPref<string>("setup", "no") === "done");
  const [minDone, setMinDone] = useState(false);
  const [menu, setMenu] = useState(false);
  const [intent, setIntent] = useState<PayIntent | null>(null);
  useEffect(() => { const t = window.setTimeout(() => setMinDone(true), APP.SPLASH_MIN_MS); return () => window.clearTimeout(t); }, []);

  const go = (t: TabId) => { setTab(t); setPref("tab", t); };
  useBackLayer(tab !== "home", () => go("home")); // Back from any other tab returns to Home

  const openPay = (i: PayIntent) => { setIntent(i); go("room"); };

  if (loading || !minDone) return <Splash />;
  if (!setupDone && people.length === 0 && expenses.length === 0) return <Setup onDone={() => setSetupDone(true)} />;

  const title = tab === "more" ? "Settings" : tab === "home" ? "" : TABS.find((t) => t.id === tab)!.label;
  return (
    <Nav.Provider value={{ openPay, intent, clearIntent: () => setIntent(null) }}>
    <div className={`app ${tab === "ask" ? "mission" : ""}`}>
      <header>
        {tab === "home" || tab === "stats" || tab === "room" ? (
          <button className="brand brand-btn" onClick={() => setMenu(true)} aria-label="Open menu" aria-haspopup="dialog">
            <Logo size={28} /><span className="serif">{title || APP.NAME}</span><Icon name="menu" size={18} /></button>
        ) : <div className="brand"><Logo size={28} /><span className="serif">{title || APP.NAME}</span></div>}
        <button className="icon-btn" aria-label="Settings" onClick={() => go(tab === "more" ? "home" : "more")}><Icon name={tab === "more" ? "close" : "gear"} size={22} /></button>
      </header>
      <main>
        {error && <div className="banner">Couldn't load data: {error} <button className="link" onClick={() => void refresh()}>Retry</button></div>}
        {tab === "home" && <Home />}
        {tab === "stats" && <Analytics />}
        {tab === "loans" && <Loans />}
        {tab === "room" && <Roommate />}
        {tab === "ask" && <Ask />}
        {tab === "more" && <Settings email={email} />}
      </main>
      {menu && <Drawer onClose={() => setMenu(false)} />}
      <nav>
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? "on" : ""} onClick={() => go(t.id)}><Icon name={t.icon} size={22} /><span>{t.label}</span></button>
        ))}
      </nav>
    </div>
    </Nav.Provider>
  );
}

export function App() {
  useTheme(); // applies the saved theme on every screen, including sign-in
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!isConfigured) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return <div className="auth"><h1 className="serif">Setup needed</h1><p className="muted">Copy <code>.env.example</code> to <code>.env</code> and fill in your Supabase URL and publishable key, then restart.</p></div>;
  }
  if (session === undefined) return <Splash label="Starting…" />;
  if (!session) return <Auth />;
  return <DataProvider key={session.user.id}><PeriodProvider><Shell email={session.user.email} /></PeriodProvider></DataProvider>;
}
