-- Test del trigger de task_assigned. Correr en el SQL Editor de Supabase.
--
-- Usa dos perfiles REALES del equipo en vez de fabricar filas en auth.users: esa
-- tabla es de Supabase, sus columnas NOT NULL cambian entre versiones, y un test
-- que se rompe solo cada upgrade no sirve de nada.
--
-- Todo va dentro de una transacción con ROLLBACK: no persiste nada y Realtime no
-- difunde nada, porque una transacción abortada nunca llega al WAL.

begin;

do $$
declare
  a_uid uuid; a_aid text;
  b_uid uuid; b_aid text;
  tid   bigint := 999000001;
  c     integer;
begin
  select id, alice_id into a_uid, a_aid
    from public.user_profiles where alice_id is not null order by alice_id limit 1;
  select id, alice_id into b_uid, b_aid
    from public.user_profiles where alice_id is not null and alice_id <> a_aid order by alice_id limit 1;
  if a_uid is null or b_uid is null then
    raise exception 'Se necesitan al menos 2 filas con alice_id en user_profiles';
  end if;

  -- (a) Asignar genera una notificación con el recipient resuelto desde alice_id
  insert into public.tasks (id, title, assignee, assignees, space, status)
  values (tid, 'Tarea de prueba', a_aid, jsonb_build_array(a_aid), 'hq', 'pendiente');

  select count(*) into c from public.notifications
   where deep_link = '#/task/' || tid and kind = 'task_assigned' and recipient = a_uid;
  if c <> 1 then raise exception 'FALLA (a): se generaron % notificaciones, se esperaba 1', c; end if;

  -- (b) Editar OTRO campo no vuelve a notificar (db.upsertTask reescribe la fila
  --     completa en cada cambio, así que sin el diff OLD/NEW esto renotificaría).
  --     El update toca `assignees` (reescribiéndolo con el mismo valor) para que
  --     el trigger `update of assignees` sí dispare — si solo tocáramos `title`,
  --     Postgres ni siquiera llamaría a la función, y la aserción de abajo
  --     pasaría por las reglas de disparo del trigger, no por el diff OLD/NEW
  --     que este caso dice estar probando.
  update public.tasks set title = 'Tarea de prueba editada', assignees = assignees where id = tid;

  select count(*) into c from public.notifications where deep_link = '#/task/' || tid;
  if c <> 1 then raise exception 'FALLA (b): editar el título renotificó (% filas)', c; end if;

  -- (c) Sumar un asignado nuevo notifica solo al nuevo
  update public.tasks set assignees = jsonb_build_array(a_aid, b_aid) where id = tid;

  select count(*) into c from public.notifications
   where deep_link = '#/task/' || tid and recipient = b_uid;
  if c <> 1 then raise exception 'FALLA (c): no se notificó al asignado nuevo'; end if;

  select count(*) into c from public.notifications
   where deep_link = '#/task/' || tid and recipient = a_uid;
  if c <> 1 then raise exception 'FALLA (c): se renotificó al que ya estaba (% filas)', c; end if;

  raise notice 'OK: trigger task_assigned pasa (a), (b) y (c)';
end $$;

rollback;
