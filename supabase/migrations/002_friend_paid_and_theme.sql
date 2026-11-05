-- Kharcha migration 002. Safe to run more than once. Run AFTER 001_schema.sql.
--   * friend-paid expenses (paid_by) incl. "I owe the whole thing"
--   * roommate payments in both directions (settlements.direction)
--   * category icons become icon keys (no emoji) + warm colour palette
--   * views updated for the Ask AI function

-- ───────────── friend-paid expenses ─────────────
-- paid_by = 'me'     : I paid the bill. friend_share = what the friend owes ME.
-- paid_by = 'friend' : the friend paid the bill. friend_share = the friend's OWN portion,
--                      so I owe the friend (amount - friend_share). friend_share = 0 means "I owe it all".
alter table expenses add column if not exists paid_by text not null default 'me'
  check (paid_by in ('me', 'friend'));

alter table expenses drop constraint if exists expenses_friend_paid_chk;
alter table expenses add constraint expenses_friend_paid_chk
  check (paid_by = 'me' or (split = 'split' and person_id is not null));

-- ───────────── payments in both directions ─────────────
-- 'received' = the friend paid me back, 'paid' = I paid the friend back.
alter table settlements add column if not exists direction text not null default 'received'
  check (direction in ('received', 'paid'));

-- ───────────── category icons: keys instead of emoji ─────────────
update categories set icon = case name
    when 'Food' then 'food'
    when 'Transport' then 'bus'
    when 'Groceries' then 'cart'
    when 'Bills' then 'bills'
    when 'Rent' then 'home'
    when 'Shopping' then 'bag'
    when 'Health' then 'heart'
    when 'Entertainment' then 'play'
    else 'tag' end
where icon !~ '^[a-z]+$';

update categories set color = case name
    when 'Food' then '#8a9a5b'
    when 'Transport' then '#a8764b'
    when 'Groceries' then '#d9a066'
    when 'Bills' then '#6b7f8c'
    when 'Rent' then '#7a5c45'
    when 'Shopping' then '#c9795f'
    when 'Health' then '#9b4a3a'
    when 'Entertainment' then '#b4472a'
    else '#a89886' end;

alter table categories alter column icon set default 'tag';
alter table categories alter column color set default '#a89886';

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
  return new;
end $$;

-- ───────────── views for analytics + Ask AI ─────────────
-- New columns are appended so CREATE OR REPLACE keeps working.
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
       case when e.paid_by = 'me' then e.amount else 0 end                          as paid_out_by_me
from expenses e
left join categories c on c.id = e.category_id
left join people p on p.id = e.person_id;

create or replace view v_settlements with (security_invoker = true) as
select s.id, p.name as friend, s.amount, s.paid_on, s.note, s.direction
from settlements s join people p on p.id = s.person_id;

-- balance > 0 : the friend owes me. balance < 0 : I owe the friend.
drop view if exists v_friend_balance;
create view v_friend_balance with (security_invoker = true) as
select p.name as friend,
       coalesce(sum(e.friend_owes_me), 0)  as friend_owes_me,
       coalesce(sum(e.i_owe_friend), 0)    as i_owe_friend,
       (select coalesce(sum(amount), 0) from settlements s where s.person_id = p.id and s.direction = 'received') as received,
       (select coalesce(sum(amount), 0) from settlements s where s.person_id = p.id and s.direction = 'paid')     as paid_to_friend,
       coalesce(sum(e.friend_owes_me), 0) - coalesce(sum(e.i_owe_friend), 0)
         - (select coalesce(sum(amount), 0) from settlements s where s.person_id = p.id and s.direction = 'received')
         + (select coalesce(sum(amount), 0) from settlements s where s.person_id = p.id and s.direction = 'paid') as balance
from people p
left join (
  select person_id,
         case when paid_by = 'me' then friend_share else 0 end as friend_owes_me,
         case when paid_by = 'friend' then amount - friend_share else 0 end as i_owe_friend
  from expenses where person_id is not null
) e on e.person_id = p.id
group by p.id, p.name;

grant select on v_expenses, v_loans, v_settlements, v_friend_balance to authenticated;
