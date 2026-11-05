import { Logo } from "../components/Logo";
import { APP } from "../lib/config";

export function Splash({ label = "Syncing your khata…" }: { label?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-logo"><Logo size={96} /></div>
      <h1 className="serif">{APP.NAME}</h1>
      <p>{APP.TAGLINE}</p>
      <div className="splash-bar"><i /></div>
      <small>{label}</small>
    </div>
  );
}
