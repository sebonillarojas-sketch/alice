-- ALICE · crm — el CRM comercial que alimenta a Mica
-- ────────────────────────────────────────────────────────────────────────────
-- Paso 2 del §14 del diseño (docs/superpowers/specs/2026-09-15-mica-agente-comercial-design.md).
-- Acá vive lo que José ve y lo que queda respaldado. La conversación cruda NO está
-- acá: vive en SQLite en la Mac (`mica.db`, ver alicia-brain/src/mica/hilos.js).
-- Esa división es del §9 y este archivo la respeta: volumen crudo en local, hechos
-- en Supabase.
--
-- Lo que NO entra, a propósito (§3 del diseño): kanban, reportes, comisiones,
-- cotizaciones. Acá solo está lo que el agente necesita para no perder datos.
-- Tampoco entra el estado de la cadencia de seguimiento (+1/+3/+7/+21, §11): eso es
-- el paso 5 del §14 y necesita decidir dónde corre el reloj antes de tener columnas.
--
-- PENDIENTE DE CONFIRMAR con Sebastián: `moneda` default 'PEN' para seguir a
-- rental_comps, pero la vivienda nueva en Lima se lista habitualmente en USD. Si es
-- USD, se cambia el default acá ANTES de cargar el primer proyecto — después implica
-- revisar fila por fila cuál quedó mal.
--
-- CÓMO CORRERLO: Supabase Dashboard → SQL Editor → pegar todo → Run.
-- Es idempotente (create if not exists / drop policy if exists). Seguro re-correrlo.
-- Los tests de aislamiento están en crm-rls-test.sql.
-- ────────────────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════════════════
-- CATÁLOGO · proyectos → tipologías → unidades
-- ════════════════════════════════════════════════════════════════════════════

-- El id es el CÓDIGO ('OLVR-01'), no un uuid. Razón: ese código ya es la llave en
-- alicia-brain/src/mica/catalogo.json y en `estado.proyecto` del motor, y es lo que
-- la máquina de slots del handoff imprime literalmente en el mensaje al prospecto
-- ("está a cargo de OLVR-01"). Con un uuid habría que resolver un join para armar
-- una frase — y el brain tendría dos nombres para la misma cosa. Mismo criterio
-- que `rental_comps.id`.
create table if not exists public.crm_proyectos (
  id            text primary key,                 -- código comercial: OLVR-01, SANT-01…
  nombre        text not null,
  distrito      text,
  estado        text not null default 'preventa'
                check (estado in ('planificacion','preventa','venta','entregado','pausado')),
  brochure_url  text,                             -- brochure general del proyecto (Supabase Storage, §9)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.crm_tipologias (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   text not null references public.crm_proyectos(id) on delete cascade,
  nombre        text not null,                    -- townhouse · flat · dúplex (§6, las cuatro preguntas)
  dormitorios   smallint check (dormitorios >= 0),
  banos         numeric(3,1) check (banos >= 0),  -- numeric: "2.5 baños" es medio baño, no un decimal raro
  m2            numeric(7,2) check (m2 > 0),
  precio_desde  numeric(12,2) check (precio_desde >= 0),
  precio_hasta  numeric(12,2) check (precio_hasta >= 0),
  moneda        text not null default 'PEN' check (moneda in ('PEN','USD')),
  brochure_url  text,                             -- cada brochure enviado es señal de interés (§9)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Un rango invertido no es un dato incompleto, es un dato falso: cualquier
  -- filtro "desde/hasta" lo devuelve mal y nadie se entera.
  constraint crm_tipologias_rango_ok check (
    precio_desde is null or precio_hasta is null or precio_hasta >= precio_desde
  ),
  -- Dos "Flat 2D" en el mismo proyecto son un error de carga, no dos tipologías.
  constraint crm_tipologias_nombre_unico unique (proyecto_id, nombre)
);

-- crm_unidades · el stock real, unidad por unidad.
-- NO está en el §9 del diseño. Lo agregamos porque sin stock por unidad el CRM no
-- puede contestar la única pregunta que define una venta: QUÉ QUEDA. Con solo
-- proyecto + tipología se sabe que existe el "flat de 2D" pero no si queda alguno,
-- y la respuesta "sí tenemos" sobre un proyecto agotado es exactamente el error
-- del que una inmobiliaria no se recupera (§6). Los CRM inmobiliarios del rubro
-- (Logicware) modelan la unidad como entidad propia por esto mismo.
--
-- OJO con `precio_lista`: esta columna existe para José y el ERP. Mica NUNCA la lee
-- (§6: nunca dice un precio). Postgres no tiene RLS por columna, así que la
-- protección real es la vista `crm_catalogo_mica` del final de este archivo: es lo
-- único que el brain debe consultar.
create table if not exists public.crm_unidades (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   text not null references public.crm_proyectos(id) on delete cascade,
  tipologia_id  uuid references public.crm_tipologias(id) on delete set null,
  numero        text not null,                    -- '304', 'TH-02': texto, porque no siempre es número
  piso          smallint,
  torre         text,
  m2            numeric(7,2) check (m2 > 0),      -- el real de ESTA unidad; puede diferir del de la tipología
  precio_lista  numeric(12,2) check (precio_lista >= 0),
  moneda        text not null default 'PEN' check (moneda in ('PEN','USD')),
  estado        text not null default 'disponible'
                check (estado in ('disponible','separada','vendida','bloqueada')),
  nota          text,                             -- por qué está bloqueada, quién la separó, etc.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Unicidad de la unidad dentro del proyecto. Va como índice y no como constraint
-- porque `torre` es opcional: en un UNIQUE normal dos filas con torre NULL y el
-- mismo número NO chocan (NULL nunca es igual a NULL), y se duplicaría el stock
-- justo en los proyectos de una sola torre, que son la mayoría.
create unique index if not exists idx_crm_unidades_unica
  on public.crm_unidades (proyecto_id, coalesce(torre, ''), numero);


-- ════════════════════════════════════════════════════════════════════════════
-- LEADS
-- ════════════════════════════════════════════════════════════════════════════

-- Las etapas son el vocabulario real del rubro en Perú (verificado contra
-- Logicware, el CRM inmobiliario peruano de referencia):
--
--   captura → calificacion → [handoff] → atencion → cotizacion → cierre → postventa
--
-- `handoff` es nuestro y va ENTRE `calificacion` y `atencion`. Por qué ahí:
--   · Antes de `calificacion` sería imposible: el handoff lo dispara `hot`, y `hot`
--     ES el veredicto de la calificación (§8).
--   · Después de `cotizacion` sería una contradicción con el diseño: lo que dispara
--     el handoff es que PIDAN planos o precio, o sea antes de que exista cotización
--     alguna — Mica nunca cotiza (§6).
--   · Y es exactamente la frontera del sistema: hasta `calificacion` trabaja Mica,
--     de `atencion` en adelante trabaja José. "Mica no cierra ventas: abre bien y
--     entrega bien" (§2).
--
-- La deuda de meterlo en el mismo enum: `etapa` pasa a mezclar "dónde va en el
-- embudo" con "quién lo tiene ahora", y en cuanto José lo mueve a `atencion` la
-- etapa deja de contar que hubo handoff. Por eso existe además `handoff_at`: el
-- hecho queda aunque la etapa avance, y "¿cuándo se lo entregamos?" no obliga a
-- barrer crm_eventos.
create table if not exists public.crm_leads (
  id               uuid primary key default gen_random_uuid(),
  canal            text not null check (canal in ('whatsapp','instagram','messenger','web')),
  -- Identidad del lead en el canal. Para whatsapp es el teléfono normalizado E.164,
  -- que es la MISMA llave con la que hilos.js guarda el hilo en mica.db — así, desde
  -- la ficha del CRM, se reconstruye la conversación cruda sin tabla puente.
  external_id      text,
  telefono         text,
  nombre           text,
  correo           text,
  proyecto_id      text references public.crm_proyectos(id) on delete set null,

  temperatura      text not null default 'frio' check (temperatura in ('frio','tibio','hot')),
  -- La frase exacta que causó el veredicto (§8: "sin evidencia no hay dato"), la
  -- misma que devuelve `clasificar()` en mica/temperatura.js. `frio` es la ausencia
  -- de evidencia, así que es el único estado que puede no traer cita.
  temperatura_cita text,
  temperatura_at   timestamptz,
  constraint crm_leads_temp_con_evidencia check (
    temperatura = 'frio' or temperatura_cita is not null
  ),

  etapa            text not null default 'captura'
                   check (etapa in ('captura','calificacion','handoff','atencion',
                                    'cotizacion','cierre','postventa')),
  handoff_at       timestamptz,

  -- Dueño por alice_id ('jt'), no por uuid de auth.users. Es el identificador que ya
  -- usan las tareas del ERP (`assignees`) y el trigger de notificaciones, y permite
  -- asignar un lead a alguien que todavía no abrió sesión nunca. Deliberadamente SIN
  -- foreign key a user_profiles: ese unique index lo crea notifications.sql, y una FK
  -- haría que este archivo no corra en un proyecto donde aquel no se corrió antes.
  alice_id         text,

  -- De dónde salió: `fuente` es el tipo, `fuente_ref` el identificador concreto
  -- (id del post de Instagram, nombre de la campaña). Separados porque "¿qué campaña
  -- trae leads hot?" se agrupa por el tipo y se detalla por la ref.
  fuente           text check (fuente in ('campana','post','organico','referido','desconocido')),
  fuente_ref       text,

  primer_contacto  timestamptz not null default now(),
  ultimo_contacto  timestamptz not null default now(),

  -- Un lead perdido NO es etapa 'cierre'. En el vocabulario del rubro `cierre` es
  -- cierre de VENTA: si el que dijo "no me interesa" y el que firmó comparten etapa,
  -- toda métrica de conversión miente. Por eso la caída va en columnas propias
  -- (§11: un "no me interesa" o el silencio tras el cuarto toque cierra el lead).
  descartado_at    timestamptz,
  descartado_motivo text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Dedup de ingesta. El webhook reintenta y Meta/Twilio reenvían: sin esto, el mismo
-- prospecto entra dos veces y José ve dos fichas de la misma persona. Parcial porque
-- un lead cargado a mano por José no tiene id externo y no debe bloquear a otro igual.
create unique index if not exists idx_crm_leads_canal_externo
  on public.crm_leads (canal, external_id)
  where external_id is not null;

-- La consulta de la bandeja de José: lo mío, por temperatura, lo más reciente arriba.
create index if not exists idx_crm_leads_dueno_temperatura
  on public.crm_leads (alice_id, temperatura, ultimo_contacto desc);

-- El embudo: cuántos hay en cada etapa, y quién está esperando handoff.
create index if not exists idx_crm_leads_etapa
  on public.crm_leads (etapa, ultimo_contacto desc);


-- ════════════════════════════════════════════════════════════════════════════
-- BUYER PERSONA · 1:1 con el lead, cada campo con su cita textual
-- ════════════════════════════════════════════════════════════════════════════

-- DECISIÓN: columnas gemelas `campo` + `campo_cita`, no JSONB {valor, cita}.
--
-- Se eligió gemelas porque:
--   1. El §8 fija los campos: motivación, hogar, metraje, tipología, prioridad,
--      plazo. Son seis y son estables — la flexibilidad del JSONB no compra nada
--      y sí cuesta tipos (un metraje "80" string no compara contra 80).
--   2. La regla "sin evidencia no hay dato" se vuelve un CHECK declarativo por par.
--      La base rechaza un valor sin cita; no depende de que el extractor se porte
--      bien. En JSONB el mismo CHECK habría que escribirlo igual, columna por
--      columna, sobre `? 'cita'` — mismo trabajo, menos tipos.
--   3. El dossier del handoff (§7) y la bandeja filtran por estos campos
--      ("metraje ≥ 90", "tipología townhouse"): con gemelas son índices normales.
--
-- El contraste está en `forma`, que SÍ es JSONB: el perfil de forma (registro,
-- largo, emojis, jerga, audio, horario) es abierto, no lleva evidencia y nadie lo
-- filtra — solo alimenta el mirroring. Lo fijo y consultable va a columnas; lo
-- abierto y opaco va a JSONB.
create table if not exists public.crm_buyer_persona (
  -- El lead ES la clave: 1:1 garantizado por estructura, sin unique aparte.
  lead_id            uuid primary key references public.crm_leads(id) on delete cascade,

  motivacion         text,        -- "para mudarme con mi pareja", "es inversión"
  motivacion_cita    text,

  hogar              text,        -- composición: "pareja con un hijo"
  hogar_cita         text,

  -- Rango, no número: la gente dice "entre 80 y 100". Una sola cita sustenta el
  -- rango completo, así que el CHECK mira el par (min, max) como una unidad.
  metraje_min        numeric(7,2) check (metraje_min > 0),
  metraje_max        numeric(7,2) check (metraje_max > 0),
  metraje_cita       text,

  -- Dos columnas para lo mismo a propósito: `tipologia` es lo que dijo la persona,
  -- con sus palabras; `tipologia_id` es el match contra el catálogo real. La regla
  -- de `hot` del §8 exige "interés compatible con alguna tipología real del
  -- catálogo" — sin el FK eso sería comparar strings a mano en cada evaluación.
  tipologia          text,
  tipologia_id       uuid references public.crm_tipologias(id) on delete set null,
  tipologia_cita     text,

  -- Sale textual de una de las cuatro preguntas ADN del §6: "¿qué te gusta más,
  -- una sala amplia o más espacio en las habitaciones?". Si algún día aparece una
  -- tercera respuesta legítima, se amplía este check — no se guarda texto libre,
  -- porque el valor de este campo es poder agruparlo.
  prioridad          text check (prioridad in ('sala','habitaciones','ambos')),
  prioridad_cita     text,

  -- En meses. La regla de `hot` es "plazo ≤ 6 meses" (§8): un entero comparable,
  -- no "para fin de año".
  plazo_meses        smallint check (plazo_meses >= 0),
  plazo_cita         text,

  -- Perfil de forma (§8). Alimenta el mirroring, que copia la forma y nunca el
  -- contenido emocional. Abierto porque va a crecer con lo que el extractor aprenda.
  forma              jsonb not null default '{}'::jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- El invariante del §8, declarado: valor y cita viajan juntos o no viajan.
  -- `(a is null) = (b is null)` = ambos nulos o ambos presentes. Una cita huérfana
  -- tampoco pasa: evidencia de nada no es evidencia.
  constraint crm_bp_motivacion_con_cita check ((motivacion is null) = (motivacion_cita is null)),
  constraint crm_bp_hogar_con_cita      check ((hogar      is null) = (hogar_cita      is null)),
  constraint crm_bp_tipologia_con_cita  check ((tipologia  is null) = (tipologia_cita  is null)),
  constraint crm_bp_prioridad_con_cita  check ((prioridad  is null) = (prioridad_cita  is null)),
  constraint crm_bp_plazo_con_cita      check ((plazo_meses is null) = (plazo_cita     is null)),
  constraint crm_bp_metraje_con_cita    check (
    (metraje_min is null and metraje_max is null) = (metraje_cita is null)
  ),
  constraint crm_bp_metraje_rango_ok    check (
    metraje_min is null or metraje_max is null or metraje_max >= metraje_min
  )
);

-- "¿Qué leads buscan un townhouse?" — la pregunta que arma la lista de a quién
-- avisarle cuando entra stock de una tipología.
create index if not exists idx_crm_bp_tipologia
  on public.crm_buyer_persona (tipologia_id)
  where tipologia_id is not null;


-- ════════════════════════════════════════════════════════════════════════════
-- EVENTOS · línea de tiempo append-only
-- ════════════════════════════════════════════════════════════════════════════

-- Append-only de verdad, no por convención. Se defiende en dos capas porque cada
-- una tapa lo que la otra deja abierto:
--   · RLS sin policies de UPDATE/DELETE → el rol `authenticated` (el ERP en el
--     browser) no puede tocar el pasado.
--   · Trigger que aborta UPDATE/DELETE → cubre al `service_role`, que SALTEA RLS.
--     El brain escribe con service_role; sin el trigger, "auditable" sería una
--     promesa y no una garantía.
-- Para un arreglo administrativo legítimo:
--   alter table public.crm_eventos disable trigger trg_crm_eventos_append_only;
-- (y volver a habilitarlo, que es justamente el rastro que queremos que exista).
--
-- CONSECUENCIA BUSCADA: como el trigger no distingue de dónde viene el DELETE,
-- borrar un lead que ya tiene eventos FALLA — el `on delete cascade` de abajo choca
-- contra el trigger. Está bien que así sea: en un CRM auditable un lead no se borra,
-- se marca `descartado_at` (§11). Si de verdad hay que purgarlo (pedido de baja de
-- datos), se deshabilita el trigger a mano, se borra, y se vuelve a habilitar.
create table if not exists public.crm_eventos (
  -- identity y no uuid: el orden de inserción es información acá, y ordenar por
  -- un uuid v4 no ordena nada.
  id         bigint generated always as identity primary key,
  lead_id    uuid not null references public.crm_leads(id) on delete cascade,
  tipo       text not null check (tipo in (
               'mensaje',      -- turno de conversación (el texto, no el hilo entero)
               'temperatura',  -- cambio de veredicto, con la frase que lo causó
               'brochure',     -- brochure enviado: señal de interés (§9)
               'handoff',      -- la entrega a José
               'seguimiento',  -- toque de la cadencia +1/+3/+7/+21 (§11)
               'etapa',        -- movimiento en el embudo
               'nota'          -- lo que escribe una persona a mano
             )),
  -- Solo aplica a 'mensaje'. Un evento sin dirección no es un mensaje, y un mensaje
  -- sin dirección no se puede leer: el CHECK lo hace imposible.
  direccion  text check (direccion in ('entrante','saliente')),
  -- Quién lo hizo: 'mica', 'prospecto', o un alice_id ('jt'). Texto y no FK por la
  -- misma razón que `crm_leads.alice_id`.
  actor      text not null default 'mica',
  -- La cita literal. En 'temperatura' es la frase que causó el cambio; en 'mensaje',
  -- el texto del turno. NUNCA paráfrasis (§7: "Jose tiene que saber cómo habla esa
  -- persona antes de escribirle").
  texto      text,
  -- Lo estructurado de cada tipo: {de,a} en temperatura, {combo} en handoff,
  -- {unidad_id} al separar, {toque:2} en seguimiento. JSONB porque cada tipo trae
  -- algo distinto y ninguno se filtra — para eso están `tipo` y `lead_id`.
  datos      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint crm_eventos_direccion_solo_mensaje check (
    (tipo = 'mensaje') = (direccion is not null)
  )
);

-- La ficha del lead: su línea de tiempo completa, del último al primero.
-- Ordena por created_at y no solo por id porque una importación de historial
-- entra hoy con fechas de ayer, y ahí id y tiempo dejan de coincidir. El id queda
-- de desempate para los que caen en el mismo timestamp.
create index if not exists idx_crm_eventos_lead
  on public.crm_eventos (lead_id, created_at desc, id desc);

-- "¿Cuántos handoffs esta semana?", "¿cuántas respuestas degradadas?" — el reporte
-- diario de José (§5) barre por tipo y fecha sin pasar por lead.
create index if not exists idx_crm_eventos_tipo
  on public.crm_eventos (tipo, created_at desc);

create or replace function public.crm_eventos_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'crm_eventos es append-only: % no está permitido (id %)',
    TG_OP, coalesce(OLD.id, -1);
end;
$$;

drop trigger if exists trg_crm_eventos_append_only on public.crm_eventos;

create trigger trg_crm_eventos_append_only
before update or delete on public.crm_eventos
for each row execute function public.crm_eventos_append_only();


-- ════════════════════════════════════════════════════════════════════════════
-- updated_at · un solo trigger para todas
-- ════════════════════════════════════════════════════════════════════════════

-- Estas tablas tienen DOS escritores: el ERP (browser, anon+JWT) y el brain
-- (service_role). Si `updated_at` dependiera del cliente, alcanza con que uno de
-- los dos se olvide para que la columna mienta — y una columna de fecha que miente
-- es peor que no tenerla, porque igual se usa para ordenar. Acá lo pone la base.
create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['crm_proyectos','crm_tipologias','crm_unidades',
                           'crm_leads','crm_buyer_persona']
  loop
    execute format('drop trigger if exists trg_%1$s_touch on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_touch before update on public.%1$s
         for each row execute function public.crm_touch_updated_at()', t);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- RLS · mismo criterio que rls-policies.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Espeja rls-policies.sql: ERP interno, todo el equipo autenticado lee y escribe
-- todo. Un lead no es privado de su dueño — cuando José está de viaje alguien
-- tiene que poder abrir la ficha. `alice_id` es asignación, no permiso.
-- (No es apto para multi-tenant público: ahí habría que filtrar por org.)
--
-- La excepción es crm_eventos, que va abajo con su propio criterio.

alter table public.crm_proyectos     enable row level security;
alter table public.crm_tipologias    enable row level security;
alter table public.crm_unidades      enable row level security;
alter table public.crm_leads         enable row level security;
alter table public.crm_buyer_persona enable row level security;
alter table public.crm_eventos       enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crm_proyectos','crm_tipologias','crm_unidades',
                           'crm_leads','crm_buyer_persona']
  loop
    execute format('drop policy if exists "team_read_%1$s"   on public.%1$s', t);
    execute format('drop policy if exists "team_insert_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "team_update_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "team_delete_%1$s" on public.%1$s', t);

    execute format('create policy "team_read_%1$s"   on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy "team_insert_%1$s" on public.%1$s for insert to authenticated with check (true)', t);
    execute format('create policy "team_update_%1$s" on public.%1$s for update to authenticated using (true) with check (true)', t);
    execute format('create policy "team_delete_%1$s" on public.%1$s for delete to authenticated using (true)', t);
  end loop;
end $$;

-- crm_eventos · lee y agrega, nunca corrige ni borra.
-- La ausencia de policies de UPDATE y DELETE es la mitad de la garantía
-- append-only (la otra mitad es el trigger de arriba). Es el mismo razonamiento
-- por el que notifications.sql omite a propósito la policy de INSERT: lo que no
-- se declara, no se puede hacer.
drop policy if exists "team_read_crm_eventos"   on public.crm_eventos;
drop policy if exists "team_insert_crm_eventos" on public.crm_eventos;

create policy "team_read_crm_eventos"   on public.crm_eventos for select to authenticated using (true);
create policy "team_insert_crm_eventos" on public.crm_eventos for insert to authenticated with check (true);


-- ════════════════════════════════════════════════════════════════════════════
-- Realtime · la bandeja de José en vivo
-- ════════════════════════════════════════════════════════════════════════════

-- Quien escribe estas tablas es el brain (otro proceso, otra máquina), no la
-- pestaña que José tiene abierta. Sin publicación, la bandeja solo se entera de un
-- lead nuevo cuando él recarga — y el §1 dice que lo que se pierde es el momento.
-- `replica identity full` para que el UPDATE llegue con la fila completa y realtime
-- pueda evaluar RLS sobre ella (mismo detalle que notifications.sql).
alter table public.crm_leads   replica identity full;
alter table public.crm_eventos replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.crm_leads;
exception
  when duplicate_object then null;  -- ya estaba: re-correr no debe fallar
end $$;

do $$
begin
  alter publication supabase_realtime add table public.crm_eventos;
exception
  when duplicate_object then null;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- crm_catalogo_mica · lo único del catálogo que Mica puede ver
-- ════════════════════════════════════════════════════════════════════════════

-- La regla que ordena todo el sistema (§6): "Mica nunca envía planos ni dice un
-- precio". Postgres no tiene RLS por columna, así que el `select *` sobre
-- crm_tipologias le pondría los precios en el contexto — y lo que está en el
-- contexto, tarde o temprano sale. Esta vista NO tiene ninguna columna de precio:
-- es lo que el brain consulta para armar `catalogo.json`, y el error queda
-- estructuralmente fuera de alcance en vez de depender del prompt.
--
-- Trae además `disponibles`, que es lo que hoy nadie puede contestar: cuántas
-- unidades quedan de esa tipología. Sin precio, decir "quedan 3" no cotiza nada.
--
-- security_invoker: la vista corre con los permisos de QUIEN consulta, así que el
-- RLS de las tablas de abajo se aplica igual. Sin esto una vista es un agujero
-- bajo RLS (corre como su dueño y pasa por encima de las policies).
-- drop + create y no `create or replace`: replace falla si cambian las columnas, y
-- este archivo tiene que poder re-correrse después de tocar la vista.
drop view if exists public.crm_catalogo_mica;

create view public.crm_catalogo_mica
with (security_invoker = true) as
select
  p.id            as proyecto_id,
  p.nombre        as proyecto,
  p.distrito,
  p.estado        as estado_proyecto,
  t.id            as tipologia_id,
  t.nombre        as tipologia,
  t.dormitorios,
  t.banos,
  t.m2,
  t.brochure_url,
  count(u.id) filter (where u.estado = 'disponible') as disponibles
from public.crm_proyectos p
left join public.crm_tipologias t on t.proyecto_id = p.id
left join public.crm_unidades   u on u.tipologia_id = t.id
where p.estado in ('preventa','venta')
group by p.id, p.nombre, p.distrito, p.estado,
         t.id, t.nombre, t.dormitorios, t.banos, t.m2, t.brochure_url;

comment on view public.crm_catalogo_mica is
  'Catálogo sin precios para el brain (spec §6). Un proyecto sin tipologías aparece con '
  'tipologia null: el motor lo declara "sin tipologías cargadas" y no las inventa.';


-- ════════════════════════════════════════════════════════════════════════════
-- Seeds · EJEMPLO COMENTADO. No correr.
-- ════════════════════════════════════════════════════════════════════════════
--
-- El catálogo real hoy tiene UN proyecto, OLVR-01, y SIN tipologías cargadas
-- (alicia-brain/src/mica/catalogo.json). Todo lo de abajo es forma, no dato: los
-- nombres, metrajes y precios son inventados para mostrar el shape. Cargar datos
-- falsos acá es peor que dejar la tabla vacía, porque el motor los toma por
-- verdaderos y Mica se los dice a un prospecto (CLAUDE.md: "cero data falsa").
-- Un proyecto sin tipologías está BIEN: construirSystem() lo declara "sin
-- tipologías cargadas" y el modelo tiene prohibido completarlas.
--
--   insert into public.crm_proyectos (id, nombre, distrito, estado)
--   values ('OLVR-01', '<nombre real>', '<distrito real>', 'preventa')
--   on conflict (id) do nothing;
--
--   insert into public.crm_tipologias (proyecto_id, nombre, dormitorios, banos, m2,
--                                      precio_desde, precio_hasta, moneda)
--   values ('OLVR-01', '<townhouse|flat|duplex>', <dorms>, <banos>, <m2>,
--           <precio_desde>, <precio_hasta>, 'PEN');
--
--   insert into public.crm_unidades (proyecto_id, tipologia_id, numero, piso, torre,
--                                    m2, precio_lista, moneda, estado)
--   select 'OLVR-01', id, '301', 3, null, m2, <precio_lista>, 'PEN', 'disponible'
--   from public.crm_tipologias where proyecto_id = 'OLVR-01' and nombre = '<...>';


-- ── verificación rápida (opcional) ──────────────────────────────────────────
-- Después de correrlo, esto debería listar las 6 tablas con RLS y sus policies:
--   select tablename, policyname, cmd
--   from pg_policies
--   where tablename like 'crm_%'
--   order by tablename, cmd;
-- Y crm_eventos debería aparecer SOLO con SELECT e INSERT.
