# Fase 3 · Task 3 — Inyección de lecciones al system prompt de Alicia

**Status:** DONE

## Cambios

### 1. `alicia-brain/src/lessons.js` — nueva función pura `formatLessonsBlock`
```js
export function formatLessonsBlock(lessons = []) {
  if (!Array.isArray(lessons) || !lessons.length) return "";
  return `\n## 🧠 Lecciones aprendidas (aplicá esto — se validaron y aprobaron)\n${lessons.map(l => `- ${l}`).join("\n")}`;
}
```
Todos los exports existentes se mantienen intactos.

### 2. `alicia-brain/test/lessons-inject.test.mjs` (nuevo, TDD)
2 tests — verde:
- `formatLessonsBlock arma un bloque con las lecciones`
- `formatLessonsBlock vacío → string vacío`

### 3. `alicia-brain/src/server.js` — imports estáticos (top of file)

Antes:
```js
import { query, parseArr } from "./db.js";
import { ALICIA_TOOLS, executeTool } from "./tools.js";
```

Después:
```js
import { query, parseArr, getDB } from "./db.js";
import { lessonsForScope, formatLessonsBlock } from "./lessons.js";
import { ALICIA_TOOLS, executeTool } from "./tools.js";
```

### 4. `alicia-brain/src/server.js` — `buildSystemPrompt` (síncrona, sin cambios de firma)

Se agregó, justo antes del `return` final de la función (no se tocó nada async — la función sigue siendo síncrona):

```js
  let lessonsBlock = "";
  try {
    const db = getDB();
    const ls = [...lessonsForScope(db, `user:${userId}`), ...lessonsForScope(db, "agent:alicia")];
    lessonsBlock = formatLessonsBlock([...new Set(ls)]);
  } catch (e) { console.error("inyección de lecciones falló:", e.message); }

  return `Eres Alicia, la asistente ejecutiva con IA de Hygge Holding, empresa inmobiliaria premium en Lima, Perú.
```

Y se agregó `lessonsBlock` al final del template string que retorna la función (última línea del prompt, tras "Reglas inamovibles"):

Antes:
```js
- La fecha y hora actuales de Lima llegan al final del contexto — usalas como "ahora"`;
}
```

Después:
```js
- La fecha y hora actuales de Lima llegan al final del contexto — usalas como "ahora"${lessonsBlock}`;
}
```

## Verificación

- `node --test test/lessons-inject.test.mjs` → 2/2 verde.
- `node --test test/*.test.mjs` (suite completa) → 59/59 verde, sin regresiones.
- `node --check src/server.js` → OK.
- `node --check src/lessons.js` → OK.
- No se corrió el server (según instrucción).

## Notas

- Los endpoints de Task 2 (`/api/agents/lessons/:id/approve|reject`) usan `const { getDB } = await import("./db.js")` dentro de sus propios handlers — eso hace *shadowing* local del `getDB` importado estáticamente arriba, es válido en JS (scope de función) y no genera error de sintaxis ni de runtime; confirmado por `node --check` y por la suite verde.
- `lessonsForScope(db, 'user:'+userId)` ya trae las `global` (Fase 1 filtra `scope = ? OR scope = 'global'`), así que con `user:${userId}` + `agent:alicia` alcanza; el `Set` deduplica si una misma lección calzara en ambos scopes.
- Inyección best-effort: cualquier fallo (DB no inicializada, etc.) se traga con `try/catch` y loggea por `console.error`, nunca rompe el prompt — `lessonsBlock` queda `""`.

## Estado

- Status: DONE
- Commit SHA: (ver mensaje final)
- Test summary: 2/2 nuevos tests verdes; 59/59 suite completa verde.
- Concerns: ninguno. El endpoint POST approve/reject de Task 2 sigue usando `await import` dinámico por dentro de sus handlers (no tocado, fuera del alcance de Task 3) — coexiste sin conflicto con los imports estáticos nuevos.
