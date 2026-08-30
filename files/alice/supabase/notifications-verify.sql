-- Verificación de la tabla notifications. Correr DESPUÉS de notifications.sql.
-- Lanza excepción con mensaje claro si algo falta. No modifica nada.

do $$
begin
  if not exists (select 1 from pg_tables where schemaname='public' and tablename='notifications') then
    raise exception 'FALTA: la tabla public.notifications no existe';
  end if;

  if not exists (select 1 from pg_tables where schemaname='public' and tablename='notifications' and rowsecurity) then
    raise exception 'FALTA: RLS no está habilitado en public.notifications';
  end if;

  if not exists (select 1 from pg_policies where tablename='notifications' and policyname='own_read_notifications') then
    raise exception 'FALTA: la policy own_read_notifications';
  end if;

  -- La que falla en silencio si no está (Riesgo R1 del spec).
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
  ) then
    raise exception 'FALTA: notifications no está en la publicación supabase_realtime — Realtime no entregará nada y NO dará error';
  end if;

  -- Que NO exista policy de insert para authenticated es parte del diseño.
  if exists (select 1 from pg_policies where tablename='notifications' and cmd='INSERT') then
    raise exception 'SOBRA: hay una policy de INSERT en notifications — cualquiera podría fabricar notificaciones ajenas';
  end if;

  raise notice 'OK: notifications creada, con RLS, sin insert público y publicada en Realtime';
end $$;
