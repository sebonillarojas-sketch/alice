-- ALICE · Row Level Security para sync cross-usuario
-- ────────────────────────────────────────────────────────────────────────────
-- PROBLEMA (18 jul 2026): las tareas creadas por un usuario no le aparecían a
-- otro (ni a sí mismo en otra sesión) — solo llegaba la notificación. Causa raíz:
-- las notificaciones viajan por la tabla `app_state` y las tareas por la tabla
-- `tasks`; con las policies actuales, el rol autenticado no podía leer/escribir
-- filas de otros, así que la tarea nunca se propagaba. La notificación "colaba"
-- por caminos distintos, dando la ilusión de que algo llegaba.
--
-- ESTE ARCHIVO abre lectura/escritura a CUALQUIER miembro autenticado del equipo
-- sobre las tablas compartidas del ERP. Es lo correcto para un ERP interno donde
-- todo el equipo comparte tareas, terrenos y estado del cockpit. (No es apto para
-- multi-tenant público: ahí habría que filtrar por org/owner.)
--
-- CÓMO CORRERLO: Supabase Dashboard → SQL Editor → pegar todo → Run.
-- Es idempotente (drop policy if exists antes de crear). Seguro re-correrlo.
-- ────────────────────────────────────────────────────────────────────────────

-- ── tasks ───────────────────────────────────────────────────────────────────
alter table public.tasks enable row level security;

drop policy if exists "team_read_tasks"   on public.tasks;
drop policy if exists "team_insert_tasks" on public.tasks;
drop policy if exists "team_update_tasks" on public.tasks;
drop policy if exists "team_delete_tasks" on public.tasks;

create policy "team_read_tasks"   on public.tasks for select to authenticated using (true);
create policy "team_insert_tasks" on public.tasks for insert to authenticated with check (true);
create policy "team_update_tasks" on public.tasks for update to authenticated using (true) with check (true);
create policy "team_delete_tasks" on public.tasks for delete to authenticated using (true);

-- ── terrenos (Growth) ───────────────────────────────────────────────────────
alter table public.terrenos enable row level security;

drop policy if exists "team_read_terrenos"   on public.terrenos;
drop policy if exists "team_insert_terrenos" on public.terrenos;
drop policy if exists "team_update_terrenos" on public.terrenos;
drop policy if exists "team_delete_terrenos" on public.terrenos;

create policy "team_read_terrenos"   on public.terrenos for select to authenticated using (true);
create policy "team_insert_terrenos" on public.terrenos for insert to authenticated with check (true);
create policy "team_update_terrenos" on public.terrenos for update to authenticated using (true) with check (true);
create policy "team_delete_terrenos" on public.terrenos for delete to authenticated using (true);

-- ── app_state (mensajes, actividad/notificaciones, spaces, users, etc.) ──────
alter table public.app_state enable row level security;

drop policy if exists "team_read_app_state"   on public.app_state;
drop policy if exists "team_upsert_app_state"  on public.app_state;
drop policy if exists "team_update_app_state" on public.app_state;

create policy "team_read_app_state"   on public.app_state for select to authenticated using (true);
create policy "team_upsert_app_state"  on public.app_state for insert to authenticated with check (true);
create policy "team_update_app_state" on public.app_state for update to authenticated using (true) with check (true);

-- ── realtime · publicar `tasks` para la suscripción en vivo ─────────────────
-- Sin esto, db.subscribeTasks() se conecta pero nunca recibe eventos. Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

-- ── verificación rápida (opcional) ──────────────────────────────────────────
-- Después de correrlo, esto debería listar las policies creadas:
--   select tablename, policyname, cmd
--   from pg_policies
--   where tablename in ('tasks','terrenos','app_state')
--   order by tablename, cmd;
