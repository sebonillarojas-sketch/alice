# Multitareas — multi-asignación de tareas · Diseño

_2026-08-09 · repo `alice` (frontend `files/alice`, Alicia `alicia-brain`, backend `erp-backend`)_

## Contexto

Las tareas del ERP se pueden asignar a **una sola** persona en la mayoría de los flujos. La fuente de verdad compartida es la tabla **`tasks` de Supabase**, que leen/escriben tanto el ERP web (`files/alice/src/lib/supabase.js`) como Alicia por WhatsApp (`alicia-brain/src/supabase-tasks.js`).

Estado actual (parcial, ya en `main`):
- **ERP frontend**: el picker del **detalle de tarea** ya es multi-select (`HyggeOS.jsx:895`) y muestra avatares apilados + "N asignados" (`:888`). Pero **la creación** (QuickAdd/SmartCapture `:15415`), **subtareas** (`:15727`), **duplicados** (`:15642`) y las **otras vistas** (list/board/gantt/calendar/table) siguen en single-assignee — no hay `AvatarStack` reusable.
- **Alicia** (`supabase-tasks.js:21-31`): **ya soporta multi** (`assignee_ids[]` → `assignees` + `assignee=assignees[0]`).
- **Supabase**: `supabase.js` lee/escribe `assignees` (`:158-191`) pero **la columna `assignees` no existe en la tabla `tasks`** (la migración nunca se creó/corrió). Sin ella no persiste.
- **erp-backend** (`erp-backend/`, SQLite propia): single `assignee_id`; se llama en `localhost:3002`. Liveness en el camino real **sin confirmar** — probablemente legacy.

Modelo de compatibilidad (invariante en todo el sistema): **`assignee` = `assignees[0]`** siempre. Las vistas viejas, el sync y cualquier consumidor single siguen andando leyendo `assignee`.

## Objetivo

Multi-asignación funcionando **end-to-end**: elegir 1+ personas al crear y en detalle, verlas en todas las vistas, y que **persista** en Supabase. Alicia por WhatsApp puede asignar a varias. `erp-backend` solo si está vivo.

## Alcance y componentes

### 1. Persistencia — migración Supabase (linchpin) · `files/alice/supabase/add-assignees.sql`
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE tasks SET assignees = to_jsonb(ARRAY[assignee]) WHERE (assignees = '[]'::jsonb OR assignees IS NULL) AND assignee IS NOT NULL;
```
Additivo + backfill idempotente. **La corre Sebastián en el SQL Editor de Supabase** (no hay acceso DDL desde la sesión: el secret vive en Railway y PostgREST no hace DDL). El resto del sistema ya escribe `assignees`, así que apenas exista la columna, persiste.

### 2. ERP frontend — `files/alice/src/HyggeOS.jsx` (el grueso)
- **`AvatarStack` reusable**: componente que recibe `assigneeIds` y renderiza avatares solapados (máx 3, luego "+N"). Reemplaza el render single de asignado en list/board/gantt/calendar/table/subtareas. El detalle ya lo hace inline (`:888`) — se refactoriza a usar el mismo componente.
- **Creación multi-select** (QuickAdd + `SmartCapture` `:2085`): UI de chips con avatar para togglear personas; default `[currentUser]`. Escribe `assignees[]` + `assignee=assignees[0]`.
- **Herencia**: subtareas (`:15727`) y duplicados (`:15642`) copian `assignees` del padre/origen.
- **Lectura**: verificar que filtros por asignado (`filters.assignees`), badge "Mis tareas" (`:1109/1319`), agrupación por asignado, métricas de equipo y borrar-usuario consideren **todos** los `assignees` (varios ya lo hacen; completar los que falten).
- **Compat**: toda escritura setea `assignee = assignees[0] || null`.

### 3. Alicia — `alicia-brain/src/supabase-tasks.js` + capa de tools/parse
- El core ya soporta `assignee_ids[]`. **Verificar** que el prompt/parse de WhatsApp y el tool de crear/actualizar tarea puedan **producir varios ids** (que "asigná esto a Jose y Vanessa" derive en `assignee_ids: ["jt","vd"]`). Ajustar la definición del tool si hoy solo acepta uno.

### 4. erp-backend — condicional
- Confirmar primero si algo en el camino real de tareas usa `erp-backend` (SQLite, `assignee_id`). **Si es legacy → no se toca** (se documenta). Si está vivo → agregar `assignees` (columna + rutas), mismo patrón `assignee = assignees[0]`.

## No-objetivos
- No cambiar el modelo de permisos ni notificaciones más allá de que consideren a todos los asignados.
- No migrar `erp-backend` si no está en uso.

## Criterios de éxito
1. Correr `add-assignees.sql` en Supabase deja la columna `assignees` con backfill correcto (`assignee` → `[assignee]`).
2. En el ERP: al **crear** una tarea puedo elegir varias personas; se ven apiladas en todas las vistas; al recargar **persisten**.
3. `assignee` siempre = `assignees[0]` (compat verificada: vistas/consumidores single no se rompen).
4. Alicia puede asignar a varias personas desde WhatsApp.
5. erp-backend: soportado si está vivo, o documentado como legacy si no.
6. Build de Vite OK; sin regresión en tareas single-assignee existentes.
