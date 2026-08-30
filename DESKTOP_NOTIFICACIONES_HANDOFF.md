# ALICE Desktop · Notificaciones · Puesta en marcha

_30 ago 2026 · rama `docs/desktop-notificaciones`_

Fase 1 completa y revisada, pero **nada de esto se ha ejecutado nunca**: el SQL no se corrió
contra Supabase, la app de Electron no se abrió, y no hay nada firmado ni publicado. Este
documento es lo que falta para que funcione, en orden.

Diseño y decisiones: `docs/superpowers/specs/2026-08-30-alice-desktop-notificaciones-design.md`

---

## 1 · Correr el SQL en Supabase · sin esto no existe nada

En el SQL Editor del proyecto `apnzitklhxrcszectbxx`, en este orden. Los archivos `-test` y
`-verify` no crean nada: verifican y hacen `ROLLBACK`. Todos son idempotentes.

| # | Archivo (en `files/alice/supabase/`) | Salida esperada |
|---|---|---|
| 1 | `notifications.sql` | `Success. No rows returned` |
| 2 | `notifications-verify.sql` | `OK: notifications creada, con RLS, sin insert público y publicada en Realtime` |
| 3 | `notifications-rls-test.sql` | `OK: A no ve las notificaciones de B` |
| 4 | `notifications-trigger.sql` | `Success` |
| 5 | `notifications-trigger-test.sql` | `OK: trigger task_assigned pasa (a), (b) y (c)` |
| 6 | *(dashboard)* Database → Extensions → habilitar **pg_cron** | — |
| 7 | `notifications-due-cron.sql` | `Success` |
| 8 | `notifications-due-cron-test.sql` | `OK: notify_due_tasks pasa (a) y (b)` |

Si alguno lanza excepción, el mensaje dice exactamente qué falta.

**Dos cosas que fallan en silencio si están mal:**

- **Realtime tiene que estar encendido en el proyecto.** Si la tabla no queda en la
  publicación `supabase_realtime`, no llega ni un evento y **no se produce ningún error**.
  El paso 2 lo verifica explícitamente.
- El paso 1 crea un **índice único sobre `user_profiles.alice_id`**. Si la tabla ya tuviera
  duplicados, ese `create index` falla — y eso es deseado: el trigger resuelve el
  destinatario con `select … into`, que ante duplicados agarraría una fila arbitraria y le
  mandaría notificaciones a la persona equivocada sin avisar. Mejor que falle al instalar.

Verificar que el job quedó agendado:

```sql
select jobname, schedule, active from cron.job where jobname = 'notify-due-tasks';
```

Esperado: `0 13 * * *`, `active = true`. (13:00 UTC = 8:00 Lima; Perú no tiene horario de verano.)

## 2 · Probarlo en el navegador · acá se prueba el 80% del sistema

No hace falta instalar nada: toda la lógica de notificación vive en el bundle web.

1. Abrir `alice.bam.pe`, iniciar sesión, y **conceder el permiso de notificaciones**.
2. Que **otra persona** te asigne una tarea. El trigger omite al actor a propósito, así que
   asignártela vos mismo no notifica — eso es correcto, no un bug.
3. Debería aparecer el banner del navegador con el título de la tarea, y al hacer clic
   abrirse el panel de esa tarea.

Si esto funciona, lo que queda es empaquetado.

## 3 · Probar la app de escritorio

```bash
cd ~/Desktop/ALICE/desktop && npm install && npm start
```

Las siete verificaciones, ninguna automatizable:

1. Abre `alice.bam.pe` y se puede iniciar sesión.
2. Aparece `◐` en la barra de menú, con Abrir / Recargar / Salir.
3. ⌘W **oculta** la app; el ícono sigue ahí y "Abrir ALICE" la trae de vuelta.
4. Con la ventana oculta, que otra persona te asigne una tarea → **llega el banner nativo**.
5. Clic en el banner → la ventana se muestra y abre esa tarea.
6. WiFi apagado + "Recargar" → sale la pantalla offline con el diagnóstico correcto.
7. Dormir la Mac, que te asignen una tarea, despertarla → llega por la recuperación.

## 4 · Firmar, notarizar y repartir

Bloqueado hasta que exista la cuenta de **Apple Developer (US$99/año)**. Es el costo total
del proyecto: no hay infraestructura nueva.

Por qué no es opcional: `electron-updater` corre sobre Squirrel.Mac, que verifica que la
firma de la versión nueva coincida con la de la que está corriendo. Sin Developer ID **no
hay auto-update**, y cada cambio vuelve a ser "que los 7 bajen el DMG a mano".

1. Inscribirse en el Apple Developer Program.
2. Xcode → Settings → Accounts → crear certificado **Developer ID Application**.
3. appleid.apple.com → generar una **app-specific password** (para notarizar).
4. Anotar el **Team ID** (developer.apple.com → Membership).

Verificar que el certificado está en el llavero:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Después, buildear y publicar (los comandos completos están en `desktop/README.md`):

```bash
cd ~/Desktop/ALICE/desktop
export APPLE_ID="sebastian@hygge.pe"
export APPLE_APP_SPECIFIC_PASSWORD="..."
export APPLE_TEAM_ID="..."
export GH_TOKEN="..."          # token de GitHub con permiso `repo`
npm run pack                   # firma y notariza, sin publicar
codesign --verify --deep --strict --verbose=2 "dist/mac-universal/ALICE.app"
spctl --assess --type execute --verbose "dist/mac-universal/ALICE.app"
```

Esperado: `satisfies its Designated Requirement` y `source=Notarized Developer ID`.

Recién entonces `npm run release`. **El auto-update solo se puede probar de verdad
publicando dos versiones**: instalar la 0.1.0, subir a 0.1.1, publicar, y dejar la vieja
abierta. Si aparece `Could not get code signature for running application`, la firma quedó mal.

Todo esto tiene que correrse **en la Mac que tiene el certificado**.

---

## Lo que se sabe que falta o puede molestar

**Deuda menor, ninguna bloqueante** (detalle en el historial de la rama):

- El `Set` que recuerda lo ya mostrado crece sin límite durante la sesión; irrelevante al
  volumen real.
- El `update` de `delivered_at` no tiene `catch` propio.
- En reconexiones concurrentes muy seguidas, un banner podría mostrarse dos veces. Preexistente.
- El `fetch` de la pantalla offline da "vivo" ante cualquier respuesta alcanzable, incluso
  un 500 o un portal cautivo.
- La policy de UPDATE de `notifications` permite reescribir cualquier columna de las filas
  propias, no solo `delivered_at`/`read_at`.
- `notify_due_tasks()` queda con EXECUTE a PUBLIC. Es idempotente y solo genera
  notificaciones legítimas, pero un `revoke execute … from anon, authenticated` es gratis.

**Pregunta abierta:** los bloques `allowScripts` de `alicia-brain/package.json` y
`files/alice/package.json` (commit `6ffb215`) estaban sin commitear en el working tree y se
commitearon aparte. La revisión final señaló que podrían ser campos inertes, porque no hay
`@lavamoat/allow-scripts` en el repo. Si no sirven, `git revert 6ffb215`.

## Fases siguientes

- **Fase 2 · Mensajes y menciones al servidor.** Hoy `messages` es `localStorage`: moverlo
  es un proyecto propio con migración de datos.
- **Fase 3 · Emisores del brain** — ALICE, lecciones, aprobaciones y mercado. El brain ya
  tiene la lógica de a-quién-le-importa-qué (`buildRoster`, `team-briefing.js`); falta
  separarla del canal de entrega. Requiere `SUPABASE_SERVICE_KEY` en Railway y que el brain
  lea `user_profiles` para traducir `alice_id` → uid. Para mercado hay que definir el umbral
  de "material y accionable", o se vuelve el ruido que hace que apaguen todo lo demás.
- **Fase 4 · Firmar y publicar desde CI.**

**Los briefings de WhatsApp no se tocaron** y siguen igual: escritorio = tiempo real,
WhatsApp = resumen diario.
