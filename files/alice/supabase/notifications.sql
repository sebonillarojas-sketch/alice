-- Tabla de notificaciones · Fase 1 de ALICE Desktop.
-- Correr en el SQL Editor de Supabase. Idempotente (se puede re-correr sin daño).
--
-- A diferencia de tasks/terrenos (cuyas policies son `using (true)` — todo el equipo
-- ve todo), esta tabla es POR DESTINATARIO: cada quien ve solo lo suyo. Y no lleva
-- policy de INSERT para `authenticated` a propósito: si un cliente pudiera insertar
-- filas dirigidas a otro, cualquiera podría fabricarle notificaciones a cualquiera.
-- Solo escriben las funciones `security definer` (trigger + cron) y el service role.

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient    uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('task_assigned','task_due')),
  title        text not null,
  body         text not null default '',
  deep_link    text not null default '',
  urgency      text not null default 'now' check (urgency in ('now','digest')),
  source       text not null default 'erp' check (source in ('erp','brain')),
  created_at   timestamptz not null default now(),
  delivered_at timestamptz,
  read_at      timestamptz
);

create index if not exists idx_notifications_recipient
  on public.notifications (recipient, created_at desc);

-- Índice parcial para la consulta de recuperación tras suspensión.
create index if not exists idx_notifications_undelivered
  on public.notifications (recipient)
  where delivered_at is null;

alter table public.notifications enable row level security;

drop policy if exists "own_read_notifications"   on public.notifications;
drop policy if exists "own_update_notifications" on public.notifications;

create policy "own_read_notifications" on public.notifications
  for select to authenticated using (auth.uid() = recipient);

-- Update acotado: el cliente marca delivered_at / read_at de SUS filas.
create policy "own_update_notifications" on public.notifications
  for update to authenticated
  using (auth.uid() = recipient) with check (auth.uid() = recipient);

-- Realtime necesita la tabla en la publicación. `replica identity full` hace que
-- los UPDATE lleguen con la fila completa (sin esto, el payload viene mocho).
alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;  -- ya estaba: re-correr no debe fallar
end $$;
