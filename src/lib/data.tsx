import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { IMPORT_ICON_HINTS } from "./config";
import type { ImportRow } from "./monefy";
import type { Category, Expense, ExpenseInput, Loan, LoanDirection, LoanPayment, PayDirection, Person, Settlement, SettlementAllocation, SpendTarget, Income } from "./types";

interface DataCtx {
  loading: boolean;
  error: string | null;
  categories: Category[];
  people: Person[];
  expenses: Expense[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  settlements: Settlement[];
  allocations: SettlementAllocation[];
  incomes: Income[];
  targets: SpendTarget[];
  budget: number | null;
  roommate: Person | undefined;
  refresh: () => Promise<void>;
  addIncome: (v: { amount: number; note: string; received_on: string }) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  markReviewed: (ids: string[]) => Promise<void>;
  importRows: (rows: ImportRow[]) => Promise<{ expenses: number; incomes: number; newCategories: number }>;
  addTarget: (name: string) => Promise<SpendTarget>;
  removeTarget: (id: string) => Promise<void>;
  setBudget: (monthly: number | null) => Promise<void>;
  saveExpense: (input: ExpenseInput, id?: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  markReimbursed: (id: string, date: string | null) => Promise<void>;
  addPerson: (name: string, isRoommate?: boolean) => Promise<Person>;
  setRoommate: (id: string) => Promise<void>;
  addCategory: (name: string, icon: string) => Promise<Category>;
  archiveCategory: (id: string, archived: boolean) => Promise<void>;
  addLoan: (v: { person_id: string; direction: LoanDirection; amount: number; note: string; loan_date: string }) => Promise<void>;
  addLoanPayment: (v: { loan_id: string; amount: number; note: string; paid_on: string }) => Promise<void>;
  openingBalance: number;
  updateLoan: (id: string, v: { amount: number; note: string; loan_date: string }) => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  updateLoanPayment: (id: string, v: { amount: number; note: string; paid_on: string }) => Promise<void>;
  deleteLoanPayment: (id: string) => Promise<void>;
  updateSettlement: (id: string, v: { amount: number; note: string; paid_on: string; direction: PayDirection }) => Promise<void>;
  deleteSettlement: (id: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  setCategoryIcon: (id: string, icon: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  setOpeningBalance: (v: number) => Promise<void>;
  addSettlement: (v: { person_id: string; amount: number; note: string; paid_on: string; direction: PayDirection }, allocs?: { expense_id: string; amount: number }[]) => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);
export const useData = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData outside DataProvider");
  return c;
};

// numeric columns arrive as strings from PostgREST for numeric(14,2)
const num = (v: unknown) => Number(v ?? 0);
const normExpense = (r: any): Expense => ({ ...r, amount: num(r.amount), friend_share: num(r.friend_share), paid_by: r.paid_by ?? "me", target_id: r.target_id ?? null, reviewed: r.reviewed ?? true });
const normLoan = (r: any): Loan => ({ ...r, amount: num(r.amount) });
const normPay = (r: any): LoanPayment => ({ ...r, amount: num(r.amount) });
const normSettle = (r: any): Settlement => ({ ...r, amount: num(r.amount), direction: r.direction ?? "received" });

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [allocations, setAllocations] = useState<SettlementAllocation[]>([]);
  const [openingBalance, setOpeningState] = useState(0);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [targets, setTargets] = useState<SpendTarget[]>([]);
  const [budget, setBudgetState] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [c, p, e, l, lp, s, b, t, inc] = await Promise.all([
        supabase.from("categories").select("id,name,icon,color,archived").order("name"),
        supabase.from("people").select("id,name,is_roommate").order("name"),
        supabase.from("expenses").select("*").order("spent_on", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("loans").select("*").order("loan_date", { ascending: false }),
        supabase.from("loan_payments").select("*").order("paid_on", { ascending: false }),
        supabase.from("settlements").select("*").order("paid_on", { ascending: false }),
        supabase.from("budgets").select("monthly").maybeSingle(),
        supabase.from("spend_targets").select("id,name").order("created_at"),
        supabase.from("incomes").select("*").order("received_on", { ascending: false }),
      ]);
      // Tolerant on purpose: before migration 006 is run this table does not exist and the app must still work.
      const al = await supabase.from("settlement_allocations").select("id,settlement_id,expense_id,amount");
      setAllocations(al.error ? [] : (al.data ?? []).map((r: any) => ({ ...r, amount: num(r.amount) })));
      const ob = await supabase.from("account_settings").select("opening_balance").maybeSingle();
      setOpeningState(ob.error || !ob.data ? 0 : num((ob.data as { opening_balance: unknown }).opening_balance));
      const firstErr = [c, p, e, l, lp, s, b, t, inc].find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      setCategories(c.data as Category[]);
      setPeople(p.data as Person[]);
      setExpenses((e.data ?? []).map(normExpense));
      setLoans((l.data ?? []).map(normLoan));
      setLoanPayments((lp.data ?? []).map(normPay));
      setSettlements((s.data ?? []).map(normSettle));
      setIncomes((inc.data ?? []).map((r: any) => ({ ...r, amount: num(r.amount) })));
      setTargets((t.data ?? []) as SpendTarget[]);
      setBudgetState(b.data ? num((b.data as { monthly: unknown }).monthly) : null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Every write: throw on error (callers show it), then reload so the UI is always server truth.
  const run = useCallback(async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: e } = await p;
    if (e) throw new Error(e.message);
    await refresh();
  }, [refresh]);

  const api = useMemo<DataCtx>(() => ({
    loading, error, categories, people, expenses, loans, loanPayments, settlements, allocations, incomes, targets, budget, openingBalance,
    roommate: people.find((p) => p.is_roommate),
    refresh,
    addIncome: (v) => run(supabase.from("incomes").insert(v)),
    deleteIncome: (id) => run(supabase.from("incomes").delete().eq("id", id)),
    markReviewed: (ids) => run(supabase.from("expenses").update({ reviewed: true }).in("id", ids)),
    importRows: async (rows) => {
      // read the live category list, not React state: a failed earlier attempt may already have created some
      const live = await supabase.from("categories").select("id,name");
      if (live.error) throw new Error(live.error.message);
      const byName = new Map((live.data ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id]));
      const missing = [...new Set(rows.filter((r) => r.kind === "expense").map((r) => r.category))].filter((n) => !byName.has(n.toLowerCase()));
      if (missing.length) {
        const { data, error: e } = await supabase.from("categories")
          .insert(missing.map((name) => ({ name, icon: IMPORT_ICON_HINTS[name.toLowerCase()] ?? "tag" }))).select("id,name");
        if (e) throw new Error(e.message);
        for (const c of data ?? []) byName.set((c as { name: string }).name.toLowerCase(), (c as { id: string }).id);
      }
      const expenseRows = rows.filter((r) => r.kind === "expense").map((r) => ({
        amount: r.amount, category_id: byName.get(r.category.toLowerCase()) ?? null, note: r.note, spent_on: r.date,
        split: "personal", person_id: null, friend_share: 0, paid_by: "me", reimbursable_from: "", reimbursed_at: null, target_id: null, reviewed: false,
      }));
      const incomeRows = rows.filter((r) => r.kind === "income").map((r) => ({ amount: r.amount, note: r.note || r.category, received_on: r.date }));
      const CHUNK = 100; // keeps each request small
      try {
        for (let i = 0; i < expenseRows.length; i += CHUNK) {
          const { error: e } = await supabase.from("expenses").insert(expenseRows.slice(i, i + CHUNK));
          if (e) throw new Error(e.message);
        }
        for (let i = 0; i < incomeRows.length; i += CHUNK) {
          const { error: e } = await supabase.from("incomes").insert(incomeRows.slice(i, i + CHUNK));
          if (e) throw new Error(e.message);
        }
      } finally { await refresh(); } // keep the UI true to the server even if a batch failed
      return { expenses: expenseRows.length, incomes: incomeRows.length, newCategories: missing.length };
    },
    addTarget: async (name) => {
      const { data, error: e } = await supabase.from("spend_targets").insert({ name: name.trim() }).select("id,name").single();
      if (e) throw new Error(e.message);
      await refresh();
      return data as SpendTarget;
    },
    removeTarget: (id) => run(supabase.from("spend_targets").delete().eq("id", id)),
    setBudget: (monthly) => monthly === null || monthly <= 0
      ? run(supabase.from("budgets").delete().not("user_id", "is", null))
      : run(supabase.from("budgets").upsert({ monthly }, { onConflict: "user_id" })),
    saveExpense: (input, id) =>
      run(id ? supabase.from("expenses").update(input).eq("id", id) : supabase.from("expenses").insert(input)),
    deleteExpense: (id) => run(supabase.from("expenses").delete().eq("id", id)),
    markReimbursed: (id, date) => run(supabase.from("expenses").update({ reimbursed_at: date }).eq("id", id)),
    addPerson: async (name, isRoommate = false) => {
      const { data, error: e } = await supabase.from("people").insert({ name: name.trim(), is_roommate: isRoommate }).select("id,name,is_roommate").single();
      if (e) throw new Error(e.message);
      await refresh();
      return data as Person;
    },
    setRoommate: async (id) => {
      // only one roommate at a time
      const clear = await supabase.from("people").update({ is_roommate: false }).eq("is_roommate", true);
      if (clear.error) throw new Error(clear.error.message);
      await run(supabase.from("people").update({ is_roommate: true }).eq("id", id));
    },
    addCategory: async (name, icon) => {
      const { data, error: e } = await supabase.from("categories").insert({ name: name.trim(), icon: icon || "tag" }).select("id,name,icon,color,archived").single();
      if (e) throw new Error(e.message);
      await refresh();
      return data as Category;
    },
    archiveCategory: (id, archived) => run(supabase.from("categories").update({ archived }).eq("id", id)),
    addLoan: (v) => run(supabase.from("loans").insert(v)),
    addLoanPayment: (v) => run(supabase.from("loan_payments").insert(v)),
    updateLoan: (id, v) => run(supabase.from("loans").update(v).eq("id", id)),
    deleteLoan: async (id) => {
      // repayments are protected by a foreign key, so remove them first
      const { error: e1 } = await supabase.from("loan_payments").delete().eq("loan_id", id);
      if (e1) throw new Error(e1.message);
      await run(supabase.from("loans").delete().eq("id", id));
    },
    updateLoanPayment: (id, v) => run(supabase.from("loan_payments").update(v).eq("id", id)),
    deleteLoanPayment: (id) => run(supabase.from("loan_payments").delete().eq("id", id)),
    updateSettlement: async (id, v) => {
      // a changed payment no longer matches the bills it was tied to, so release them (the app re-applies it oldest first)
      await supabase.from("settlement_allocations").delete().eq("settlement_id", id);
      await run(supabase.from("settlements").update(v).eq("id", id));
    },
    deleteSettlement: (id) => run(supabase.from("settlements").delete().eq("id", id)), // its bill ticks are removed with it
    deletePerson: async (id) => {
      // 1) loans with this person (repayments first, they are protected by a foreign key)
      const { data: ls, error: e0 } = await supabase.from("loans").select("id").eq("person_id", id);
      if (e0) throw new Error(e0.message);
      const loanIds = (ls ?? []).map((l) => (l as { id: string }).id);
      if (loanIds.length) {
        const a = await supabase.from("loan_payments").delete().in("loan_id", loanIds); if (a.error) throw new Error(a.error.message);
        const b = await supabase.from("loans").delete().in("id", loanIds); if (b.error) throw new Error(b.error.message);
      }
      // 2) payments between you and them (their bill ticks go with them)
      const c = await supabase.from("settlements").delete().eq("person_id", id); if (c.error) throw new Error(c.error.message);
      // 3) bills they paid disappear; bills you paid become plain personal expenses at full cost
      const d = await supabase.from("expenses").delete().eq("person_id", id).eq("paid_by", "friend"); if (d.error) throw new Error(d.error.message);
      const f = await supabase.from("expenses").update({ person_id: null, split: "personal", friend_share: 0 }).eq("person_id", id); if (f.error) throw new Error(f.error.message);
      await run(supabase.from("people").delete().eq("id", id));
    },
    setCategoryIcon: (id, icon) => run(supabase.from("categories").update({ icon }).eq("id", id)),
    deleteCategory: (id) => run(supabase.from("categories").delete().eq("id", id)),     // expenses keep existing as Uncategorized
    setOpeningBalance: (v) => run(supabase.from("account_settings").upsert({ opening_balance: v }, { onConflict: "user_id" })),
    addSettlement: async (v, allocs = []) => {
      const { data, error: e } = await supabase.from("settlements").insert(v).select("id").single();
      if (e) throw new Error(e.message);
      const rows = allocs.filter((a) => a.amount > 0).map((a) => ({ settlement_id: (data as { id: string }).id, expense_id: a.expense_id, amount: a.amount }));
      if (rows.length) {
        const { error: e2 } = await supabase.from("settlement_allocations").insert(rows);
        if (e2) { await refresh(); throw new Error(`Payment saved, but marking bills failed: ${e2.message}. Run migration 006.`); }
      }
      await refresh();
    },
  }), [loading, error, categories, people, expenses, loans, loanPayments, settlements, allocations, incomes, targets, budget, openingBalance, categories, refresh, run]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
