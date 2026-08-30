-- Aislamiento RLS. Correr en el SQL Editor. Hace ROLLBACK: no deja nada.
begin;

do $$
declare
  a_uid uuid; b_uid uuid; c integer;
begin
  select id into a_uid from public.user_profiles order by alice_id limit 1;
  select id into b_uid from public.user_profiles where id <> a_uid order by alice_id limit 1;
  if b_uid is null then raise exception 'Se necesitan 2 filas en user_profiles'; end if;

  insert into public.notifications (recipient, kind, title, deep_link)
  values (b_uid, 'task_assigned', 'Solo para B', '#/task/1');

  -- Suplantar a A: rol authenticated + claim sub = uid de A.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a_uid, 'role', 'authenticated')::text, true);

  select count(*) into c from public.notifications where title = 'Solo para B';
  if c <> 0 then raise exception 'FALLA: A ve % filas de B — RLS no aísla', c; end if;

  raise notice 'OK: A no ve las notificaciones de B';
end $$;

rollback;
