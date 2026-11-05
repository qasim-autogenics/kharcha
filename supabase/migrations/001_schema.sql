-- Kharcha schema. Run in Supabase SQL editor (or `supabase db push`).
-- Design rules:
--   * Nothing is ever hard-deleted for money records: loans stay forever, repayments are separate rows.
--   * Every table is owned by auth.uid() and protected by RLS.
--   * Grok only ever sees the v_* views (security_invoker => RLS still applies).

create extension if not exists pgcrypto;

-- ───────────── enums ─────────────
do $$ begin
  create type split_type as enum ('personal', 'split', 'owed_by_friend', 'reimbursable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type loan_direction as enum ('gave', 'borrowed');
exception when duplicate_object then null; end $$;

-- ───────────── tables ─────────────
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  icon       text not null default '🏷️',
  color      text not null default '#64748b',
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists people (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  is_roommate boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- split semantics (amount = what you paid in total):
--   personal       : all yours, friend_share = 0
--   split          : friend owes friend_share (default 50% of amount, editable)
--   owed_by_friend : friend owes the full amount (friend_share = amount)
--   reimbursable   : someone else (e.g. company) will pay you back; tracked separately, NOT part of friend split
create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id  uuid references categories(id) on delete set null,
  amount       numeric(14,2) not null check (amount > 0),
  note         text not null default '',
  spent_on     date not null default current_date,
  split        split_type not null default 'personal',
  person_id    uuid references people(id) on delete set null,   -- the friend for split / owed_by_friend
  friend_share numeric(14,2) not null default 0 check (friend_share >= 0),
  reimbursable_from text not null default '',                   -- e.g. "Company" for reimbursable
  reimbursed_at date,                                           -- set when the reimbursement arrived
  created_at   timestamptz not null default now(),
  check (friend_share <= amount),
  check (split in ('personal','reimbursable') or person_id is not null),
  check (split <> 'personal' or friend_share = 0)
);
create index if not exists expenses_user_date_idx on expenses (user_id, spent_on desc);
create index if not exists expenses_person_idx on expenses (person_id) where friend_share > 0;

-- Loans: a loan is a permanent record. Repayments never remove it.
create table if not exists loans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id  uuid not null references people(id) on delete restrict,
  direction  loan_direction not null default 'gave',
  amount     numeric(14,2) not null check (amount > 0),
  note       text not null default '',
  loan_date  date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists loans_user_idx on loans (user_id, loan_date desc);

create table if not exists loan_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  loan_id    uuid not null references loans(id) on delete restrict,
  amount     numeric(14,2) not null check (amount > 0),
  note       text not null default '',
  paid_on    date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists loan_payments_loan_idx on loan_payments (loan_id);

-- Roommate settlements: money the friend actually paid you toward the split expenses.
create table if not exists settlements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_id  uuid not null references people(id) on delete restrict,
  amount     numeric(14,2) not null check (amount > 0),
  note       text not null default '',
  paid_on    date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists settlements_person_idx on settlements (person_id, paid_on desc);

-- ───────────── guard: loan repayments cannot exceed what is outstanding ─────────────
create or replace function check_loan_payment() returns trigger
language plpgsql as $$
declare v_amount numeric; v_paid numeric;
begin
  select amount into v_amount from loans where id = new.loan_id;
  select coalesce(sum(amount), 0) into v_paid from loan_payments
   where loan_id = new.loan_id and id is distinct from new.id;
  if v_paid + new.amount > v_amount then
    raise exception 'Repayment exceeds outstanding loan balance (% outstanding)', v_amount - v_paid;
  end if;
  return new;
end $$;

drop trigger if exists trg_check_loan_payment on loan_payments;
create trigger trg_check_loan_payment before insert or update on loan_payments
for each row execute function check_loan_payment();

-- ───────────── RLS ─────────────
do $$
declare t text;
begin
  foreach t in array array['categories','people','expenses','loans','loan_payments','settlements'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ───────────── seed default categories for new users ─────────────
create or replace function seed_default_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into categories (user_id, name, icon, color) values
    (new.id, 'Food',          '🍔', '#f97316'),
    (new.id, 'Transport',     '🚌', '#3b82f6'),
    (new.id, 'Groceries',     '🛒', '#22c55e'),
    (new.id, 'Bills',         '💡', '#eab308'),
    (new.id, 'Rent',          '🏠', '#8b5cf6'),
    (new.id, 'Shopping',      '🛍️', '#ec4899'),
    (new.id, 'Health',        '💊', '#ef4444'),
    (new.id, 'Entertainment', '🎬', '#06b6d4'),
    (new.id, 'Other',         '🏷️', '#64748b')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_seed_categories on auth.users;
create trigger trg_seed_categories after insert on auth.users
for each row execute function seed_default_categories();

-- ───────────── analytics views (security_invoker => caller's RLS applies) ─────────────
create or replace view v_expenses with (security_invoker = true) as
select e.id,
       e.spent_on,
       date_trunc('month', e.spent_on)::date as month,
       e.amount,
       coalesce(c.name, 'Uncategorized')     as category,
       e.note,
       e.split::text                         as split,
       p.name                                as friend,
       e.friend_share,
       (e.amount - e.friend_share)           as my_share,
       e.reimbursable_from,
       e.reimbursed_at
from expenses e
left join categories c on c.id = e.category_id
left join people p on p.id = e.person_id;

create or replace view v_loans with (security_invoker = true) as
select l.id,
       p.name                                         as person,
       l.direction::text                              as direction,
       l.amount,
       coalesce(sum(lp.amount), 0)                    as repaid,
       l.amount - coalesce(sum(lp.amount), 0)         as outstanding,
       case when l.amount - coalesce(sum(lp.amount), 0) = 0 then 'settled'
            when coalesce(sum(lp.amount), 0) > 0 then 'partial' else 'open' end as status,
       l.loan_date,
       l.note
from loans l
join people p on p.id = l.person_id
left join loan_payments lp on lp.loan_id = l.id
group by l.id, p.name;

create or replace view v_settlements with (security_invoker = true) as
select s.id, p.name as friend, s.amount, s.paid_on, s.note
from settlements s join people p on p.id = s.person_id;

-- Per friend: total they owe from split expenses vs total they paid back.
create or replace view v_friend_balance with (security_invoker = true) as
select p.name as friend,
       coalesce((select sum(friend_share) from expenses e where e.person_id = p.id), 0)  as total_owed,
       coalesce((select sum(amount) from settlements s where s.person_id = p.id), 0)      as total_paid,
       coalesce((select sum(friend_share) from expenses e where e.person_id = p.id), 0)
     - coalesce((select sum(amount) from settlements s where s.person_id = p.id), 0)      as balance
from people p;

grant select on v_expenses, v_loans, v_settlements, v_friend_balance to authenticated;

-- ───────────── safe read-only query runner used by the ask-grok Edge Function ─────────────
-- SECURITY INVOKER: runs as the logged-in user, so RLS limits it to their own rows.
-- Defence in depth (the Edge Function also validates): single SELECT only, only v_* views,
-- read-only transaction, short timeout, row cap.
create or replace function run_readonly_query(q text) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  cleaned text := btrim(regexp_replace(q, ';\s*$', ''));
  -- scan = query with string literals blanked and EXTRACT(x FROM ..)/DISTINCT FROM neutralised,
  -- so keyword/relation checks don't trip on harmless text.
  scan text;
  result jsonb;
begin
  scan := regexp_replace(cleaned, '''[^'']*''', '''''', 'g');
  scan := regexp_replace(scan, '(extract\s*\(\s*\w+\s+|distinct\s+)from', '\1_', 'gi');
  if scan !~* '^\s*select\s' then
    raise exception 'Only SELECT queries are allowed (no WITH/CTEs)';
  end if;
  if scan ~ ';' then
    raise exception 'Multiple statements are not allowed';
  end if;
  if scan ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|execute|set|reset|vacuum|listen|notify)\M' then
    raise exception 'Query contains a disallowed keyword';
  end if;
  if scan ~* '(pg_|information_schema|auth\.|set_config)' then
    raise exception 'Query references a disallowed schema';
  end if;
  if scan ~* '\m(expenses|categories|people|loans|loan_payments|settlements|users)\M' then
    raise exception 'Base tables are not queryable; use the v_* views';
  end if;
  if scan ~* '\m(from|join)\s+(?!v_expenses\M|v_loans\M|v_settlements\M|v_friend_balance\M|\()' then
    raise exception 'Only the v_expenses, v_loans, v_settlements and v_friend_balance views can be queried';
  end if;

  set local transaction read only;
  set local statement_timeout = '4000';
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) q limit 200) t', cleaned)
    into result;
  return result;
end $$;

revoke all on function run_readonly_query(text) from public, anon;
grant execute on function run_readonly_query(text) to authenticated;
