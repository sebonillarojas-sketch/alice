# Multitareas — multi-asignación · Implementation Plan

> **For agentic workers:** Ejecutar tarea por tarea. El frontend (`HyggeOS.jsx`) no tiene tests unitarios → se verifica con `npm run build` + chequeo descrito. La lógica pura lleva asserts.

**Goal:** Multi-asignación end-to-end: elegir 1+ personas al crear y en cada vista, persistir en Supabase, y que Alicia asigne a varias por WhatsApp.

**Architecture:** Fuente de verdad = tabla `tasks` de Supabase con nueva columna `assignees jsonb`. Invariante en todo el sistema: `assignee = assignees[0]`. El ERP web (`files/alice`) y Alicia (`alicia-brain`) escriben ambos `assignees`.

**Tech Stack:** React 18 + Vite (frontend), Node ESM + Supabase PostgREST (Alicia), Postgres (Supabase).

## Global Constraints

- Invariante: **`assignee = assignees[0] || null`** en TODA escritura. Nunca dejar `assignees` sin su `assignee` espejo.
- `assignees` siempre es array de ids de usuario (`["sb","jt",...]`), sin duplicados.
- Frontend: verificar con `cd files/alice && npm run build` (debe compilar). node_modules ya instalado.
- Compat: las vistas/consumidores que leen solo `assignee` deben seguir funcionando.
- Trabajar en worktree `feat/multitareas`. No mergear a main hasta aprobación.

---

### Task 1: Migración Supabase — columna `assignees`

**Files:** Create `files/alice/supabase/add-assignees.sql`

- [ ] **Step 1: Escribir el SQL (idempotente, additivo + backfill)**

```sql
-- Multi-asignación: agrega assignees[] a tasks, backfill desde el single assignee.
-- Correr en el SQL Editor de Supabase. Idempotente.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE tasks
SET assignees = to_jsonb(ARRAY[assignee])
WHERE (assignees IS NULL OR assignees = '[]'::jsonb)
  AND assignee IS NOT NULL;
```

- [ ] **Step 2: Commit** — `git add files/alice/supabase/add-assignees.sql && git commit -m "feat(multitareas): migración Supabase assignees[] + backfill"`

> **Nota de ejecución:** esta migración la corre Sebastián en el SQL Editor de Supabase (no hay acceso DDL desde la sesión). Sin ella el multi-assign no persiste, pero el resto del plan (frontend/Alicia) se puede implementar y buildear igual.

---

### Task 2: `AvatarStack` — componente reusable + swap en las 9 vistas

**Files:** Modify `files/alice/src/HyggeOS.jsx`

**Interfaces:**
- Produces: `function AvatarStack({ ids = [], size = 18, max = 3 })` — renderiza hasta `max` avatares solapados; si `ids.length > max`, un chip "+N". Si `ids` vacío → nada (el caller decide el fallback "sin asignar").

- [ ] **Step 1: Crear el componente `AvatarStack`** cerca del componente `Avatar` existente:

```jsx
function AvatarStack({ ids = [], size = 18, max = 3 }) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!list.length) return null;
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <span className="inline-flex items-center" style={{ verticalAlign: "middle" }}>
      {shown.map((id, i) => (
        <span key={id} style={{ marginLeft: i ? -size * 0.3 : 0, zIndex: shown.length - i, position: "relative" }}>
          <Avatar personId={id} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span style={{ marginLeft: -size * 0.3, width: size, height: size, borderRadius: 999, background: C.surface, color: C.muted, fontSize: size * 0.42, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 0 }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Helper de ids** — agregar cerca del top (o reutilizar el patrón existente `:815`):

```jsx
const idsOf = (t) => (Array.isArray(t.assignees) && t.assignees.length) ? t.assignees : (t.assignee ? [t.assignee] : []);
```

- [ ] **Step 3: Reemplazar los 9 sitios de render single por `AvatarStack`.** En cada uno cambiar `{t.assignee && <Avatar personId={t.assignee} size={N} />}` por `{idsOf(t).length > 0 && <AvatarStack ids={idsOf(t)} size={N} />}` (respetando el `size` de cada sitio). Sitios (líneas aprox, verificar en el archivo actual):
  - `:2251` (size 20), `:2336` (18), `:2445` (16), `:2634` (18), `:2671` (18), `:2700` (22, mantener el fallback "—"), `:6334` (18), `:10089` (18), `:10137` (18).
  El detalle de tarea (`:888`) ya hace su propio stack inline — opcionalmente refactorizar a `AvatarStack ids={assigneeIds}` para unificar (no obligatorio).

- [ ] **Step 4: Build** — `cd files/alice && npm run build` → debe compilar.

- [ ] **Step 5: Commit** — `feat(multitareas): AvatarStack + avatares apilados en todas las vistas`

---

### Task 3: Creación multi-select (SmartCapture) + herencia en subtareas/duplicados

**Files:** Modify `files/alice/src/HyggeOS.jsx`

- [ ] **Step 1: UI de asignados en el preview de `SmartCapture`** (componente en `:2085`, preview en `:2130+`). En el bloque `preview` agregar un editor de chips: lista de usuarios; cada uno togglea su id en `preview.assignees` (inicializar desde `preview.assignee` o `[currentUser]`). Al togglear: `setPreview(p => { const cur = idsOf(p); const next = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id]; return { ...p, assignees: next, assignee: next[0] || null }; })`. Requiere pasar la lista de usuarios y `currentUser` como props a `SmartCapture` (agregarlas donde se instancia).

- [ ] **Step 2: `confirm()` pasa assignees** — asegurar que `onCreate(preview)` propague `assignees`. En el handler `addTask`/`onCreate` (donde hoy setea `assignee: parsed.assignee || currentUser?.id || "sb"`, `:15415`), setear también:
```jsx
const assignees = (Array.isArray(preview.assignees) && preview.assignees.length) ? preview.assignees : [preview.assignee || currentUser?.id || "sb"];
// ...task: { ...campos, assignees, assignee: assignees[0] }
```

- [ ] **Step 3: Herencia** — en creación de **subtarea** (`:15727`, hoy `assignee: parent.assignee`) y **duplicado** (`:15642`, `assignee: orig.assignee`) agregar `assignees: idsOf(parent)` / `idsOf(orig)` y `assignee: idsOf(...)[0] || null`.

- [ ] **Step 4: Build** — `cd files/alice && npm run build`.

- [ ] **Step 5: Commit** — `feat(multitareas): multi-select al crear + herencia en subtareas/duplicados`

---

### Task 4: Lectura — filtros, "Mis tareas", agrupación, borrar-usuario

**Files:** Modify `files/alice/src/HyggeOS.jsx`

- [ ] **Step 1: Auditar y completar los reads single.** Para cada uno, cambiar `t.assignee === X` por `idsOf(t).includes(X)`:
  - badge "Mis tareas" (`:1109`, `:7336`, `:16104`) → `idsOf(t).includes(currentUser.id)`.
  - filtro por asignado (donde se aplica `filters.assignees`) → una tarea matchea si **alguno** de sus `idsOf(t)` está en el filtro.
  - agrupación por asignado / métricas de equipo (`:11844`) → contar la tarea para **cada** asignado (o decidir: contar al principal; documentar la decisión — recomendado: contar a todos para "carga real").
  - borrar usuario (`:15382`, `:16297`): quitar el id de `assignees` de cada tarea afectada y recomputar `assignee = assignees[0] || null` (en vez de solo reasignar el single).

- [ ] **Step 2: Build** — `cd files/alice && npm run build`.

- [ ] **Step 3: Commit** — `feat(multitareas): lecturas (filtros/mis-tareas/grupos/borrar-usuario) consideran todos los asignados`

---

### Task 5: Alicia — asignar a varias personas por WhatsApp

**Files:** Modify `alicia-brain/src/tools.js` (definición del tool de tareas) y/o el prompt; `supabase-tasks.js` ya soporta `assignee_ids[]`.

- [ ] **Step 1: Leer el tool actual** de crear/actualizar tarea en `alicia-brain/src/tools.js` — ver si el input acepta `assignee_ids` (array) o solo `assignee_id` (single).

- [ ] **Step 2: Aceptar múltiples** — en la definición del tool, agregar `assignee_ids` (array de ids) como parámetro opcional (mantener `assignee_id` para compat). El handler ya pasa a `createTask`/`toRow` de `supabase-tasks.js`, que resuelve `assignee_ids[] → assignees + assignee=assignees[0]` (`:21-31`). Asegurar que el handler reenvíe `assignee_ids` tal cual.

- [ ] **Step 3: Prompt** — si el system prompt de Alicia enumera cómo asignar, agregar una línea: "para varias personas, usá `assignee_ids: [ids]`". (Solo si el prompt guía el uso del tool.)

- [ ] **Step 4: Verificación** — test rápido de `toRow` con `assignee_ids`:
```bash
cd alicia-brain && node -e "import('./src/supabase-tasks.js').then(m => { /* si toRow no está exportado, verificar por inspección */ })"
```
Si `toRow`/`createTask` no exporta la transformación testeable, verificar por inspección que `assignee_ids: ['jt','vd']` produce `assignees: ['jt','vd'], assignee: 'jt'`. Documentar en el commit.

- [ ] **Step 5: Commit** — `feat(multitareas): Alicia acepta assignee_ids[] al crear/actualizar tareas`

---

### Task 6: erp-backend — condicional (confirmar liveness primero)

**Files:** (condicional) `erp-backend/src/db.js`, `erp-backend/src/routes/tasks.js`

- [ ] **Step 1: Confirmar si `erp-backend` está en el camino real de tareas.** Buscar quién llama a `localhost:3002`/`ERP_URL` en producción (no solo dev). Si SOLO lo usa `alicia-brain/src/erp-client.js` y Alicia realmente escribe por `supabase-tasks.js` (no por erp-client), entonces **erp-backend es legacy → documentar y NO tocar** (terminar la tarea acá con esa conclusión en el commit/nota).

- [ ] **Step 2 (solo si está vivo): agregar `assignees`** — columna `assignees TEXT DEFAULT '[]'` (JSON string) en `erp-backend/src/db.js`; en `routes/tasks.js` aceptar `assignees` en create/update, persistir el JSON, y setear `assignee_id = assignees[0]`. Mantener `assignee_id` para compat.

- [ ] **Step 3: Commit** — `feat(multitareas): erp-backend soporta assignees` **o** `docs(multitareas): erp-backend es legacy, fuera del camino de tareas`

---

### Task 7: Verificación integral

- [ ] **Step 1: Build final** — `cd files/alice && npm run build` (debe pasar).
- [ ] **Step 2: Sanity de compat** — grep de que no quedó ninguna escritura de `assignees` sin su `assignee` espejo: revisar cada `assignees:` nuevo tiene `assignee:` al lado.
- [ ] **Step 3: Checklist de humo (manual, documentar):** crear tarea con 2 personas → aparece apilada en list/board → recargar (tras correr el SQL) persiste → "Mis tareas" la cuenta para ambos → Alicia por WA asigna a 2.
- [ ] **Step 4: Commit** de cualquier ajuste final.

## Self-Review

- Migración → Task 1. ✅
- Creación multi (síntoma) → Task 3. ✅
- AvatarStack en vistas → Task 2. ✅
- Lecturas → Task 4. ✅
- Alicia → Task 5. ✅ (core ya hecho en supabase-tasks.js)
- erp-backend condicional → Task 6. ✅
- Invariante `assignee=assignees[0]`: reforzado en Tasks 3/4/5/6 + Task 7 Step 2. ✅
- Persistencia depende de correr el SQL (Task 1) — marcado como paso manual del usuario.

## Nota
La migración `add-assignees.sql` la corre Sebastián en Supabase. Todo lo demás se implementa y buildea sin depender de eso.
