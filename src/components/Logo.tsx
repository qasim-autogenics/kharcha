/**
 * The Kharcha mark. Large sizes use the full wallet-and-K artwork; small sizes (header, menu, sign-in)
 * use the simplified K-in-a-square with the green clasp so it stays crisp at 28-40px.
 */
const SMALL_MAX = 48;
export function Logo({ size = 40 }: { size?: number; bg?: string; fg?: string; radius?: number }) {
  if (size > SMALL_MAX) {
    const src = size > 96 ? "/icon-512.png" : "/icon-192.png";
    return <img src={src} width={size} height={size} alt="Kharcha" style={{ display: "block", flex: "none" }} draggable={false} />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Kharcha" style={{ display: "block", flex: "none" }}>
      <rect width="64" height="64" rx="15" fill="#b4472a" />
      <path d="M15 16v32M15 32l18-16M22 29l14 19" fill="none" stroke="#fbefdc" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="45" y="28" width="13" height="13" rx="3.5" fill="#8a9a5b" />
      <circle cx="51.5" cy="34.5" r="2.4" fill="#fbefdc" />
    </svg>
  );
}
