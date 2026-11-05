-- Kharcha TEST DATA for December 2026. Run in the Supabase SQL editor.
-- Everything it adds is marked so it can be removed with dec2026_cleanup.sql:
--   notes start with "[TEST]" and the three people are called "Test Ali", "Test Bilal", "Test Chand".
-- It does not touch your real entries. Safe to run once (running it twice duplicates the test rows; clean up first).
do $$
declare
  v_uid uuid := (select id from auth.users where email = 'qasimautogenics@gmail.com');
  ali uuid; bilal uuid; chand uuid;
  food uuid; transport uuid; bills uuid; gifts uuid; travel uuid;
  e_split uuid; e_chand uuid; s1 uuid; s2 uuid; l1 uuid; l2 uuid;
begin
  if v_uid is null then raise exception 'No user with that email'; end if;

  -- categories (reuse yours when they exist, add the missing ones)
  insert into categories (user_id, name, icon, color) values
    (v_uid,'Food','food','#a89886'),(v_uid,'Transport','bus','#a89886'),(v_uid,'Bills','bills','#a89886'),
    (v_uid,'Gifts','gift','#a89886'),(v_uid,'Travel','car','#a89886')
  on conflict (user_id, name) do nothing;
  select id into food      from categories where user_id = v_uid and name = 'Food';
  select id into transport from categories where user_id = v_uid and name = 'Transport';
  select id into bills     from categories where user_id = v_uid and name = 'Bills';
  select id into gifts     from categories where user_id = v_uid and name = 'Gifts';
  select id into travel    from categories where user_id = v_uid and name = 'Travel';

  -- three test friends (none is your roommate)
  insert into people (user_id, name, is_roommate) values (v_uid,'Test Ali',false),(v_uid,'Test Bilal',false),(v_uid,'Test Chand',false)
  on conflict (user_id, name) do nothing;
  select id into ali   from people where user_id = v_uid and name = 'Test Ali';
  select id into bilal from people where user_id = v_uid and name = 'Test Bilal';
  select id into chand from people where user_id = v_uid and name = 'Test Chand';

  -- expenses, December 2026
  insert into expenses (user_id, category_id, amount, note, spent_on, split, person_id, friend_share, paid_by, reimbursable_from, reimbursed_at) values
    (v_uid, food,      3000, '[TEST] lunch alone',               '2026-12-03', 'personal',       null,  0,    'me',     '',        null),
    (v_uid, transport, 1200, '[TEST] taxi',                      '2026-12-04', 'personal',       null,  0,    'me',     '',        null),
    (v_uid, food,      4000, '[TEST] dinner, Ali half',          '2026-12-05', 'split',          ali,   2000, 'me',     '',        null),
    (v_uid, bills,     6000, '[TEST] bill, Bilal half',          '2026-12-06', 'split',          bilal, 3000, 'me',     '',        null),
    (v_uid, food,      1800, '[TEST] Ali paid, half mine',       '2026-12-07', 'split',          ali,   900,  'friend', '',        null),
    (v_uid, gifts,     2500, '[TEST] Chand paid, I owe 2000',    '2026-12-08', 'split',          chand, 500,  'friend', '',        null),
    (v_uid, travel,   20000, '[TEST] company trip, still waiting','2026-12-09','reimbursable',   null,  0,    'me',     'Company', null),
    (v_uid, travel,    5000, '[TEST] company trip, repaid',      '2026-12-09', 'reimbursable',   null,  0,    'me',     'Company', '2026-12-10'),
    (v_uid, food,      1000, '[TEST] Ali owes all',              '2026-12-11', 'owed_by_friend', ali,   1000, 'me',     '',        null);
  select id into e_split from expenses where user_id = v_uid and note = '[TEST] dinner, Ali half';
  select id into e_chand from expenses where user_id = v_uid and note = '[TEST] Chand paid, I owe 2000';

  -- payments: Ali paid 1500 (tied to the dinner), I paid Chand 500 (tied to his bill), Bilal paid 1000 (not tied to a bill)
  insert into settlements (user_id, person_id, amount, note, paid_on, direction) values
    (v_uid, ali,   1500, '[TEST] Ali pays for dinner', '2026-12-12', 'received') returning id into s1;
  insert into settlements (user_id, person_id, amount, note, paid_on, direction) values
    (v_uid, chand,  500, '[TEST] I pay Chand part',    '2026-12-15', 'paid') returning id into s2;
  insert into settlements (user_id, person_id, amount, note, paid_on, direction) values
    (v_uid, bilal, 1000, '[TEST] Bilal pays part',     '2026-12-18', 'received');
  insert into settlement_allocations (user_id, settlement_id, expense_id, amount) values
    (v_uid, s1, e_split, 1500), (v_uid, s2, e_chand, 500);

  -- loans: I gave Bilal 10000 (2500 back), I borrowed 8000 from Chand (3000 repaid)
  insert into loans (user_id, person_id, direction, amount, note, loan_date) values
    (v_uid, bilal, 'gave',     10000, '[TEST] loan to Bilal',    '2026-12-02') returning id into l1;
  insert into loans (user_id, person_id, direction, amount, note, loan_date) values
    (v_uid, chand, 'borrowed',  8000, '[TEST] loan from Chand',  '2026-12-03') returning id into l2;
  insert into loan_payments (user_id, loan_id, amount, note, paid_on) values
    (v_uid, l1, 2500, '[TEST] Bilal returns part', '2026-12-20'),
    (v_uid, l2, 3000, '[TEST] I repay part',       '2026-12-22');

  insert into incomes (user_id, amount, note, received_on) values (v_uid, 50000, '[TEST] salary', '2026-12-01');
end $$;
