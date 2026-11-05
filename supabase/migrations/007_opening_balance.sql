-- Kharcha migration 007. Safe to run more than once. Run AFTER 006.
-- One optional number per user: the money you already had when you started using the app.
create table if not exists account_settings (
  user_id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  opening_balance numeric(14,2) not null default 0,
  updated_at      timestamptz not null default now()
);
alter table account_settings enable row level security;
drop policy if exists "own rows" on account_settings;
create policy "own rows" on account_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
