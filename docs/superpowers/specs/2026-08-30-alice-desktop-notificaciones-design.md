# ALICE Desktop · Notificaciones en tiempo real · Diseño

_2026-08-30 · repo `alice` / `files/alice` + Supabase_

## Contexto

El ERP (`files/alice`, React+Vite, desplegado por Netlify en `alice.bam.pe`) **parece** tener
notificaciones y no las tiene:

- `NotificationsToolView` (`HyggeOS.jsx:10199`) muestra un feed que alimenta `recordActivity`
  (`HyggeOS.jsx:15616`), y ese feed es **puramente local**: se persiste en `localStorage` bajo
  `"hygge:activity"` (`HyggeOS.jsx:15380`), últimos 50 eventos, y **nunca sale del dispositivo**.
  Si A menciona a B desde su Mac, la Mac de B jamás se entera.
- Ajustes ya expone el toggle **"Notificaciones en navegador/desktop"** (`prefs.notifyDesktop`,
  `HyggeOS.jsx:10589`) que **no está conectado a nada**: no hay una sola llamada a la Notification
  API en todo el bundle.
- No existe ningún transporte en vivo: ni Realtime, ni SSE, ni WebSocket, ni web-push.

Lo que sí existe y este diseño reutiliza:

- **Supabase Auth real** (`auth/AuthContext.jsx`), con perfiles en `user_profiles` (que trae tanto
  el uid de Supabase como el `alice_id`), y **RLS activo** (`files/alice/supabase/rls-policies.sql`).
- **Tareas persistidas en Supabase** — `db.upsertTask` (`lib/supabase.js`) es el camino real de
  escritura, usado en ~15 call-sites de `HyggeOS.jsx`.
- **Routing por fragmento ya construido**: `#/task/<id>` y `#/space/<id>` con listener de
  `hashchange` (`HyggeOS.jsx:15152`), y un "copiar link" que ya genera esa URL (`HyggeOS.jsx:891`).
- **Auto-recarga del bundle ya construida**: `useAutoUpdate()` (`App.jsx:570`) chequea cada 5 min
  el nombre hasheado del bundle y recarga cuando hay deploy nuevo.
- El brain (`alicia-brain`) ya entrega info por WhatsApp: `briefing.js` (7:00am, ejecutivo, con
  LLM) y `team-briefing.js` (9:00am, por persona, **sin LLM a propósito**).

## Objetivo

Que el equipo (7 personas, todas en macOS) reciba en su Mac, **en el momento en que ocurre**, lo
que hoy nadie les avisa — empezando por las tareas — mediante una app de escritorio que vive en la
barra de menú y notifica aunque el navegador esté cerrado.

## Reparto de canales (decidido)

**Escritorio = tiempo real. WhatsApp = resumen diario.** Sin solapamiento. El escritorio avisa
cosas que pasan *ahora* y no pueden esperar a mañana; los briefings de WhatsApp **no se tocan**.
La columna `urgency` (`now` | `digest`) deja esa regla escrita en el modelo de datos, no en la
cabeza de quien implemente. En la Fase 1 **nada escribe `digest`**: el valor existe desde el
principio para que los emisores de la Fase 3 no tengan que migrar la tabla, y para que el shell
pueda ignorar esas filas sin lógica especial.

Razón: si ambos canales mandan lo mismo, el equipo ignora los dos. La fatiga de notificaciones es
la forma habitual en que estos sistemas fracasan — no fallan técnicamente, fallan porque los apagan.

## Alcance / no-alcance

**Dentro (Fase 1):**

1. Tabla `notifications` en Supabase, con RLS por destinatario y agregada a la publicación de Realtime.
2. Trigger de Postgres sobre `tasks` (asignaciones) + job `pg_cron` diario (vencimientos).
3. Solo dos tipos: `task_assigned` y `task_due`, ambos `urgency = 'now'`.
4. App Electron delgada: carga `alice.bam.pe`, dock + barra de menú, arranque al login,
   cerrar oculta, banner nativo, fallback offline.
5. Recuperación tras suspensión/arranque + coalescencia.
6. Refetch de la tarea al abrir una notificación (ver Riesgo R2).
7. Conectar `prefs.notifyDesktop`, que hoy existe y no hace nada.
8. Firma + notarización + DMG + `electron-updater` contra GitHub Releases.

**Fuera:**

- **Mensajes y menciones** (Fase 2b) — hoy `messages` es `localStorage`; moverlo al servidor es un
  proyecto propio con migración de datos.
- **Eventos del brain**: ALICE, lecciones, aprobaciones, mercado (Fase 3) — requieren el puente de
  identidad completo del lado del brain y definir el umbral de "material y accionable" para mercado.
- **Sincronización en vivo del tablero de tareas** (Fase 2, comprometida — ver Fases siguientes).
- **Los briefings de WhatsApp** — no se tocan.
- **Firmar en CI** (Fase 4). Hoy `.github/workflows/node.js.yml` solo chequea sintaxis.

## Decisiones de diseño

### D1 · La notificación la genera la base de datos, no el cliente

Un trigger sobre `tasks`, no JavaScript en el ERP. Así notifica **cualquier** origen del cambio:
el ERP en Chrome, la app de otra persona, ALICE, o una edición a mano en el panel de Supabase.
Si la lógica viviera en el cliente, solo notificarían los cambios hechos desde ese cliente.

Corolario de seguridad: con RLS `auth.uid() = recipient`, ningún cliente puede insertar filas
dirigidas a otra persona. Si abriéramos ese permiso, cualquiera podría fabricarle notificaciones
a cualquiera. El trigger es la única vía de escritura desde el ERP.

### D2 · Electron, no Tauri

El ERP renderiza con WebGL (`Vista3D.jsx:100`, `<Canvas shadows dpr={[1,2]}>` de
`@react-three/fiber`) y parsea DWG con WebAssembly (`libredwg-web`, 191 KB en el bundle).
Tauri usa **WKWebView** (motor de Safari); Electron trae **Chromium**, que es donde el equipo ya
prueba. Con Tauri, cada bug del visor 3D o del parser pasaría a ser "¿también se rompe en Safari?",
para siempre, a cambio de ~130 MB de disco. Además Tauri exige toolchain de Rust en un repo 100% JS.

### D3 · La app carga la URL remota, no un bundle empaquetado

`alice.bam.pe` en vivo. Netlify ya redespliega en cada push a `main`, así que los cambios del ERP
llegan **sin actualizar la app**, y el canal de auto-update queda solo para el shell. Empaquetar el
`dist/` (14 MB) obligaría a publicar una versión firmada y notarizada por cada corrección del ERP.

`useAutoUpdate()` (`App.jsx:570`) ya resuelve que una app viva días no se quede con un bundle viejo.
No hay que construir nada para eso.

### D4 · Shell delgado: la web es dueña del socket

Ocultar una `BrowserWindow` **no destruye el renderer**: la página sigue viva con su sesión y su
socket. Por lo tanto la suscripción a Realtime vive en el bundle web, y el shell solo pone el banner
nativo cuando se lo piden por IPC.

Consecuencias:
- **Una sola sesión de Supabase y un solo socket.** Si el proceso principal tuviera su propio
  cliente, habría dos tokens y dos refresh — origen clásico de "me deslogueó solo".
- **La lógica de notificaciones se actualiza sola** vía Netlify. Un bug en el filtrado o en la
  coalescencia se arregla con un push, no con un release firmado que los 7 deben instalar.
- El shell se encoge a lo que el navegador no puede: ventana, tray, arranque al login, banner
  nativo, eventos de suspensión, fallback offline. Cosas que casi nunca cambian.

### D5 · Invariante: la web nunca depende de la app; la app sí de la web

`alice.bam.pe` también se abre en navegador normal, y el shell se actualiza más lento que la web.
Por eso **toda** interacción web→shell va con detección de capacidad:

```js
if (window.alice?.notify) window.alice.notify(n); else new Notification(n.title, { body: n.body });
```

Si esta invariante se rompe, basta con que alguien tenga el shell viejo para que la web se le caiga,
y ese es un bug carísimo de diagnosticar.

La dependencia inversa (app→web) se expresa **solo mediante una URL**. El shell no inyecta JS ni
conoce el estado de React: abre `alice.bam.pe/#/task/123` y el ERP hace el resto, usando el routing
por fragmento que **ya existe** (`HyggeOS.jsx:15152`).

### D6 · El puente de identidad, en Fase 1 solo dentro de Postgres

`tasks.assignee` y `tasks.assignees[]` guardan **alice ids** (`"sb"`), no uids de Supabase. El
trigger resuelve el uid con un join contra `user_profiles` por `alice_id`, entero dentro de la base.
El puente caro (que el brain lea `user_profiles` con service key) recién hace falta en la Fase 3.

## Componentes

### C1 · Tabla `notifications`

Columnas: `id` (uuid pk), `recipient` (uuid → `auth.users`), `kind`, `title`, `body`, `deep_link`,
`urgency` (`now` | `digest`), `source` (`erp` | `brain`), `created_at`, `read_at`, `delivered_at`.

RLS: `select` y `update` con `auth.uid() = recipient`. **Sin política de `insert` para
`authenticated`** — solo escriben el trigger (`security definer`) y el service role.

Índice: `(recipient, created_at desc)` y uno parcial sobre `delivered_at is null` para la recuperación.

La tabla se agrega explícitamente a la publicación `supabase_realtime`.

Nota: las policies actuales de `tasks`/`terrenos` son `using (true)` (todo el equipo ve todo).
`notifications` **no** sigue ese patrón: es por destinatario.

### C2 · Trigger sobre `tasks` → `task_assigned`

`after insert or update of assignees on tasks`:
- Itera `assignees[]` (jsonb), resuelve cada `alice_id` → uid vía `user_profiles`.
- **Omite al actor** (`auth.uid()`): nadie necesita que le avisen de lo que acaba de hacer él mismo.
- Emite `task_assigned` solo cuando el destinatario aparece en `assignees` y **no estaba antes**
  (comparación `OLD`/`NEW`), para que editar cualquier otro campo no vuelva a notificar.
- `deep_link` = `#/task/<id>`.

### C2b · Job programado → `task_due`

**Un trigger no sirve para los vencimientos.** Solo dispara cuando alguien escribe la fila, y una
tarea que llega a su fecha de vencimiento sin que nadie la toque no produce ninguna escritura: la
notificación nunca saldría. Es la clase de bug que no se nota hasta que alguien se pierde un
vencimiento y ya es tarde.

Se resuelve con **`pg_cron` dentro de Supabase** (una corrida diaria, 8:00 hora de Lima, que llama a
una función `notify_due_tasks()`). Se elige pg_cron y no los crons del brain a propósito: mantiene
la generación de notificaciones dentro de Postgres (D1) y **no requiere el puente de identidad del
brain** (D6), que es trabajo de Fase 3.

La función emite `task_due` para cada tarea abierta que vence hoy, hacia cada asignado, y es
idempotente por `(task_id, recipient, día)` — si la corrida se repite, no duplica.

### C3 · Web (bundle de `files/alice`)

- Suscripción Realtime a `notifications` filtrada por `recipient`, montada tras el login.
- Al llegar una fila con `urgency = 'now'` y `prefs.notifyDesktop !== false`: **refetch de la tarea**
  antes de disparar el banner (ver R2), luego puente de capacidad (D5).
- `delivered_at` se marca al entregar; sirve de guardia contra duplicados entre Realtime y recuperación.
- Recuperación: al montar y cuando el shell avisa `resume`, query de `delivered_at is null`.
- **Coalescencia:** sobre 3 pendientes, un único aviso resumen ("12 novedades"). Sin esto, abrir la
  laptop el lunes dispara 12 banners y el equipo apaga las notificaciones ese mismo día.

### C4 · Shell Electron (nuevo, `desktop/`)

- `BrowserWindow` con **`backgroundThrottling: false`** — Electron lo trae activado por defecto y
  estrangula timers en ventanas ocultas; sin esto, "notifica con la ventana cerrada" se degrada de
  formas raras y difíciles de diagnosticar.
- `close` → `preventDefault()` + `hide()`. `Tray` con menú (Abrir, Recargar, Salir).
- `app.setLoginItemSettings({ openAtLogin: true })`.
- `contextBridge` expone `window.alice.notify(n)` y el canal `resume`.
- Clic en banner → `show()` + navegar a `deep_link`.
- `powerMonitor.on("resume")` → IPC al renderer.
- **Fallback offline nativo**, con reintento, que distingue las dos fallas: Netlify caído (muere la
  UI, el fondo vive) vs Supabase caído (mueren ambos). Un "sin conexión" genérico no ayuda a nadie.

### C5 · Distribución

Apple Developer (US$99/año). La firma **no es opcional aunque el equipo provisione las Macs**:
`electron-updater` corre sobre Squirrel.Mac, que verifica que la firma de la versión nueva coincida
con la de la que está corriendo. Sin Developer ID no hay auto-update, y cada cambio vuelve a ser
"que los 7 bajen el DMG a mano" — eso sobrevive dos actualizaciones.

Notarización para sellar el bit de quarantine. DMG universal. Feed en GitHub Releases (el repo ya es
público; `electron-updater` lo soporta nativo). Build y firma **a mano en la Mac del CEO** en Fase 1.

La app no expone nada nuevo: la URL y la anon key de Supabase ya están hardcodeadas en
`lib/supabase.js` y viajan en el bundle público desde siempre. Lo que protege los datos es RLS +
login, no el secreto de esa clave.

**Costo total del proyecto: US$99/año.** Cero infraestructura nueva.

## Pruebas

Se sigue la convención del repo (`node --test`; la suite del brain está 121/121).

- **Funciones puras con tests primero:** coalescencia (umbral, formato del resumen) y selección de
  pendientes en la recuperación (dedup contra lo ya entregado).
- **Trigger:** script SQL que afirma (a) aparece la fila con el `recipient` correcto resuelto desde
  `alice_id`, (b) el actor no se autonotifica, (c) editar otro campo de la tarea no vuelve a notificar.
- **Job de vencimientos:** correr `notify_due_tasks()` dos veces seguidas no duplica filas.
- **RLS:** un cliente autenticado como A no ve ni puede insertar filas de B.
- **Shell:** prueba manual. No vale la pena montar Spectron para esto.

## Riesgos

**R1 · Realtime con RLS falla en silencio.** Si la tabla no queda bien puesta en la publicación, no
da error: simplemente no llegan eventos. Mitigación: es lo primerísimo que se construye y verifica,
antes de escribir una línea de Electron.

**R2 · ~~La notificación llega en vivo pero la tarea no.~~ CORREGIDO el 30 ago 2026 —
este riesgo era falso.** El spec original afirmaba que no había sincronización en vivo de
tareas, deduciéndolo de `useERPSync` (*"Solo corre una vez"*). Eso es cierto de
`useERPSync`, pero ese es el camino viejo hacia `erp-backend`, **no** el de Supabase. La
sincronización en vivo **ya existía antes de este proyecto**: `db.subscribeTasks`
(`lib/supabase.js:50`) se suscribe a `postgres_changes` sobre `tasks` con `event: "*"`, y
`HyggeOS.jsx` la monta (línea ~15079). Las tareas de otras personas aparecen solas.

El refetch puntual de C3 se mantiene igual: es redundante en el caso normal, pero
defensivo si el canal de `tasks` estuviera silenciado, y cuesta una consulta por
notificación.

Ese mismo archivo destapó un riesgo **real** que el spec no había previsto: `subscribeTasks`
documenta que hay que llamar a `supabase.realtime.setAuth(token)` **antes** de `.subscribe()`,
porque con policies `to authenticated` un canal conectado como anon queda silenciado por RLS
sin dar error. El canal de `notifications` debe hacer lo mismo.

**R3 · Fatiga.** Si la Fase 1 sale ruidosa, el equipo apaga las notificaciones y las fases 2 y 3
nacen muertas. Empezar con solo dos tipos de evento es la forma de calibrar el volumen con algo que
se puede apagar sin perder nada.

**R4 · Focus / No molestar de macOS suprime banners.** No lo controlamos. Por eso el estado real vive
en la tabla y el banner es solo un aviso: nada depende de que se haya mostrado.

## Fases siguientes

**Fase 2 · ~~Sincronización en vivo del tablero.~~ YA ESTABA CONSTRUIDA.** El CEO la marcó
como imprescindible el 30 ago 2026 (*"sin esto no está completo el app ni ALICE"*) sobre la
base del R2 de este spec, que resultó falso — ver arriba. `db.subscribeTasks` ya la
implementa y `HyggeOS` ya la monta. No hay trabajo pendiente acá.

**Fase 2b · Mensajes y menciones al servidor.**

**Fase 3 · Emisores del brain** — ALICE, lecciones, aprobaciones y mercado. El brain ya tiene la
lógica de a-quién-le-importa-qué (`buildRoster`, tareas y agenda por persona en `team-briefing.js`);
lo que falta es separarla del canal de entrega. Requiere `SUPABASE_SERVICE_KEY` en Railway y el
puente de identidad completo (D6). Para mercado hay que definir el umbral de "material y accionable"
(cambio de tasa del BCRP, proyecto nuevo en un distrito seguido) — sin ese umbral, el mercado se
vuelve el ruido que hace que apaguen todo lo demás.

**Fase 4 · Firmar y publicar en CI.**
