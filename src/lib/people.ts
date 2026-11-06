import type { Expense, Loan, Person, Settlement } from "./types";

/** The wording shown before a person is deleted: says exactly what goes and what stays. */
export function deletePersonMessage(p: Person, expenses: Expense[], settlements: Settlement[], loans: Loan[]): string {
  const theirBills = expenses.filter((e) => e.person_id === p.id && e.paid_by === "friend").length;
  const myBills = expenses.filter((e) => e.person_id === p.id && e.paid_by !== "friend").length;
  const pays = settlements.filter((s) => s.person_id === p.id).length;
  const ln = loans.filter((l) => l.person_id === p.id).length;
  if (!theirBills && !myBills && !pays && !ln) return `Delete ${p.name}?`;
  const parts: string[] = [];
  if (myBills) parts.push(`${myBills} bill${myBills === 1 ? "" : "s"} you paid will stay as normal personal expenses (full cost to you)`);
  if (theirBills) parts.push(`${theirBills} bill${theirBills === 1 ? "" : "s"} ${p.name} paid will be deleted`);
  if (pays) parts.push(`${pays} payment${pays === 1 ? "" : "s"} with ${p.name} will be deleted`);
  if (ln) parts.push(`${ln} loan${ln === 1 ? "" : "s"} with ${p.name} will be deleted`);
  return `Delete ${p.name}?\n\n${parts.join(".\n")}.\n\nThis cannot be undone.`;
}
