-- Notificación de vencimientos · corre una vez al día vía pg_cron.
-- Correr en el SQL Editor de Supabase. Idempotente.
--
-- Se usa pg_cron y no los crons del brain a propósito: mantiene la generación de
-- notificaciones dentro de Postgres (igual que el trigger) y evita necesitar el
-- puente de identidad del brain hacia user_profiles, que es trabajo de la Fase 3.
--
-- `tasks.due` es TEXTO LIBRE. El frontend lo interpreta con parseDate(), que solo
-- acepta lo que empieza con YYYY-MM-DD y descarta el resto ("—", texto suelto).
-- Acá se replica esa misma semántica para no inventar una interpretación distinta.

create or replace function public.notify_due_tasks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  hoy       text := to_char((now() at time zone 'America/Lima')::date, 'YYYY-MM-DD');
  inicio_dia timestamptz := date_trunc('day', now() at time zone 'America/Lima') at time zone 'America/Lima';
  n         integer := 0;
begin
  insert into public.notifications (recipient, kind, title, body, deep_link, urgency, source)
  select p.id, 'task_due', 'Tarea vence hoy', t.title, '#/task/' || t.id, 'now', 'erp'
  from public.tasks t
  join lateral jsonb_array_elements_text(coalesce(t.assignees, '[]'::jsonb)) a(alice_id) on true
  join public.user_profiles p on p.alice_id = a.alice_id
  where t.due ~ '^\d{4}-\d{2}-\d{2}'
    and left(t.due, 10) = hoy
    and coalesce(t.archived, false) = false
    and coalesce(t.checked,  false) = false
    and coalesce(t.status, 'pendiente') <> 'completada'
    -- Idempotencia por (tarea, destinatario, día): re-correr no duplica.
    and not exists (
      select 1 from public.notifications n2
      where n2.recipient  = p.id
        and n2.kind       = 'task_due'
        and n2.deep_link  = '#/task/' || t.id
        and n2.created_at >= inicio_dia
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Job diario a las 8:00 de Lima = 13:00 UTC (Perú no tiene horario de verano).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'notify-due-tasks') then
    perform cron.unschedule('notify-due-tasks');
  end if;
  perform cron.schedule('notify-due-tasks', '0 13 * * *', $cron$select public.notify_due_tasks()$cron$);
end $$;
