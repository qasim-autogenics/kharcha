const P: Record<string, string> = {
  food: "M7 3v7a2 2 0 0 0 4 0V3M9 3v18M17 3c-2.2 1.5-3 4-3 7h3v11",
  bills: "M13 2 4 14h7l-1 8 9-12h-7z",
  play: "M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM10 9l5 3-5 3z",
  bus: "M6 4h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM4 11h16M8 21v-3M16 21v-3",
  cart: "M9 20.5a1.2 1.2 0 1 0 0-.01M18 20.5a1.2 1.2 0 1 0 0-.01M2 3h3l2.5 12h11L21 7H6",
  home: "m3 11 9-8 9 8M5 10v10h14V10",
  bag: "M5 8h14l1 13H4zM9 8V6a3 3 0 0 1 6 0v2",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11",
  phone: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2",
  car: "M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7.5 13h.01M16.5 13h.01",
  coffee: "M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 9h2a2 2 0 0 1 0 5h-2M8 3v2M12 3v2",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  plus: "M12 5v14M5 12h14",
  dots: "M12 5.5h.01M12 12h.01M12 18.5h.01",
  menu: "M4 7h16M4 12h10M4 17h16",
  chev: "m9 6 6 6-6 6",
  back: "m15 6-6 6 6 6",
  home_nav: "m3 11 9-8 9 8M5 10v10h14V10",
  stats: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  loans: "M3 14l4-4 4 3 5-5 5 4M3 20h18",
  people: "M9 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 12zM3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M17 5a3 3 0 0 1 0 6M21 20c0-2.6-1.4-4.6-4-5.5",
  ask: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  mail: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  check: "m5 12 5 5 9-10",
  close: "M6 6l12 12M18 6 6 18",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4l10-10-4-4L4 16zM13 7l4 4",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5",
  moon: "M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z",
  dl: "M12 3v12m-5-5 5 5 5-5M4 21h16",
  out: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  ring: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  gauge: "M3 18a9 9 0 0 1 18 0M7 18a5 5 0 0 1 10 0",
  bubbles: "M9 19a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM17.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  bars: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  shield: "M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6zM9 12l2 2 4-4",
};

// icons a user can pick for a category
export const CATEGORY_ICON_KEYS = ["food", "coffee", "cart", "bus", "car", "bills", "home", "bag", "heart", "play", "gift", "book", "phone", "tag"];

export function Icon({ name, size = 20, stroke = 1.8 }: { name: string; size?: number; stroke?: number }) {
  const d = P[name] ?? P.tag; // unknown/legacy (e.g. emoji) values fall back to a tag
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === "dots" ? 3.2 : stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
