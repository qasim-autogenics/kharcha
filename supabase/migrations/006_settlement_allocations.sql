-- Kharcha migration 006. Safe to run more than once. Run AFTER 005.
-- Ties part of a payment to the specific bills it settles, so each shared bill can show Settled / Rs X left.
-- Payments made before this migration stay valid: the app applies them to the oldest bills automatically.
create table if not exists settlement_allocations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  settlement_id uuid not null references settlements(id) on delete cascade,
  expense_id    uuid not null references expenses(id)    on delete cascade,
  amount        numeric(14,2) not null check (amount > 0),
  created_at    timestamptz not null default now()
);
create index if not exists settlement_alloc_expense_idx on settlement_allocations (expense_id);
create index if not exists settlement_alloc_settlement_idx on settlement_allocations (settlement_id);
alter table settlement_allocations enable row level security;
drop policy if exists "own rows" on settlement_allocations;
create policy "own rows" on settlement_allocations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
