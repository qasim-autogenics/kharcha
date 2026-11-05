-- Removes everything dec2026_test_data.sql added (and nothing else). Run in the Supabase SQL editor.
do $$
declare v_uid uuid := (select id from auth.users where email = 'qasimautogenics@gmail.com');
begin
  delete from settlements        where user_id = v_uid and note like '[TEST]%';   -- its bill ticks go with it
  delete from loan_payments      where user_id = v_uid and note like '[TEST]%';
  delete from loans              where user_id = v_uid and note like '[TEST]%';
  delete from incomes            where user_id = v_uid and note like '[TEST]%';
  delete from expenses           where user_id = v_uid and note like '[TEST]%';
  delete from people             where user_id = v_uid and name in ('Test Ali','Test Bilal','Test Chand');
end $$;
