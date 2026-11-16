-- Kharcha migration 008. Safe to run more than once. Run AFTER 007.
-- Company claims can now be paid back in parts (half now, half later). Each part is a row here.
-- Claims already marked as received are converted into one row each, so nothing changes for them.
create table if not exists claim_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expense_id  uuid not null references expenses(id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  note        text not null default '',
  received_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists claim_payments_expense_idx on claim_payments (expense_id);
alter table claim_payments enable row level security;
drop policy if exists "own rows" on claim_payments;
create policy "own rows" on claim_payments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into claim_payments (user_id, expense_id, amount, received_on)
select e.user_id, e.id, e.amount, e.reimbursed_at
from expenses e
where e.split = 'reimbursable' and e.reimbursed_at is not null
  and not exists (select 1 from claim_payments c where c.expense_id = e.id);
