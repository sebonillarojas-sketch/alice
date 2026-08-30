-- Test de notify_due_tasks(). Correr en el SQL Editor. ROLLBACK al final.
-- Usa un perfil real del equipo, por la misma razón que el test del trigger.

begin;

do $$
declare
  uid uuid; aid text;
  hoy text := to_char((now() at time zone 'America/Lima')::date, 'YYYY-MM-DD');
  n   integer;
  c   integer;
begin
  select id, alice_id into uid, aid
    from public.user_profiles where alice_id is not null order by alice_id limit 1;
  if uid is null then raise exception 'Se necesita al menos 1 fila con alice_id en user_profiles'; end if;

  -- Vence hoy y está abierta → debe notificar
  insert into public.tasks (id, title, assignee, assignees, space, status, due)
  values (999000002, 'Vence hoy', aid, jsonb_build_array(aid), 'hq', 'pendiente', hoy);

  -- Vence hoy pero está completada → NO debe notificar
  insert into public.tasks (id, title, assignee, assignees, space, status, due)
  values (999000003, 'Vence hoy pero cerrada', aid, jsonb_build_array(aid), 'hq', 'completada', hoy);

  -- `due` con texto libre → NO debe notificar ni romper (la columna es texto y el
  -- usuario escribe lo que quiera; parseDate() en el frontend descarta esto igual)
  insert into public.tasks (id, title, assignee, assignees, space, status, due)
  values (999000004, 'Sin fecha real', aid, jsonb_build_array(aid), 'hq', 'pendiente', '—');

  n := public.notify_due_tasks();
  if n <> 1 then raise exception 'FALLA (a): insertó % filas, se esperaba 1', n; end if;

  select count(*) into c from public.notifications
   where deep_link = '#/task/999000002' and kind = 'task_due' and recipient = uid;
  if c <> 1 then raise exception 'FALLA (a): no se notificó la tarea que vence hoy'; end if;

  -- (b) Idempotencia: correrlo de nuevo el mismo día no duplica
  n := public.notify_due_tasks();
  if n <> 0 then raise exception 'FALLA (b): la segunda corrida insertó % filas, se esperaba 0', n; end if;

  raise notice 'OK: notify_due_tasks pasa (a) y (b)';
end $$;

rollback;
