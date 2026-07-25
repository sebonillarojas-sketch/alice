-- Multi-asignación de tareas (24 jul 2026)
-- Agrega `assignees` (array de user ids) a la tabla tasks. `assignee` (single)
-- se mantiene como asignado principal = assignees[0], para compat con el ERP
-- backend, Alicia y cualquier vista vieja.
--
-- Correr en el SQL Editor de Supabase (proyecto apnzitklhxrcszectbxx):

alter table public.tasks
  add column if not exists assignees jsonb not null default '[]'::jsonb;

-- Backfill: toda tarea con assignee pasa a assignees = [assignee]
update public.tasks
  set assignees = to_jsonb(array[assignee])
  where assignees = '[]'::jsonb and assignee is not null and assignee <> '';
