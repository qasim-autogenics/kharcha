-- Kharcha: start fresh but keep ONLY November 2026.
-- Run in the Supabase SQL editor. Change v_email if needed.
-- STEP 1 = preview (changes nothing). STEP 2 = the delete (cannot be undone).
-- Keeps: categories, "Spent for" list, budget, starting balance, and everything dated 1–30 Nov 2026.
-- Deletes: all other expenses, income, friend payments, ALL loans + repayments, and people left with nothing.

-- ===================== STEP 1: PREVIEW (run this first, alone) =====================
with u as (select id from auth.users where email = 'qasimautogenics@gmail.com')
select 'expenses KEPT'      as what, count(*) from expenses, u where user_id = u.id and spent_on between '2026-11-01' and '2026-11-30'
union all select 'expenses DELETED',  count(*) from expenses, u where user_id = u.id and not (spent_on between '2026-11-01' and '2026-11-30')
union all select 'income KEPT',       count(*) from incomes, u where user_id = u.id and received_on between '2026-11-01' and '2026-11-30'
union all select 'income DELETED',    count(*) from incomes, u where user_id = u.id and not (received_on between '2026-11-01' and '2026-11-30')
union all select 'friend payments KEPT',    count(*) from settlements, u where user_id = u.id and paid_on between '2026-11-01' and '2026-11-30'
union all select 'friend payments DELETED', count(*) from settlements, u where user_id = u.id and not (paid_on between '2026-11-01' and '2026-11-30')
union all select 'loans DELETED (all)',     count(*) from loans, u where user_id = u.id;

-- ===================== STEP 2: DELETE (run only after the preview looks right) =====================
do $$
declare
  v_uid uuid := (select id from auth.users where email = 'qasimautogenics@gmail.com');
  v_from date := '2026-11-01';
  v_to   date := '2026-11-30';
begin
  if v_uid is null then raise exception 'User not found - check the email'; end if;

  delete from loan_payments where user_id = v_uid;                                   -- repayments first (protected by a foreign key)
  delete from loans         where user_id = v_uid;                                   -- every loan
  delete from settlements   where user_id = v_uid and not (paid_on between v_from and v_to);   -- its bill ticks go with it
  delete from expenses      where user_id = v_uid and not (spent_on between v_from and v_to);
  delete from incomes       where user_id = v_uid and not (received_on between v_from and v_to);
  -- people who now have no bills, payments or loans (keeps the roommate)
  delete from people p where p.user_id = v_uid and not p.is_roommate
    and not exists (select 1 from expenses    e where e.person_id = p.id)
    and not exists (select 1 from settlements s where s.person_id = p.id);
end $$;
