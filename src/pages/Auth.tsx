import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Logo } from "../components/Logo";
import { Icon } from "../lib/icons";
import { APP } from "../lib/config";

export function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setOk("");
    if (mode === "up" && password !== confirm) return setMsg("Passwords don't match.");
    setBusy(true);
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === "up" && !data.session) setOk("Check your email to confirm your account, then sign in.");
  }

  async function forgot() {
    if (!email) return setMsg("Enter your email first, then tap Forgot password.");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setMsg(error.message); else { setMsg(""); setOk("Password reset link sent. Check your email."); }
  }

  return (
    <div className="auth">
      <div className="auth-brand"><Logo size={38} /><span className="serif">{APP.NAME}</span></div>
      <h1 className="serif">{mode === "in" ? "Welcome back" : "Create your khata"}</h1>
      <p className="muted">{mode === "in" ? "Sign in to see your khata." : "Takes under a minute."}</p>
      <form onSubmit={submit}>
        <label className="field"><Icon name="mail" size={18} /><input type="email" required placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><Icon name="lock" size={18} />
          <input type={show ? "text" : "password"} required minLength={6} placeholder="Password" autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="icon-btn" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}><Icon name="eye" size={18} /></button></label>
        {mode === "up" && <label className="field"><Icon name="lock" size={18} /><input type={show ? "text" : "password"} required minLength={6} placeholder="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>}
        {mode === "in" && <button type="button" className="link right" onClick={forgot}>Forgot password?</button>}
        {msg && <p className="error">{msg}</p>}
        {ok && <p className="okmsg">{ok}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <p className="switch">{mode === "in" ? "New here? " : "Already have an account? "}
        <button className="link" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); setOk(""); }}>{mode === "in" ? "Create an account" : "Sign in"}</button></p>
      <div className="privacy"><Icon name="shield" size={16} /> Your data is private to your account.</div>
    </div>
  );
}
