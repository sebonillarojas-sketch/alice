-- Trigger de notificación por asignación de tarea.
-- Correr en el SQL Editor de Supabase. Idempotente.
--
-- Por qué un trigger y no JavaScript en el ERP: así notifica CUALQUIER origen del
-- cambio — el ERP en Chrome, la app de escritorio de otra persona, Alicia, o una
-- edición a mano en el panel de Supabase. Si la lógica viviera en el cliente, solo
-- notificarían los cambios hechos desde ese cliente y el resto se perdería en silencio.

create or replace function public.notify_task_assigned()
returns trigger
language plpgsql
security definer            -- necesario: `authenticated` no tiene insert en notifications
set search_path = public
as $$
declare
  nuevos jsonb;
  aid    text;
  uid    uuid;
  actor  uuid := auth.uid();
begin
  if TG_OP = 'INSERT' then
    nuevos := coalesce(NEW.assignees, '[]'::jsonb);
  else
    -- Solo los que NO estaban antes. `db.upsertTask` reescribe la fila completa en
    -- cada cambio, así que sin este diff editar el título renotificaría a todos.
    select coalesce(jsonb_agg(v), '[]'::jsonb) into nuevos
    from jsonb_array_elements_text(coalesce(NEW.assignees, '[]'::jsonb)) v
    where not (coalesce(OLD.assignees, '[]'::jsonb) ? v);
  end if;

  for aid in select jsonb_array_elements_text(nuevos) loop
    select id into uid from public.user_profiles where alice_id = aid;
    if uid is null then continue; end if;          -- alice_id sin perfil: se ignora
    if actor is not null and uid = actor then continue; end if;  -- no autonotificarse

    insert into public.notifications (recipient, kind, title, body, deep_link, urgency, source)
    values (uid, 'task_assigned', 'Nueva tarea asignada', NEW.title, '#/task/' || NEW.id, 'now', 'erp');
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_task_assigned on public.tasks;

create trigger trg_notify_task_assigned
after insert or update of assignees on public.tasks
for each row execute function public.notify_task_assigned();
