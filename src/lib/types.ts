export type SplitType = "personal" | "split" | "owed_by_friend" | "reimbursable";
export type LoanDirection = "gave" | "borrowed";
export type PaidBy = "me" | "friend";
export type PayDirection = "received" | "paid";

export interface Category { id: string; name: string; icon: string; color: string; archived: boolean }
export interface Income { id: string; amount: number; note: string; received_on: string }
export interface SpendTarget { id: string; name: string }
export interface Person { id: string; name: string; is_roommate: boolean }
export interface Expense {
  id: string; category_id: string | null; amount: number; note: string; spent_on: string;
  split: SplitType; person_id: string | null; friend_share: number; paid_by: PaidBy; target_id: string | null; reviewed: boolean;
  reimbursable_from: string; reimbursed_at: string | null; created_at: string;
}
export interface Loan { id: string; person_id: string; direction: LoanDirection; amount: number; note: string; loan_date: string }
export interface LoanPayment { id: string; loan_id: string; amount: number; note: string; paid_on: string }
export interface Settlement { id: string; person_id: string; amount: number; note: string; paid_on: string; direction: PayDirection }

export interface SettlementAllocation { id: string; settlement_id: string; expense_id: string; amount: number }

export type ExpenseInput = Omit<Expense, "id" | "created_at">;
