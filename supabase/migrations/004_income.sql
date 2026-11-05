-- Kharcha migration 004. Safe to run more than once. Run AFTER 003.
--   * incomes: money you receive (salary etc.), used for the account balance on the Overview page
--   * v_income view for Ask AI

create table if not exists incomes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount      numeric(14,2) not null check (amount > 0),
  note        text not null default '',
  received_on date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists incomes_user_date_idx on incomes (user_id, received_on desc);
alter table incomes enable row level security;
drop policy if exists "own rows" on incomes;
create policy "own rows" on incomes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace view v_income with (security_invoker = true) as
select id, received_on, date_trunc('month', received_on)::date as month, amount, note from incomes;
grant select on v_income to authenticated;

-- Ask AI runner: allow v_income, block the base table.
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
  if scan ~* '\m(expenses|categories|people|loans|loan_payments|settlements|budgets|spend_targets|incomes|users)\M' then
    raise exception 'Base tables are not queryable; use the v_* views';
  end if;
  if scan ~* '\m(from|join)\s+(?!v_expenses\M|v_loans\M|v_settlements\M|v_friend_balance\M|v_budget\M|v_income\M|\()' then
    raise exception 'Only the v_expenses, v_loans, v_settlements, v_friend_balance, v_budget and v_income views can be queried';
  end if;

  set local transaction read only;
  set local statement_timeout = '4000';
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) q limit 200) t', cleaned)
    into result;
  return result;
end $$;

grant execute on function run_readonly_query(text) to authenticated;
