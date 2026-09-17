-- Aislamiento e invariantes del CRM. Correr en el SQL Editor. Hace ROLLBACK: no deja nada.
-- Requiere crm.sql corrido antes. Mismo patrón que notifications-rls-test.sql.
--
-- Qué se prueba, y por qué cada cosa:
--   1. `anon` no ve leads            — la anon key viaja HARDCODEADA en el bundle del
--                                      ERP (src/lib/supabase.js): si las policies no
--                                      fueran `to authenticated`, el CRM sería público.
--   2. El equipo autenticado ve todo — es el criterio de rls-policies.sql, distinto al
--                                      de notifications (que sí aísla por destinatario).
--   3. crm_eventos es append-only    — en las dos capas: RLS y trigger.
--   4. Sin evidencia no hay dato     — los CHECK del buyer persona y de temperatura.
--   5. Stock e ingesta sin duplicados.
--   6. `direccion` solo existe en los eventos de tipo mensaje.
--   7. La vista de Mica no tiene precios (y sí cuenta stock).
--   8. Un lead con historia se descarta, no se borra.
begin;

-- ── fixtures ────────────────────────────────────────────────────────────────
-- Ids fijos para que los bloques siguientes los encuentren sin compartir variables.
insert into public.crm_proyectos (id, nombre, distrito, estado)
values ('TEST-RLS-01', 'Proyecto de prueba', 'Test', 'preventa');

insert into public.crm_tipologias (id, proyecto_id, nombre, dormitorios, banos, m2,
                                   precio_desde, precio_hasta)
values ('00000000-0000-0000-0000-0000000000b1', 'TEST-RLS-01',
        'flat de prueba', 2, 2.0, 80.00, 100000, 120000);

insert into public.crm_unidades (proyecto_id, tipologia_id, numero, piso, m2, precio_lista, estado)
values ('TEST-RLS-01', '00000000-0000-0000-0000-0000000000b1',
        '301', 3, 80.00, 110000, 'disponible');

insert into public.crm_leads (id, canal, external_id, telefono, nombre, proyecto_id,
                              temperatura, temperatura_cita, etapa, alice_id)
values ('00000000-0000-0000-0000-0000000000a1', 'whatsapp', '+51999000111', '+51999000111',
        'Prospecto A', 'TEST-RLS-01', 'hot', 'me pasas los planos y el precio?',
        'handoff', 'jt');

insert into public.crm_eventos (lead_id, tipo, actor, texto, datos)
values ('00000000-0000-0000-0000-0000000000a1', 'temperatura', 'mica',
        'me pasas los planos y el precio?', '{"de":"tibio","a":"hot"}'::jsonb);


-- ── 1 · `anon` no ve nada del CRM ───────────────────────────────────────────
do $$
declare c integer;
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  select count(*) into c from public.crm_leads where id = '00000000-0000-0000-0000-0000000000a1';
  if c <> 0 then
    raise exception 'FALLA: anon ve % leads — la anon key está en el bundle del ERP', c;
  end if;

  select count(*) into c from public.crm_eventos;
  if c <> 0 then raise exception 'FALLA: anon ve % eventos', c; end if;

  raise notice 'OK 1: anon no ve leads ni eventos';
end $$;

reset role;

-- ── 2 · el equipo autenticado ve todo, sea suyo o no ────────────────────────
-- A diferencia de notifications, acá NO se aísla por dueño: si José está de viaje,
-- alguien tiene que poder abrir la ficha. `alice_id` es asignación, no permiso.
do $$
declare c integer;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);

  select count(*) into c from public.crm_leads where alice_id = 'jt';
  if c <> 1 then raise exception 'FALLA: un autenticado ve % leads de jt, esperaba 1', c; end if;

  -- Y puede escribir: la bandeja tiene que poder reasignar.
  update public.crm_leads set alice_id = 'seb'
   where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics c = row_count;
  if c <> 1 then raise exception 'FALLA: un autenticado no pudo actualizar el lead'; end if;

  raise notice 'OK 2: el equipo autenticado lee y escribe leads de otros';
end $$;

-- ── 3a · crm_eventos: el autenticado no puede corregir ni borrar el pasado ──
-- Sin policy de UPDATE/DELETE, RLS no lanza error: filtra. El síntoma es 0 filas
-- afectadas, y por eso se chequea el row_count y no una excepción.
do $$
declare c integer;
begin
  update public.crm_eventos set texto = 'reescrito' where lead_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics c = row_count;
  if c <> 0 then raise exception 'FALLA: authenticated reescribió % eventos', c; end if;

  delete from public.crm_eventos where lead_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics c = row_count;
  if c <> 0 then raise exception 'FALLA: authenticated borró % eventos', c; end if;

  -- Agregar sí puede: append-only es append, no read-only.
  insert into public.crm_eventos (lead_id, tipo, direccion, actor, texto)
  values ('00000000-0000-0000-0000-0000000000a1', 'mensaje', 'entrante', 'prospecto', 'hola');

  raise notice 'OK 3a: authenticated agrega eventos pero no los modifica ni borra';
end $$;

reset role;

-- ── 3b · el trigger tapa lo que RLS no: service_role saltea RLS ─────────────
-- El brain escribe con service_role. Sin este trigger, "auditable" sería una
-- promesa: quien saltea RLS podría reescribir la evidencia de un handoff.
do $$
declare ok boolean := false;
begin
  begin
    update public.crm_eventos set texto = 'reescrito por el dueño' where id = (
      select min(id) from public.crm_eventos);
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: el dueño de la tabla reescribió un evento'; end if;

  ok := false;
  begin
    delete from public.crm_eventos where id = (select min(id) from public.crm_eventos);
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: el dueño de la tabla borró un evento'; end if;

  raise notice 'OK 3b: el trigger bloquea update/delete incluso salteando RLS';
end $$;

-- ── 4 · sin evidencia no hay dato (§8) ──────────────────────────────────────
do $$
declare ok boolean;
begin
  -- 4a · buyer persona: valor sin cita no entra.
  ok := false;
  begin
    insert into public.crm_buyer_persona (lead_id, motivacion)
    values ('00000000-0000-0000-0000-0000000000a1', 'quiere mudarse');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: entró una motivación sin cita textual'; end if;

  -- 4b · y la cita huérfana tampoco: evidencia de nada no es evidencia.
  ok := false;
  begin
    insert into public.crm_buyer_persona (lead_id, plazo_cita)
    values ('00000000-0000-0000-0000-0000000000a1', 'en unos meses');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: entró una cita sin valor'; end if;

  -- 4c · un plazo_meses sin la frase que lo normaliza es un número sin origen.
  ok := false;
  begin
    insert into public.crm_buyer_persona (lead_id, plazo_meses, plazo_cita)
    values ('00000000-0000-0000-0000-0000000000a1', 6, 'en seis meses');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: entró un plazo_meses sin plazo_texto'; end if;

  -- 4d · el par completo sí. Fijate que el plazo entra como TEXTO ("para antes de
  -- fin de año") y sin meses: es exactamente lo que devuelve mica/persona.js cuando
  -- la frase no trae un número, y tiene que poder guardarse igual.
  insert into public.crm_buyer_persona (lead_id, motivacion, motivacion_cita,
                                        metraje_min, metraje_max, metraje_cita,
                                        plazo_texto, plazo_cita, forma)
  values ('00000000-0000-0000-0000-0000000000a1',
          'mudarse con su pareja', 'nos queremos mudar con mi esposa',
          80, 100, 'algo entre 80 y 100 metros',
          'para antes de fin de año', 'queremos estar antes de fin de año',
          '{"registro":"tu","emojis":false}'::jsonb);

  -- 4e · una temperatura distinta de 'frio' sin la frase que la causó no entra.
  ok := false;
  begin
    insert into public.crm_leads (canal, external_id, temperatura)
    values ('instagram', 'ig-sin-evidencia', 'hot');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: entró un lead hot sin cita'; end if;

  -- 4f · 'frio' sí puede no tener cita: es la ausencia de evidencia.
  insert into public.crm_leads (canal, external_id, temperatura)
  values ('instagram', 'ig-frio', 'frio');

  raise notice 'OK 4: buyer persona y temperatura exigen la cita textual';
end $$;

-- ── 5 · stock e ingesta sin duplicados ──────────────────────────────────────
do $$
declare ok boolean;
begin
  -- 5a · el mismo prospecto del mismo canal entra una sola vez (el webhook reintenta).
  ok := false;
  begin
    insert into public.crm_leads (canal, external_id, temperatura)
    values ('whatsapp', '+51999000111', 'frio');
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: se duplicó el lead de whatsapp +51999000111'; end if;

  -- 5b · pero dos leads cargados a mano (sin id externo) conviven: el índice es parcial.
  insert into public.crm_leads (canal, temperatura) values ('web', 'frio');
  insert into public.crm_leads (canal, temperatura) values ('web', 'frio');

  -- 5c · la unidad 301 no puede existir dos veces. Este es el caso que un UNIQUE
  -- normal dejaría pasar: `torre` es NULL en las dos y NULL <> NULL.
  ok := false;
  begin
    insert into public.crm_unidades (proyecto_id, numero, estado)
    values ('TEST-RLS-01', '301', 'disponible');
  exception when unique_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: se duplicó la unidad 301 con torre NULL'; end if;

  -- 5d · la misma numeración en otra torre sí es otra unidad.
  insert into public.crm_unidades (proyecto_id, numero, torre, estado)
  values ('TEST-RLS-01', '301', 'B', 'disponible');

  -- 5e · un estado de unidad fuera del vocabulario no entra.
  ok := false;
  begin
    insert into public.crm_unidades (proyecto_id, numero, estado)
    values ('TEST-RLS-01', '999', 'reservada');   -- el vocabulario dice 'separada'
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: entró una unidad con estado inventado'; end if;

  raise notice 'OK 5: dedup de leads y unicidad de unidades (incluso sin torre)';
end $$;

-- ── 6 · un evento 'mensaje' sin dirección no existe, y viceversa ────────────
do $$
declare ok boolean;
begin
  ok := false;
  begin
    insert into public.crm_eventos (lead_id, tipo, actor, texto)
    values ('00000000-0000-0000-0000-0000000000a1', 'mensaje', 'prospecto', 'sin direccion');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: entró un mensaje sin dirección'; end if;

  ok := false;
  begin
    insert into public.crm_eventos (lead_id, tipo, direccion, actor)
    values ('00000000-0000-0000-0000-0000000000a1', 'handoff', 'saliente', 'mica');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FALLA: entró un handoff con dirección de mensaje'; end if;

  raise notice 'OK 6: crm_eventos.direccion solo aplica a mensajes';
end $$;

-- ── 7 · la vista que consume Mica no tiene ni una columna de precio ─────────
-- Es la defensa estructural del §6 ("Mica nunca dice un precio"): Postgres no tiene
-- RLS por columna, así que si la vista trajera precios, el prompt sería lo único
-- que separa a un prospecto de una cifra inventada.
do $$
declare c integer; disp integer;
begin
  select count(*) into c
  from information_schema.columns
  where table_schema = 'public' and table_name = 'crm_catalogo_mica'
    and (column_name ilike '%precio%' or column_name ilike '%moneda%');
  if c <> 0 then
    raise exception 'FALLA: crm_catalogo_mica expone % columnas de precio a Mica', c;
  end if;

  -- Y sí contesta lo que hoy nadie puede contestar: cuántas quedan.
  select disponibles into disp from public.crm_catalogo_mica
  where proyecto_id = 'TEST-RLS-01' and tipologia = 'flat de prueba';
  if disp is distinct from 1 then
    raise exception 'FALLA: disponibles = %, esperaba 1', disp;
  end if;

  raise notice 'OK 7: la vista de Mica cuenta stock y no expone precios';
end $$;

-- ── 8 · borrar un lead con historia no se puede ─────────────────────────────
-- Efecto buscado del trigger append-only: el `on delete cascade` de crm_eventos
-- choca contra él. En un CRM auditable un lead no se borra, se marca descartado
-- (§11). Este test existe para que, si alguien cambia el trigger, quede claro que
-- también está cambiando esto.
do $$
declare ok boolean := false;
begin
  begin
    delete from public.crm_leads where id = '00000000-0000-0000-0000-0000000000a1';
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALLA: se borró un lead con eventos — se perdió la auditoría'; end if;

  -- El camino correcto sí funciona.
  update public.crm_leads
     set descartado_at = now(), descartado_motivo = 'no me interesa'
   where id = '00000000-0000-0000-0000-0000000000a1';

  raise notice 'OK 8: un lead con historia se descarta, no se borra';
end $$;

rollback;
