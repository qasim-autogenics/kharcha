-- Kharcha migration 005. Safe to run more than once. Run AFTER 004.
-- expenses.reviewed: imported entries start as unreviewed so you can sort out splits/claims one by one.
-- Everything that already exists (and every normal entry) is reviewed = true.
alter table expenses add column if not exists reviewed boolean not null default true;
create index if not exists expenses_unreviewed_idx on expenses (user_id) where reviewed = false;
