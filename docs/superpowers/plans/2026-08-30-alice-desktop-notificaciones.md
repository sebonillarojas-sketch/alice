# ALICE Desktop · Notificaciones en tiempo real · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el equipo reciba en su Mac, en el momento en que ocurre, una notificación nativa cuando le asignan una tarea o cuando una tarea suya vence hoy, desde una app de escritorio que vive en la barra de menú.

**Architecture:** Las notificaciones las genera **Postgres** (un trigger para asignaciones, un job `pg_cron` para vencimientos) en una tabla `notifications` con RLS por destinatario. El **bundle web** de `alice.bam.pe` es dueño de la suscripción Realtime y de toda la lógica de notificación; el **shell de Electron** es delgado y solo aporta lo que un navegador no puede: ventana persistente, barra de menú, arranque al login, banner nativo, eventos de suspensión y pantalla offline. La comunicación web↔shell va por `contextBridge`, siempre con detección de capacidad.

**Tech Stack:** Supabase (Postgres 15, RLS, Realtime, pg_cron) · React 18 + Vite 5 (`files/alice`) · Electron + electron-builder + electron-updater (`desktop/`) · `node --test` para tests.

**Spec:** `docs/superpowers/specs/2026-08-30-alice-desktop-notificaciones-design.md` — léelo antes de empezar. Este plan argumenta desde ahí.

## Global Constraints

- **Node 22.** Netlify buildea con `NODE_VERSION = 22` (`netlify.toml`). No usar APIs posteriores.
- **`files/alice` es ESM** (`"type": "module"`). **`desktop/` es CommonJS a propósito**: su `package.json` NO lleva `"type": "module"`, porque Electron carga `main` y `preload` como CJS. No "corregir" esto.
- **Todo el SQL debe ser idempotente** y correrse en el **SQL Editor de Supabase**, como el resto de `files/alice/supabase/*.sql`. Cada archivo empieza con un comentario que dice qué hace y que es seguro re-correrlo.
- **Comentarios en español**, explicando el *porqué* y no el *qué* — es el estilo del repo.
- **Invariante D5, no negociable:** la web nunca depende de la app. Toda llamada web→shell va con detección de capacidad (`if (window.alice?.notify)`) y tiene camino alternativo en navegador. El shell nunca inyecta JavaScript en la página: le manda un mensaje y la web decide.
- **No tocar los briefings de WhatsApp** (`alicia-brain/src/briefing.js`, `team-briefing.js`). Fuera de alcance.
- **`authUser.id` es el alice_id** (`"sb"`), NO el uid de Supabase — `fetchProfile` (`auth/AuthContext.jsx`) mapea `alice_id → id`. El uid se obtiene de `supabase.auth.getSession()`. Confundirlos hace que no llegue nada y no dé error.
- **Después de cualquier `npm install` en este monorepo:** correr `npm approve-scripts --allow-scripts-pending` y aprobar los scripts pendientes, o el build no compila.
- **Lima es UTC−5 sin horario de verano.** 8:00 Lima = 13:00 UTC, todo el año.

---

### Task 1: Tabla `notifications` con RLS y Realtime

**Files:**
- Create: `files/alice/supabase/notifications.sql`
- Create: `files/alice/supabase/notifications-verify.sql`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: tabla `public.notifications` con columnas `id uuid`, `recipient uuid`, `kind text`, `title text`, `body text`, `deep_link text`, `urgency text`, `source text`, `created_at timestamptz`, `delivered_at timestamptz`, `read_at timestamptz`. Las tareas 2, 3 y 5 escriben y leen de aquí.

Esta tarea va primera y se verifica antes de escribir una línea de Electron por el **Riesgo R1** del spec: si la tabla no queda bien puesta en la publicación de Realtime, no llegan eventos y **no aparece ningún error**.

- [ ] **Step 1: Escribir el SQL de la tabla**

Create `files/alice/supabase/notifications.sql`:

```sql
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
```

- [ ] **Step 2: Correr el SQL en Supabase**

Pegar el contenido en el SQL Editor del proyecto `apnzitklhxrcszectbxx` y ejecutar.
Esperado: `Success. No rows returned`.

- [ ] **Step 3: Escribir el script de verificación**

Create `files/alice/supabase/notifications-verify.sql`:

```sql
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
```

- [ ] **Step 4: Correr la verificación**

Pegar en el SQL Editor y ejecutar.
Esperado: `NOTICE: OK: notifications creada, con RLS, sin insert público y publicada en Realtime`.
Si lanza excepción, corregir `notifications.sql` y volver al Step 2.

- [ ] **Step 5: Verificar el aislamiento entre personas**

El spec pide comprobar que A no ve las filas de B. El SQL Editor corre como service
role (que se salta RLS), así que hay que suplantar a un usuario `authenticated`:

```sql
-- Aislamiento RLS. Correr en el SQL Editor. Hace ROLLBACK: no deja nada.
begin;

do $$
declare
  a_uid uuid; b_uid uuid; c integer;
begin
  select id into a_uid from public.user_profiles order by alice_id limit 1;
  select id into b_uid from public.user_profiles where id <> a_uid order by alice_id limit 1;
  if b_uid is null then raise exception 'Se necesitan 2 filas en user_profiles'; end if;

  insert into public.notifications (recipient, kind, title, deep_link)
  values (b_uid, 'task_assigned', 'Solo para B', '#/task/1');

  -- Suplantar a A: rol authenticated + claim sub = uid de A.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a_uid, 'role', 'authenticated')::text, true);

  select count(*) into c from public.notifications where title = 'Solo para B';
  if c <> 0 then raise exception 'FALLA: A ve % filas de B — RLS no aísla', c; end if;

  raise notice 'OK: A no ve las notificaciones de B';
end $$;

rollback;
```

Esperado: `NOTICE: OK: A no ve las notificaciones de B`.

- [ ] **Step 6: Commit**

```bash
git add files/alice/supabase/notifications.sql files/alice/supabase/notifications-verify.sql
git commit -m "feat(notif): tabla notifications con RLS por destinatario y publicada en Realtime"
```

---

### Task 2: Trigger `task_assigned`

**Files:**
- Create: `files/alice/supabase/notifications-trigger.sql`
- Create: `files/alice/supabase/notifications-trigger-test.sql`

**Interfaces:**
- Consumes: `public.notifications` (Task 1).
- Produces: función `public.notify_task_assigned()` y trigger `trg_notify_task_assigned` sobre `public.tasks`. Genera filas con `kind='task_assigned'` y `deep_link='#/task/<id>'`.

Dos cosas que hay que entender antes de escribir esto:

1. `tasks.assignees` es un **jsonb array de alice_ids** (`["sb","vd"]`), no de uids. El uid se resuelve con un join contra `public.user_profiles` por `alice_id`.
2. `db.upsertTask` (`files/alice/src/lib/supabase.js`) hace un **upsert de la fila completa** en cada cambio, así que `assignees` siempre está en el SET del UPDATE y el trigger dispara en *cualquier* edición. Por eso hay que comparar `OLD` contra `NEW` y notificar solo a quien **no estaba antes** — si no, cambiar el título de una tarea vuelve a notificar a todos.

- [ ] **Step 1: Escribir el test primero (script SQL que debe fallar)**

Create `files/alice/supabase/notifications-trigger-test.sql`:

```sql
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
  --     completa en cada cambio, así que sin el diff OLD/NEW esto renotificaría)
  update public.tasks set title = 'Tarea de prueba editada' where id = tid;

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
```

**Lo que este test NO cubre:** que el actor no se autonotifique. En el SQL Editor
`auth.uid()` devuelve `null` (corre como service role), así que esa rama nunca se
ejercita acá. Se verifica a mano en la Task 5, Step 5.

- [ ] **Step 2: Correr el test para verificar que falla**

Pegar en el SQL Editor y ejecutar.
Esperado: `ERROR: FALLA (a): no se generó exactamente 1 notificación para el asignado` — porque el trigger todavía no existe.

- [ ] **Step 3: Escribir el trigger**

Create `files/alice/supabase/notifications-trigger.sql`:

```sql
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
```

- [ ] **Step 4: Correr el trigger y luego el test**

Pegar `notifications-trigger.sql` en el SQL Editor y ejecutar. Luego re-correr `notifications-trigger-test.sql`.
Esperado: `NOTICE: OK: trigger task_assigned pasa (a), (b) y (c)`.

- [ ] **Step 5: Commit**

```bash
git add files/alice/supabase/notifications-trigger.sql files/alice/supabase/notifications-trigger-test.sql
git commit -m "feat(notif): trigger task_assigned con diff OLD/NEW y sin autonotificación"
```

---

### Task 3: Job `pg_cron` para vencimientos

**Files:**
- Create: `files/alice/supabase/notifications-due-cron.sql`
- Create: `files/alice/supabase/notifications-due-cron-test.sql`

**Interfaces:**
- Consumes: `public.notifications` (Task 1), `public.user_profiles`, `public.tasks`.
- Produces: función `public.notify_due_tasks() returns integer` (devuelve cuántas filas insertó) y el job de `pg_cron` llamado `notify-due-tasks`.

**Por qué no un trigger:** un trigger solo dispara cuando alguien escribe la fila. Una tarea que llega a su fecha de vencimiento sin que nadie la toque no produce ninguna escritura, así que la notificación nunca saldría. Es la clase de bug que no se nota hasta que alguien se pierde un vencimiento.

**Sobre la columna `due`:** es **texto libre** — el usuario la escribe a mano (`<input value={task.due}>`, `HyggeOS.jsx:944`) y puede contener `"—"` o cualquier cosa. El frontend la interpreta con `parseDate` (`HyggeOS.jsx:2404`), que solo acepta strings que **empiezan** con `YYYY-MM-DD` y devuelve `null` para el resto. El SQL replica exactamente esa semántica: regex `^\d{4}-\d{2}-\d{2}` y comparar los primeros 10 caracteres.

- [ ] **Step 1: Habilitar pg_cron**

En el Dashboard de Supabase → Database → Extensions, buscar `pg_cron` y habilitarlo.
(Es un toggle; no se puede hacer solo con SQL desde el editor en todos los proyectos.)
Verificar en el SQL Editor:

```sql
select extname from pg_extension where extname = 'pg_cron';
```

Esperado: una fila con `pg_cron`.

- [ ] **Step 2: Escribir el test primero**

Create `files/alice/supabase/notifications-due-cron-test.sql`:

```sql
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
```

- [ ] **Step 3: Correr el test para verificar que falla**

Esperado: `ERROR: function public.notify_due_tasks() does not exist`.

- [ ] **Step 4: Escribir la función y el job**

Create `files/alice/supabase/notifications-due-cron.sql`:

```sql
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
```

- [ ] **Step 5: Correr la función y luego el test**

Pegar `notifications-due-cron.sql` y ejecutar. Luego re-correr `notifications-due-cron-test.sql`.
Esperado: `NOTICE: OK: notify_due_tasks pasa (a) y (b)`.

Verificar que el job quedó agendado:

```sql
select jobname, schedule, active from cron.job where jobname = 'notify-due-tasks';
```

Esperado: una fila con `0 13 * * *` y `active = true`.

- [ ] **Step 6: Commit**

```bash
git add files/alice/supabase/notifications-due-cron.sql files/alice/supabase/notifications-due-cron-test.sql
git commit -m "feat(notif): job pg_cron de vencimientos, idempotente por tarea/persona/día"
```

---

### Task 4: Lógica pura de coalescencia y recuperación

**Files:**
- Create: `files/alice/src/lib/notifications.js`
- Create: `files/alice/test/notifications.test.mjs`
- Modify: `files/alice/package.json` (agregar script `test`)

**Interfaces:**
- Consumes: nada (módulo puro, sin React ni red).
- Produces:
  - `COALESCE_THRESHOLD: number` (= 3)
  - `selectPending(rows: Row[], deliveredIds: Iterable<string>): Row[]`
  - `coalesce(pending: Row[]): Banner[] | null` donde `Banner = { title: string, body: string, deepLink: string, ids: string[] }`
  - `taskIdFromDeepLink(link: string): number | null`

  La Task 5 importa estas cuatro cosas con exactamente estos nombres.

`files/alice` no tiene infraestructura de tests hoy. Se usa `node --test`, igual que `alicia-brain` (cuya suite corre con `node --test test/*.test.mjs`). Por eso este módulo es **JavaScript plano sin imports de React**: así `node --test` puede importarlo directo, sin transpilar JSX.

- [ ] **Step 1: Agregar el script de test**

Modify `files/alice/package.json` — en el bloque `"scripts"`, agregar:

```json
    "test": "node --test test/*.test.mjs",
```

- [ ] **Step 2: Escribir los tests que fallan**

Create `files/alice/test/notifications.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { selectPending, coalesce, taskIdFromDeepLink, COALESCE_THRESHOLD } from "../src/lib/notifications.js";

const fila = (id, over = {}) => ({
  id, kind: "task_assigned", title: `T${id}`, body: "",
  deep_link: `#/task/${id}`, urgency: "now", delivered_at: null,
  created_at: `2026-08-30T10:0${id}:00Z`, ...over,
});

test("selectPending descarta las ya entregadas por delivered_at", () => {
  const rows = [fila("1"), fila("2", { delivered_at: "2026-08-30T10:05:00Z" })];
  assert.deepEqual(selectPending(rows, []).map(r => r.id), ["1"]);
});

test("selectPending descarta las ya mostradas en esta sesión", () => {
  const rows = [fila("1"), fila("2")];
  assert.deepEqual(selectPending(rows, ["1"]).map(r => r.id), ["2"]);
});

test("selectPending ignora las urgency=digest", () => {
  const rows = [fila("1", { urgency: "digest" }), fila("2")];
  assert.deepEqual(selectPending(rows, []).map(r => r.id), ["2"]);
});

test("selectPending ordena de más vieja a más nueva", () => {
  const rows = [fila("3"), fila("1"), fila("2")];
  assert.deepEqual(selectPending(rows, []).map(r => r.id), ["1", "2", "3"]);
});

test("coalesce sin pendientes devuelve null", () => {
  assert.equal(coalesce([]), null);
});

test("coalesce hasta el umbral devuelve un banner por notificación", () => {
  const p = [fila("1"), fila("2"), fila("3")];
  const out = coalesce(p);
  assert.equal(out.length, 3);
  assert.equal(out[0].title, "T1");
  assert.deepEqual(out[0].ids, ["1"]);
  assert.equal(out[0].deepLink, "#/task/1");
});

test("coalesce sobre el umbral devuelve un solo banner resumen", () => {
  const p = [fila("1"), fila("2"), fila("3"), fila("4")];
  const out = coalesce(p);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "4 novedades");
  assert.deepEqual(out[0].ids, ["1", "2", "3", "4"]);
  assert.equal(out[0].deepLink, "#/space/notifications");
});

test("el umbral es 3", () => {
  assert.equal(COALESCE_THRESHOLD, 3);
});

test("taskIdFromDeepLink extrae el id o devuelve null", () => {
  assert.equal(taskIdFromDeepLink("#/task/999"), 999);
  assert.equal(taskIdFromDeepLink("#/space/notifications"), null);
  assert.equal(taskIdFromDeepLink(""), null);
  assert.equal(taskIdFromDeepLink(undefined), null);
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd files/alice && npm test`
Esperado: FAIL — `Cannot find module '../src/lib/notifications.js'`.

- [ ] **Step 4: Escribir el módulo**

Create `files/alice/src/lib/notifications.js`:

```js
// Lógica pura de notificaciones — sin React, sin red, sin Supabase.
// Vive aparte del hook justamente para poder testearla con `node --test`, igual
// que la suite del brain. Todo lo que dependa del navegador va en useNotifications.js.

// Sobre 3 pendientes se muestra un único aviso resumen. Sin esto, abrir la laptop
// el lunes dispara un banner por cada evento acumulado y el equipo apaga las
// notificaciones ese mismo día — que es la forma más común en que esto fracasa.
export const COALESCE_THRESHOLD = 3;

// Notificaciones que todavía no se le mostraron a esta persona en esta máquina.
// `deliveredIds` cubre el caso de que Realtime y la consulta de recuperación
// traigan la misma fila: sin esa guardia, se vería dos veces.
export function selectPending(rows, deliveredIds) {
  const vistas = deliveredIds instanceof Set ? deliveredIds : new Set(deliveredIds || []);
  return (rows || [])
    .filter(r => r && r.id && !r.delivered_at && !vistas.has(r.id) && r.urgency === "now")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// Devuelve los banners a mostrar, o null si no hay nada.
export function coalesce(pending) {
  const lista = pending || [];
  if (lista.length === 0) return null;

  if (lista.length <= COALESCE_THRESHOLD) {
    return lista.map(n => ({
      title: n.title,
      body: n.body || "",
      deepLink: n.deep_link || "",
      ids: [n.id],
    }));
  }

  return [{
    title: `${lista.length} novedades`,
    body: lista.slice(0, COALESCE_THRESHOLD).map(n => n.title).join(" · "),
    deepLink: "#/space/notifications",
    ids: lista.map(n => n.id),
  }];
}

// El routing por fragmento del ERP ya existe (HyggeOS.jsx:15152): #/task/<id>.
export function taskIdFromDeepLink(link) {
  const m = /^#\/task\/(\d+)/.exec(String(link || ""));
  return m ? parseInt(m[1], 10) : null;
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd files/alice && npm test`
Esperado: PASS — `# pass 9`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add files/alice/src/lib/notifications.js files/alice/test/notifications.test.mjs files/alice/package.json
git commit -m "feat(notif): lógica pura de coalescencia y recuperación, con tests"
```

---

### Task 5: La web escucha, notifica y refresca la tarea

**Files:**
- Create: `files/alice/src/lib/useNotifications.js`
- Modify: `files/alice/src/lib/supabase.js` (agregar `db.getTask`)
- Modify: `files/alice/src/HyggeOS.jsx` (montar el hook junto a `useERPSync`, línea ~15072)

**Interfaces:**
- Consumes: `selectPending`, `coalesce`, `taskIdFromDeepLink`, `COALESCE_THRESHOLD` de `./notifications.js` (Task 4); tabla `notifications` (Tasks 1–3).
- Produces:
  - `db.getTask(id: number): Promise<Task>` en `lib/supabase.js`
  - `useNotifications({ enabled: boolean, setTasks: Function, loaded: boolean }): void`
  - Contrato con el shell (Task 6): `window.alice.notify({ title, body, deepLink })`, `window.alice.onResume(cb)`, `window.alice.onOpen(cb)`.

**Dos trampas que hay que evitar:**

1. **`authUser.id` NO es el uid de Supabase.** `fetchProfile` (`auth/AuthContext.jsx`) devuelve `id: data.alice_id`, o sea `"sb"`. El `recipient` de la tabla es el uid de `auth.users`. El uid se saca de `supabase.auth.getSession()`. Si se filtra por `authUser.id` no llega nada y no da error.
2. **La notificación llega en vivo pero la tarea no** (Riesgo R2 del spec). `useERPSync` hidrata una sola vez al cargar y no hay Realtime sobre `tasks`. Si no se refresca la tarea antes de mostrar el banner, el usuario hace clic y `#/task/123` abre un panel vacío.

- [ ] **Step 1: Agregar `db.getTask` a lib/supabase.js**

Modify `files/alice/src/lib/supabase.js` — dentro del objeto `db`, justo después de `getTasks`:

```js
  // Refresca UNA tarea. La usa el hook de notificaciones: useERPSync solo hidrata
  // al cargar, así que una tarea creada después de que abrió la app no está en el
  // estado local y el deep link abriría un panel vacío.
  async getTask(id) {
    const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
    if (error) throw error;
    return fromRow(data);
  },
```

- [ ] **Step 2: Escribir el hook**

Create `files/alice/src/lib/useNotifications.js`:

```js
import { useEffect, useRef } from "react";
import { supabase, db } from "./supabase";
import { selectPending, coalesce, taskIdFromDeepLink } from "./notifications.js";

// Muestra un banner. Detección de capacidad, no negociable: alice.bam.pe también
// se abre en navegador normal, y el shell de escritorio se actualiza más lento que
// la web. Si esto asumiera que window.alice existe, bastaría con que alguien tenga
// el shell viejo para que la web se le caiga.
function mostrar(banner, irA) {
  if (typeof window === "undefined") return;

  if (window.alice?.notify) {
    window.alice.notify(banner);   // el shell pone el banner nativo de macOS
    return;
  }

  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    const n = new Notification(banner.title, { body: banner.body });
    n.onclick = () => { window.focus(); irA(banner.deepLink); };
  } else if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function useNotifications({ enabled, setTasks, loaded }) {
  const mostradas = useRef(new Set());   // ids ya mostrados en esta sesión
  const setTasksRef = useRef(setTasks);
  setTasksRef.current = setTasks;

  useEffect(() => {
    if (!loaded || !enabled) return;

    let vivo = true;
    let canal = null;
    let quitarResume = null;
    let quitarOpen = null;

    const irA = (link) => { if (link) window.location.hash = link; };

    // Trae la tarea del deep link al estado local antes de que el usuario haga clic.
    const refrescarTarea = async (link) => {
      const id = taskIdFromDeepLink(link);
      if (id == null) return;
      try {
        const tarea = await db.getTask(id);
        setTasksRef.current(prev =>
          prev.some(t => t.id === tarea.id)
            ? prev.map(t => (t.id === tarea.id ? { ...t, ...tarea } : t))
            : [tarea, ...prev]
        );
      } catch { /* si falla, el banner igual sale; el panel se hidrata al recargar */ }
    };

    const entregar = async (filas) => {
      const pendientes = selectPending(filas, mostradas.current);
      if (!pendientes.length) return;

      // El refetch va sobre las filas pendientes, NO sobre los banners: cuando hay
      // coalescencia el banner resumen apunta a #/space/notifications y perdería
      // los deep links individuales, que son justo las tareas que hay que traer.
      await Promise.all(pendientes.map(n => refrescarTarea(n.deep_link)));

      const banners = coalesce(pendientes);
      if (!banners) return;

      for (const b of banners) {
        mostrar(b, irA);
        b.ids.forEach(id => mostradas.current.add(id));
      }

      const ids = banners.flatMap(b => b.ids);
      await supabase
        .from("notifications")
        .update({ delivered_at: new Date().toISOString() })
        .in("id", ids);
    };

    // Consulta de recuperación: lo que se perdió mientras la Mac dormía o la app
    // estuvo cerrada. Sin esto, todo evento ocurrido con el socket caído se pierde.
    const recuperar = async (uid) => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient", uid)
        .is("delivered_at", null)
        .order("created_at", { ascending: true });
      if (vivo && data?.length) await entregar(data);
    };

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;           // uid de Supabase, NO authUser.id
      if (!uid || !vivo) return;

      await recuperar(uid);

      canal = supabase
        .channel(`notif:${uid}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `recipient=eq.${uid}` },
          payload => { if (vivo) entregar([payload.new]); })
        .subscribe();

      // El shell avisa cuando la Mac despierta: el WebSocket se murió en silencio.
      quitarResume = window.alice?.onResume?.(() => recuperar(uid));
      // Y avisa cuándo se hizo clic en un banner nativo. El shell manda el destino;
      // la web decide qué hacer con él (nunca al revés).
      quitarOpen = window.alice?.onOpen?.(link => irA(link));
    })();

    return () => {
      vivo = false;
      if (canal) supabase.removeChannel(canal);
      if (quitarResume) quitarResume();
      if (quitarOpen) quitarOpen();
    };
  }, [enabled, loaded]);
}
```

- [ ] **Step 3: Montar el hook en HyggeOS**

Modify `files/alice/src/HyggeOS.jsx`:

Agregar el import junto a los otros de `lib` (cerca de la línea 19, `import { db } from "./lib/supabase";`):

```js
import { useNotifications } from "./lib/useNotifications.js";
```

Y justo debajo de la llamada a `useERPSync` (línea ~15072):

```js
  // Notificaciones de escritorio · respeta el toggle de Ajustes, que hasta ahora
  // existía en la UI (prefs.notifyDesktop) y no estaba conectado a nada.
  const notifyDesktop = (users.find(u => u.id === authUser?.id)?.preferences || DEFAULT_PREFS).notifyDesktop !== false;
  useNotifications({ enabled: notifyDesktop, setTasks, loaded });
```

- [ ] **Step 4: Verificar que el bundle compila**

Run: `cd files/alice && npm run build`
Esperado: build exitoso, sin errores de import.

- [ ] **Step 5: Probar de punta a punta en el navegador**

1. `cd files/alice && npm run dev`, abrir la app y conceder el permiso de notificaciones cuando lo pida.
2. En otra ventana (o desde el SQL Editor), asignarle una tarea a tu usuario **desde otra sesión** — el trigger omite al actor, así que asignártela vos mismo desde la misma sesión no notifica (eso es correcto, no un bug).
3. Esperado: aparece el banner del navegador con el título de la tarea, y al hacer clic se abre el panel de esa tarea.

- [ ] **Step 6: Commit**

```bash
git add files/alice/src/lib/useNotifications.js files/alice/src/lib/supabase.js files/alice/src/HyggeOS.jsx
git commit -m "feat(notif): la web escucha Realtime, refresca la tarea y conecta prefs.notifyDesktop"
```

---

### Task 6: Shell de Electron

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/main.js`
- Create: `desktop/preload.js`
- Create: `desktop/offline.html`
- Modify: `.gitignore` (ignorar `desktop/node_modules` y `desktop/dist`)

**Interfaces:**
- Consumes: el contrato de la Task 5 — el shell debe exponer `window.alice.notify(banner)`, `window.alice.onResume(cb)` y `window.alice.onOpen(cb)`, donde `banner = { title, body, deepLink }` y los `on*` devuelven una función para desuscribirse.
- Produces: la app de escritorio. La Task 7 la empaqueta.

**`desktop/` es CommonJS a propósito.** Su `package.json` NO lleva `"type": "module"` — Electron carga `main` y `preload` como CJS. El resto del repo es ESM; esta es la excepción y está bien.

- [ ] **Step 1: Crear el paquete e instalar Electron**

```bash
mkdir -p desktop
cat > desktop/package.json <<'EOF'
{
  "name": "alice-desktop",
  "version": "0.1.0",
  "description": "ALICE · Hygge Holding · shell de escritorio",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  },
  "devDependencies": {
    "electron": "^32.0.0"
  }
}
EOF
cd desktop && npm install
```

Si `npm` avisa de scripts pendientes: `npm approve-scripts --allow-scripts-pending` y aprobarlos (Electron necesita su script de post-install para bajar el binario).

- [ ] **Step 2: Escribir el preload**

Create `desktop/preload.js`:

```js
// Puente entre la web y el shell. Superficie mínima y explícita: el shell NUNCA
// inyecta JavaScript en la página ni toca su estado. Le manda mensajes y la web
// decide qué hacer con ellos.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alice", {
  notify: (banner) => ipcRenderer.send("alice:notify", banner),

  onResume: (cb) => {
    const h = () => cb();
    ipcRenderer.on("alice:resume", h);
    return () => ipcRenderer.removeListener("alice:resume", h);
  },

  onOpen: (cb) => {
    const h = (_e, link) => cb(link);
    ipcRenderer.on("alice:open", h);
    return () => ipcRenderer.removeListener("alice:open", h);
  },
});
```

- [ ] **Step 3: Escribir el proceso principal**

Create `desktop/main.js`:

```js
const path = require("path");
const {
  app, BrowserWindow, Tray, Menu, Notification,
  ipcMain, powerMonitor, shell, nativeImage,
} = require("electron");

const APP_URL = "https://alice.bam.pe";

let win = null;
let tray = null;
let saliendo = false;

function crearVentana() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "ALICE",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Electron lo trae en true por defecto y estrangula los timers de las
      // ventanas ocultas. Sin esto, "notifica con la ventana cerrada" se degrada
      // de formas raras y difíciles de diagnosticar.
      backgroundThrottling: false,
    },
  });

  win.loadURL(APP_URL);
  win.once("ready-to-show", () => win.show());

  // Sin red o con Netlify caído, Chromium muestra una página en blanco y la app
  // parece rota. La pantalla de fallback dice cuál de las dos fallas está pasando.
  win.webContents.on("did-fail-load", (_e, code, desc, _url, esPrincipal) => {
    if (!esPrincipal) return;
    win.loadFile(path.join(__dirname, "offline.html"), {
      query: { code: String(code), desc: desc || "" },
    });
  });

  // Cerrar oculta, no cierra: es lo que mantiene vivos el renderer y su WebSocket,
  // y por lo tanto lo que hace verdad "notifica con el navegador cerrado".
  win.on("close", (e) => {
    if (saliendo) return;
    e.preventDefault();
    win.hide();
  });

  // Los enlaces externos van al navegador del sistema, no abren ventanas de Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function mostrarVentana() {
  if (!win) return crearVentana();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function crearTray() {
  // Ícono vacío + título de texto: en macOS alcanza y evita meter un binario al
  // repo. Un ícono template propio es cosmético y puede venir después.
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("◐");
  tray.setToolTip("ALICE");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir ALICE", click: mostrarVentana },
    { label: "Recargar", click: () => win && win.loadURL(APP_URL) },
    { type: "separator" },
    { label: "Salir", click: () => { saliendo = true; app.quit(); } },
  ]));
  tray.on("click", mostrarVentana);
}

// Una sola instancia: abrir la app dos veces enfoca la que ya está corriendo.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostrarVentana);

  app.whenReady().then(() => {
    crearVentana();
    crearTray();

    app.setLoginItemSettings({ openAtLogin: true });

    // Al despertar, el WebSocket de Realtime ya se murió en silencio. La web hace
    // la consulta de recuperación cuando recibe este aviso.
    powerMonitor.on("resume", () => {
      if (win) win.webContents.send("alice:resume");
    });

    app.on("activate", mostrarVentana);
  });
}

// No salir al cerrar la última ventana: la app vive en la barra de menú.
app.on("window-all-closed", () => {});
app.on("before-quit", () => { saliendo = true; });

ipcMain.on("alice:notify", (_e, banner) => {
  if (!Notification.isSupported() || !banner?.title) return;

  const n = new Notification({ title: banner.title, body: banner.body || "" });
  n.on("click", () => {
    mostrarVentana();
    // Le mandamos el destino a la web y ella navega. No ejecutamos JS en la página.
    if (banner.deepLink && win) win.webContents.send("alice:open", banner.deepLink);
  });
  n.show();
});
```

- [ ] **Step 4: Escribir la pantalla offline**

Create `desktop/offline.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>ALICE · sin conexión</title>
<style>
  body { margin: 0; height: 100vh; display: grid; place-items: center;
         font: 14px -apple-system, system-ui, sans-serif; color: #0A0B0F; background: #FAF9F7; }
  .caja { max-width: 380px; text-align: center; }
  h1 { font-size: 18px; font-weight: 500; margin: 0 0 8px; }
  p { color: #6B6863; line-height: 1.5; margin: 0 0 20px; }
  button { font: inherit; padding: 8px 18px; border: 1px solid #0A0B0F;
           background: transparent; border-radius: 2px; cursor: pointer; }
</style>
<div class="caja">
  <h1 id="titulo">Sin conexión</h1>
  <p id="detalle">Reintentando…</p>
  <button onclick="location.href='https://alice.bam.pe'">Reintentar</button>
</div>
<script>
  // Distinguir las dos fallas importa: si se cayó Netlify, la UI muere pero los
  // datos están bien; si se cayó Supabase, no hay nada que hacer desde acá. Un
  // "sin conexión" genérico no le sirve a nadie.
  const SUPABASE = "https://apnzitklhxrcszectbxx.supabase.co";
  const vivo = (url) =>
    fetch(url, { mode: "no-cors", cache: "no-store" }).then(() => true).catch(() => false);

  (async () => {
    const [web, datos] = await Promise.all([vivo("https://alice.bam.pe"), vivo(SUPABASE)]);
    const t = document.getElementById("titulo");
    const d = document.getElementById("detalle");
    if (!web && !datos) {
      t.textContent = "Sin internet";
      d.textContent = "Esta Mac no tiene conexión. Las notificaciones se recuperan solas al volver.";
    } else if (!web && datos) {
      t.textContent = "El ERP no responde";
      d.textContent = "Los datos están bien (Supabase responde), pero alice.bam.pe no carga. Suele ser un deploy en curso: reintenta en un minuto.";
    } else {
      t.textContent = "Falla de datos";
      d.textContent = "La web carga pero Supabase no responde. Nada que hacer desde acá — avisa al equipo.";
    }
  })();
</script>
```

- [ ] **Step 5: Ignorar los artefactos de build**

Modify `.gitignore` — agregar al final:

```
# Shell de escritorio
desktop/node_modules/
desktop/dist/
```

- [ ] **Step 6: Probar la app a mano**

Run: `cd desktop && npm start`

Verificar, uno por uno:
1. Abre `alice.bam.pe` y se puede iniciar sesión.
2. Aparece `◐` en la barra de menú, con su menú de tres opciones.
3. Cerrar la ventana con ⌘W **oculta** la app; el ícono de la barra sigue ahí y "Abrir ALICE" la trae de vuelta.
4. Con la ventana oculta, asignarle una tarea a ese usuario desde otra sesión → **aparece el banner nativo de macOS**.
5. Clic en el banner → la ventana se muestra y abre esa tarea.
6. Apagar el WiFi y elegir "Recargar" en el menú → sale la pantalla offline con el diagnóstico correcto.
7. Dormir la Mac, asignar una tarea desde otra máquina, despertarla → llega la notificación por la recuperación.

- [ ] **Step 7: Commit**

```bash
git add desktop/package.json desktop/main.js desktop/preload.js desktop/offline.html .gitignore
git commit -m "feat(desktop): shell de Electron — tray, arranque al login, banner nativo y fallback offline"
```

---

### Task 7: Firma, notarización y auto-update

**Files:**
- Create: `desktop/electron-builder.yml`
- Create: `desktop/build/entitlements.mac.plist`
- Create: `desktop/build/icon.png`
- Create: `desktop/README.md`
- Modify: `desktop/package.json` (scripts de build, `electron-updater` como dependencia)
- Modify: `desktop/main.js` (chequeo de actualizaciones)

**Interfaces:**
- Consumes: el shell de la Task 6.
- Produces: un DMG universal firmado y notarizado, publicado en GitHub Releases, que se auto-actualiza.

**Por qué la firma no es opcional aunque ustedes provisionen las Macs:** `electron-updater` corre sobre Squirrel.Mac, que antes de aplicar una actualización verifica que la firma de la versión nueva coincida con la de la que está corriendo. Sin un Developer ID no hay auto-update, y cada cambio vuelve a ser "que los 7 bajen el DMG a mano".

- [ ] **Step 1: Preparar la cuenta de Apple**

1. Inscribirse en el Apple Developer Program (US$99/año) si no está hecho.
2. En Xcode → Settings → Accounts, crear un certificado **Developer ID Application**.
3. En appleid.apple.com, generar una **app-specific password** para la notarización.
4. Anotar el **Team ID** (aparece en developer.apple.com → Membership).

Verificar que el certificado está en el llavero:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Esperado: al menos una identidad `Developer ID Application: ... (TEAMID)`.

- [ ] **Step 2: Generar el ícono**

`files/alice/public/bam-logo.png` es 2000×675 (apaisado). Un `.icns` necesita un cuadrado, así que se rellena con `sips`, que viene con macOS:

```bash
mkdir -p desktop/build
# En dos pasos a propósito: encadenar --padToHeightWidth con --resampleHeightWidth
# en una sola invocación NO funciona — sips aplica el pad y devuelve 2000x2000,
# ignorando el resample. Verificado el 30 ago 2026.
sips -s format png files/alice/public/bam-logo.png \
     --padToHeightWidth 2000 2000 --padColor FAF9F7 \
     --out desktop/build/icon.png
sips --resampleHeightWidth 1024 1024 desktop/build/icon.png --out desktop/build/icon.png
file desktop/build/icon.png
```

Esperado: `PNG image data, 1024 x 1024`. electron-builder genera el `.icns` a partir de este archivo.

- [ ] **Step 3: Escribir los entitlements**

Create `desktop/build/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- El hardened runtime bloquea por defecto lo que V8 necesita para compilar
       JavaScript. Sin estas tres, la app firmada arranca y se cae al instante. -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 4: Escribir la configuración de electron-builder**

Create `desktop/electron-builder.yml`:

```yaml
appId: pe.hygge.alice.desktop
productName: ALICE
copyright: Hygge Holding

directories:
  buildResources: build
  output: dist

files:
  - main.js
  - preload.js
  - offline.html
  - package.json

mac:
  category: public.app-category.productivity
  icon: build/icon.png
  target:
    - target: dmg
      arch: [universal]
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize: true

publish:
  provider: github
  owner: sebonillarojas-sketch
  repo: alice
```

- [ ] **Step 5: Agregar electron-updater y los scripts**

Modify `desktop/package.json` — queda así:

```json
{
  "name": "alice-desktop",
  "version": "0.1.0",
  "description": "ALICE · Hygge Holding · shell de escritorio",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "pack": "electron-builder --mac --publish never",
    "release": "electron-builder --mac --publish always"
  },
  "dependencies": {
    "electron-updater": "^6.3.0"
  },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0"
  }
}
```

`electron-updater` va en `dependencies`, no en `devDependencies`: se carga en tiempo de ejecución y tiene que ir dentro del paquete.

Run: `cd desktop && npm install`

- [ ] **Step 6: Enchufar el auto-update en main.js**

Modify `desktop/main.js`:

Agregar al final de los `require` de arriba:

```js
const { autoUpdater } = require("electron-updater");
```

Y dentro de `app.whenReady().then(...)`, después de `app.on("activate", mostrarVentana);`:

```js
    // Chequea al arrancar y cada 6 horas. La app vive días en la barra de menú,
    // así que un solo chequeo al inicio dejaría versiones viejas corriendo semanas.
    autoUpdater.checkForUpdatesAndNotify();
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 6 * 60 * 60 * 1000);
```

- [ ] **Step 7: Buildear sin publicar y verificar la firma**

```bash
cd desktop
export APPLE_ID="sebastian@hygge.pe"
export APPLE_APP_SPECIFIC_PASSWORD="<la del Step 1>"
export APPLE_TEAM_ID="<el Team ID>"
npm run pack
```

Verificar que quedó firmada y notarizada:

```bash
codesign --verify --deep --strict --verbose=2 "dist/mac-universal/ALICE.app"
spctl --assess --type execute --verbose "dist/mac-universal/ALICE.app"
```

Esperado: `satisfies its Designated Requirement` y `source=Notarized Developer ID`.

- [ ] **Step 8: Publicar el primer release**

```bash
cd desktop
export GH_TOKEN="<token de GitHub con permiso repo>"
npm run release
```

Esperado: aparece un release `v0.1.0` en `github.com/sebonillarojas-sketch/alice/releases` con el `.dmg`, el `.zip` y el `latest-mac.yml` (este último es el que lee `electron-updater`).

- [ ] **Step 9: Verificar el auto-update de verdad**

Esta es la única forma de saber que funciona:

1. Instalar el DMG de la `0.1.0` en una Mac y abrirlo.
2. Subir la versión a `0.1.1` en `desktop/package.json` y correr `npm run release` otra vez.
3. Dejar la `0.1.0` abierta y esperar el chequeo (o reiniciarla).
4. Esperado: se descarga la actualización sola y macOS avisa que está lista.

Si acá aparece `Could not get code signature for running application`, la firma quedó mal: volver al Step 7.

- [ ] **Step 10: Escribir el README de distribución**

Create `desktop/README.md`:

```markdown
# ALICE · shell de escritorio

App de Electron que envuelve `alice.bam.pe` y agrega notificaciones nativas de macOS.

## Qué se actualiza solo y qué no

- **El ERP** (todo lo de `files/alice`) se actualiza **solo**, vía Netlify. No hace
  falta publicar una versión de la app por un cambio del ERP.
- **El shell** (esta carpeta) requiere un release firmado. Debería cambiar pocas
  veces al año.

## Publicar una versión

```bash
export APPLE_ID="sebastian@hygge.pe"
export APPLE_APP_SPECIFIC_PASSWORD="..."   # app-specific password de appleid.apple.com
export APPLE_TEAM_ID="..."
export GH_TOKEN="..."                      # token de GitHub con permiso `repo`
npm version patch
npm run release
```

## Instalar por primera vez

Bajar el `.dmg` del último release en GitHub, arrastrar ALICE a Aplicaciones, abrir.
Al primer banner, macOS pide permiso de notificaciones: hay que concederlo.
De ahí en adelante se actualiza sola.

## Reglas del proyecto

- **La web nunca depende de la app.** Toda llamada web→shell va con detección de
  capacidad (`if (window.alice?.notify)`) y funciona igual en navegador.
- **El shell nunca inyecta JavaScript en la página.** Le manda mensajes por IPC y
  la web decide.
- `desktop/` es **CommonJS** a propósito, aunque el resto del repo sea ESM.
```

- [ ] **Step 11: Commit**

```bash
git add desktop/electron-builder.yml desktop/build/entitlements.mac.plist \
        desktop/build/icon.png desktop/README.md desktop/package.json desktop/main.js
git commit -m "feat(desktop): firma, notarización y auto-update contra GitHub Releases"
```

---

## Verificación final

Antes de dar la Fase 1 por terminada, con la app instalada en dos Macs distintas:

- [ ] A le asigna una tarea a B → a B le llega el banner en segundos, con la ventana oculta.
- [ ] B hace clic en el banner → se abre la ventana **en esa tarea**, con sus datos (no un panel vacío).
- [ ] A se asigna una tarea a sí mismo → **no** le llega nada.
- [ ] A edita el título de una tarea ya asignada a B → **no** le llega nada a B.
- [ ] Con la app de B cerrada, A le asigna tres tareas; B abre la app → llegan las tres.
- [ ] Con la app de B cerrada, A le asigna cinco tareas; B abre la app → llega **un solo** aviso "5 novedades".
- [ ] B apaga "Notificaciones en navegador/desktop" en Ajustes → dejan de llegar banners.
- [ ] Una tarea que vence hoy → llega el aviso a las 8:00 de Lima.
- [ ] Reiniciar la Mac → ALICE arranca sola y aparece en la barra de menú.
- [ ] `cd files/alice && npm test` → 9 tests en verde.
