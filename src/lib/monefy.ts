// Parser for Monefy's "Export to CSV" file. Pure functions, no I/O.
// Columns: date, account, category, amount, currency, converted amount, currency, description
// Amounts are negative for expenses, positive for income, and may contain thousands separators ("-1,400").

export interface ImportRow { date: string; category: string; amount: number; note: string; kind: "expense" | "income" }
export interface ParseResult { rows: ImportRow[]; skipped: number; error?: string }

/** Minimal RFC-4180 style CSV reader (quotes, escaped quotes, commas/newlines inside quotes). */
export function readCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) out.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) out.push(row);
  return out;
}

const toNumber = (s: string) => Number((s ?? "").replace(/[",\s]/g, ""));

/** dd/mm/yyyy (Monefy default) -> yyyy-mm-dd. Returns null if it is not a valid date. */
export function parseDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseMonefyCsv(text: string): ParseResult {
  const table = readCsv(text);
  if (table.length < 2) return { rows: [], skipped: 0, error: "That file has no rows." };
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const iDate = col("date"), iCat = col("category"), iAmt = col("amount"), iConv = col("converted amount"), iDesc = col("description");
  if (iDate < 0 || iCat < 0 || iAmt < 0) return { rows: [], skipped: 0, error: "This doesn't look like a Monefy export (missing date, category or amount columns)." };

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of table.slice(1)) {
    const date = parseDate(r[iDate] ?? "");
    // prefer the converted amount (already in your main currency); fall back to the plain amount
    const conv = iConv >= 0 ? toNumber(r[iConv] ?? "") : NaN;
    const amt = Number.isFinite(conv) && conv !== 0 ? conv : toNumber(r[iAmt] ?? "");
    if (!date || !Number.isFinite(amt) || amt === 0) { skipped++; continue; }
    rows.push({
      date, amount: Math.abs(amt), kind: amt < 0 ? "expense" : "income",
      category: (r[iCat] ?? "").trim() || "Uncategorized", note: (iDesc >= 0 ? r[iDesc] ?? "" : "").trim(),
    });
  }
  return { rows, skipped };
}

/** Same expense (date + amount + category + note) is treated as already imported. */
export const rowKey = (date: string, amount: number, category: string, note: string) =>
  `${date}|${amount}|${category.trim().toLowerCase()}|${note.trim().toLowerCase()}`;

/** Best-effort hint from the note text. Only a suggestion: the review screen never applies it automatically. */
export function suggest(note: string): { kind: "claim" | "split"; why: string } | null {
  const n = note.toLowerCase();
  if (/company|office|khata|reimburs/.test(n)) return { kind: "claim", why: "mentions company / office" };
  if (/\+|\bsplit\b|\b(me|mota|mati|matee|andy|ansab)\b.*\b(me|mota|mati|matee|andy|ansab)\b/.test(n)) return { kind: "split", why: "mentions more than one person" };
  return null;
}
