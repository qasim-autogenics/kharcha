-- Kharcha migration 003. Safe to run more than once. Run AFTER 002.
--   * spend_targets: the people/purposes you spend on (Myself, Family, Wife, ...), user-editable
--   * expenses.target_id -> spend_targets (null = "Myself")
--   * budgets: one monthly budget per user
--   * v_expenses gains spent_for (name); v_budget view for Ask AI
-- If you ran the earlier draft of 003 (fixed me/family column) it is converted automatically.

create table if not exists spend_targets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table spend_targets enable row level security;
drop policy if exists "own rows" on spend_targets;
create policy "own rows" on spend_targets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table expenses add column if not exists target_id uuid references spend_targets(id) on delete set null;

-- convert the earlier draft: spend_for = 'family' becomes a "Family" target
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'expenses' and column_name = 'spend_for') then
    insert into spend_targets (user_id, name)
      select distinct user_id, 'Family' from expenses where spend_for = 'family' on conflict do nothing;
    update expenses e set target_id = t.id
      from spend_targets t where t.user_id = e.user_id and t.name = 'Family' and e.spend_for = 'family';
    drop view if exists v_expenses;
    alter table expenses drop column spend_for;
  end if;
end $$;

-- everyone gets "Myself" and "Family" to start (existing users now, new users via the seed trigger)
insert into spend_targets (user_id, name)
  select id, n from auth.users, (values ('Myself'), ('Family')) v(n) on conflict do nothing;

create or replace function seed_default_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into categories (user_id, name, icon, color) values
    (new.id, 'Food',          'food',  '#8a9a5b'),
    (new.id, 'Transport',     'bus',   '#a8764b'),
    (new.id, 'Groceries',     'cart',  '#d9a066'),
    (new.id, 'Bills',         'bills', '#6b7f8c'),
    (new.id, 'Rent',          'home',  '#7a5c45'),
    (new.id, 'Shopping',      'bag',   '#c9795f'),
    (new.id, 'Health',        'heart', '#9b4a3a'),
    (new.id, 'Entertainment', 'play',  '#b4472a'),
    (new.id, 'Other',         'tag',   '#a89886')
  on conflict do nothing;
  insert into spend_targets (user_id, name) values (new.id, 'Myself'), (new.id, 'Family') on conflict do nothing;
  return new;
end $$;

create table if not exists budgets (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  monthly    numeric(14,2) not null check (monthly >= 0),
  updated_at timestamptz not null default now()
);
alter table budgets enable row level security;
drop policy if exists "own rows" on budgets;
create policy "own rows" on budgets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

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
       e.reimbursed_at,
       e.paid_by,
       case when e.split = 'reimbursable' then 0 else e.amount - e.friend_share end as my_cost,
       case when e.paid_by = 'me' then e.friend_share else 0 end                    as friend_owes_me,
       case when e.paid_by = 'friend' then e.amount - e.friend_share else 0 end     as i_owe_friend,
       case when e.paid_by = 'me' then e.amount else 0 end                          as paid_out_by_me,
       coalesce(t.name, 'Myself')            as spent_for
from expenses e
left join categories c on c.id = e.category_id
left join people p on p.id = e.person_id
left join spend_targets t on t.id = e.target_id;

create or replace view v_budget with (security_invoker = true) as select monthly from budgets;
grant select on v_expenses, v_budget to authenticated;

-- Ask AI runner: allow v_budget, block the new base tables.
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
  if scan ~* '\m(expenses|categories|people|loans|loan_payments|settlements|budgets|spend_targets|users)\M' then
    raise exception 'Base tables are not queryable; use the v_* views';
  end if;
  if scan ~* '\m(from|join)\s+(?!v_expenses\M|v_loans\M|v_settlements\M|v_friend_balance\M|v_budget\M|\()' then
    raise exception 'Only the v_expenses, v_loans, v_settlements, v_friend_balance and v_budget views can be queried';
  end if;

  set local transaction read only;
  set local statement_timeout = '4000';
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) q limit 200) t', cleaned)
    into result;
  return result;
end $$;

grant execute on function run_readonly_query(text) to authenticated;
