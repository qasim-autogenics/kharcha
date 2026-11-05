import { APP, CHART_COLORS, OTHER_COLOR } from "./config";
import type { Category, Expense, Income, Loan, LoanPayment, PayDirection, Person, Settlement, SettlementAllocation } from "./types";

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The user's real cost: friend's portion and company claims are excluded. */
export const myCost = (e: Expense) => (e.split === "reimbursable" ? 0 : e.amount - e.friend_share);
/** Cash the user actually paid out (0 when the friend paid the bill). */
export const paidOut = (e: Expense) => (e.paid_by === "me" ? e.amount : 0);
/** What this expense makes the friend owe the user. */
export const friendOwesMe = (e: Expense) => (e.paid_by === "me" ? e.friend_share : 0);
/** What this expense makes the user owe the friend. */
export const iOweFriend = (e: Expense) => (e.paid_by === "friend" ? e.amount - e.friend_share : 0);

/** Money coming back to the user: roommate balance owed, pending company claims, loans others still owe. */
export function incoming(expenses: Expense[], settlements: Settlement[], loans: LoanView[], people: Person[]) {
  // everyone you share bills with, not only the roommate; each person's balance is counted on its own
  const roommate = sum(people.map((p) => Math.max(0, friendBalance(p.id, expenses, settlements).balance)));
  const claims = sum(expenses.filter((e) => e.split === "reimbursable" && !e.reimbursed_at).map((e) => e.amount));
  const loansOwed = sum(loans.filter((l) => l.direction === "gave").map((l) => l.outstanding));
  return { roommate, claims, loansOwed, total: roommate + claims + loansOwed };
}

/** Per person: what you owe them for bills THEY paid in this period, minus what you already paid them in it. */
export function oweByPerson(list: Expense[], settlements: Settlement[], people: Person[], range: { from: string; to: string }) {
  return people.map((person) => {
    const gross = sum(list.filter((e) => e.person_id === person.id).map(iOweFriend));
    const repaid = sum(settlements.filter((x) => x.person_id === person.id && x.direction === "paid" && x.paid_on >= range.from && x.paid_on <= range.to).map((x) => x.amount));
    return { person, gross, net: Math.max(0, gross - repaid) };
  }).filter((r) => r.gross > 0);
}
/** "SQ", "SQ and Matee", or "3 friends" for short sentences. */
export const namesOf = (people: Person[]) => (people.length === 0 ? "your friend" : people.length === 1 ? people[0].name : people.length === 2 ? `${people[0].name} and ${people[1].name}` : `${people.length} friends`);

export interface Slice { id: string; name: string; icon: string; total: number; count: number; color: string; ids: string[] }

/** Totals per category, biggest first. Colours are by rank so the chart is always readable. */
export function rankCategories(expenses: Expense[], categories: Category[], measure: (e: Expense) => number): Slice[] {
  const map = new Map<string, Slice>();
  for (const e of expenses) {
    const v = measure(e);
    if (v <= 0) continue;
    const cat = categories.find((c) => c.id === e.category_id);
    const id = cat?.id ?? "none";
    const row = map.get(id) ?? { id, name: cat?.name ?? "Uncategorized", icon: cat?.icon ?? "tag", total: 0, count: 0, color: OTHER_COLOR, ids: [id] };
    row.total += v; row.count += 1;
    map.set(id, row);
  }
  const ranked = [...map.values()].sort((a, b) => b.total - a.total);
  ranked.forEach((s, i) => { s.color = i < APP.CHART_TOP_N ? CHART_COLORS[i] : OTHER_COLOR; });
  return ranked;
}

/** Top N slices plus one grouped "Other (n)" slice for charts. */
export function chartSlices(ranked: Slice[]): Slice[] {
  if (ranked.length <= APP.CHART_TOP_N) return ranked;
  const top = ranked.slice(0, APP.CHART_TOP_N);
  const rest = ranked.slice(APP.CHART_TOP_N);
  return [...top, {
    id: "other", name: `Other (${rest.length})`, icon: "tag", total: sum(rest.map((r) => r.total)),
    count: sum(rest.map((r) => r.count)), color: OTHER_COLOR, ids: rest.map((r) => r.id),
  }];
}

// ───────── loans ─────────
export interface LoanView extends Loan {
  person: Person | undefined; payments: LoanPayment[]; repaid: number; outstanding: number;
  status: "open" | "partial" | "settled";
}
export function buildLoans(loans: Loan[], payments: LoanPayment[], people: Person[]): LoanView[] {
  return loans.map((l) => {
    const ps = payments.filter((p) => p.loan_id === l.id).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
    const repaid = sum(ps.map((p) => p.amount));
    const outstanding = Math.max(0, l.amount - repaid);
    return { ...l, person: people.find((p) => p.id === l.person_id), payments: ps, repaid, outstanding,
      status: outstanding === 0 ? "settled" : repaid > 0 ? "partial" : "open" };
  });
}

// ───────── roommate balance ─────────
export interface FriendBalance { owedToMe: number; iOwe: number; received: number; paidToFriend: number; balance: number }
/** balance > 0: friend owes me. balance < 0: I owe the friend. */
export function friendBalance(personId: string, expenses: Expense[], settlements: Settlement[]): FriendBalance {
  const mine = expenses.filter((e) => e.person_id === personId);
  const owedToMe = sum(mine.map(friendOwesMe));
  const iOwe = sum(mine.map(iOweFriend));
  const received = sum(settlements.filter((s) => s.person_id === personId && s.direction === "received").map((s) => s.amount));
  const paidToFriend = sum(settlements.filter((s) => s.person_id === personId && s.direction === "paid").map((s) => s.amount));
  return { owedToMe, iOwe, received, paidToFriend, balance: owedToMe - iOwe - received + paidToFriend };
}

// ───────── per-bill settlement ─────────
/** One shared bill and how much of it is still unpaid. dir "received": the friend owes you. dir "paid": you owe the friend. */
export interface Bill { expense: Expense; dir: PayDirection; total: number; settled: number; open: number }

/**
 * Shared bills with a person, each with its settled / open amount.
 * Payments tied to a bill (allocations) are applied first. Any payment amount not tied to a bill
 * (older payments, or "extra") is applied to the oldest still-open bills.
 */
export function billStatus(personId: string, expenses: Expense[], settlements: Settlement[], allocations: SettlementAllocation[]): Bill[] {
  const dirOf = new Map(settlements.map((s) => [s.id, s.direction] as const));
  const bills: Bill[] = [];
  for (const dir of ["received", "paid"] as PayDirection[]) {
    const list = expenses
      .filter((e) => e.person_id === personId && (dir === "received" ? friendOwesMe(e) : iOweFriend(e)) > 0)
      .sort((a, b) => a.spent_on.localeCompare(b.spent_on) || a.created_at.localeCompare(b.created_at));
    const mine = list.map((e) => {
      const total = dir === "received" ? friendOwesMe(e) : iOweFriend(e);
      const tied = sum(allocations.filter((a) => a.expense_id === e.id && dirOf.get(a.settlement_id) === dir).map((a) => a.amount));
      return { expense: e, dir, total, settled: Math.min(total, tied), open: Math.max(0, total - tied) } as Bill;
    });
    const paid = sum(settlements.filter((x) => x.person_id === personId && x.direction === dir).map((x) => x.amount));
    const tiedAll = sum(allocations.filter((a) => dirOf.get(a.settlement_id) === dir && list.some((e) => e.id === a.expense_id)).map((a) => a.amount));
    let loose = Math.max(0, paid - tiedAll);
    for (const b of mine) {
      if (loose <= 0) break;
      const take = Math.min(loose, b.open);
      b.open -= take; b.settled += take; loose -= take;
    }
    bills.push(...mine);
  }
  return bills;
}

/** Spread a payment over bills, oldest first. Returns the per-bill amounts and what is left over. */
export function allocate(amount: number, pool: Bill[]): { allocs: { expense_id: string; amount: number }[]; extra: number } {
  let left = amount;
  const allocs: { expense_id: string; amount: number }[] = [];
  for (const b of [...pool].sort((x, y) => x.expense.spent_on.localeCompare(y.expense.spent_on))) {
    if (left <= 0) break;
    const take = Math.min(left, b.open);
    if (take > 0) { allocs.push({ expense_id: b.expense.id, amount: Math.round(take * 100) / 100 }); left -= take; }
  }
  return { allocs, extra: Math.max(0, Math.round(left * 100) / 100) };
}

// ───────── account balance (all time) ─────────
export interface AccountBalance {
  opening: number;
  in: { income: number; claims: number; friends: number; loansBack: number; borrowed: number; total: number };
  out: { spent: number; friends: number; loansGiven: number; loansRepaid: number; total: number };
  balance: number;
}
/** Bank-style balance: everything that came in minus everything that went out, since you started. Company claims count as out when paid and in when reimbursed. */
export function accountBalance(opening: number, expenses: Expense[], incomes: Income[], settlements: Settlement[], loans: Loan[], loanPayments: LoanPayment[]): AccountBalance {
  const kind = new Map(loans.map((l) => [l.id, l.direction] as const));
  const inn = {
    income: sum(incomes.map((i) => i.amount)),
    claims: sum(expenses.filter((e) => e.split === "reimbursable" && e.reimbursed_at).map((e) => e.amount)),
    friends: sum(settlements.filter((x) => x.direction === "received").map((x) => x.amount)),
    loansBack: sum(loanPayments.filter((x) => kind.get(x.loan_id) === "gave").map((x) => x.amount)),
    borrowed: sum(loans.filter((l) => l.direction === "borrowed").map((l) => l.amount)),
    total: 0,
  };
  inn.total = inn.income + inn.claims + inn.friends + inn.loansBack + inn.borrowed;
  const out = {
    spent: sum(expenses.map(paidOut)),
    friends: sum(settlements.filter((x) => x.direction === "paid").map((x) => x.amount)),
    loansGiven: sum(loans.filter((l) => l.direction === "gave").map((l) => l.amount)),
    loansRepaid: sum(loanPayments.filter((x) => kind.get(x.loan_id) === "borrowed").map((x) => x.amount)),
    total: 0,
  };
  out.total = out.spent + out.friends + out.loansGiven + out.loansRepaid;
  return { opening, in: inn, out, balance: opening + inn.total - out.total };
}
