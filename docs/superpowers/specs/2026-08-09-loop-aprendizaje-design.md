# Loop de aprendizaje de la constelación (Sub-proyecto A) · Diseño

_2026-08-09 · repo `alice` / `alicia-brain` (+ Bammy, ERP)_

## Contexto

Alicia y los agentes Wonderland ya tienen un **sustrato de memoria** pero no un **loop que cierre**: nada convierte sistemáticamente las correcciones/hallazgos en mejor comportamiento la próxima vez. Este sub-proyecto agrega ese loop, gobernado por un **gate duro** (la pieza central).

Sustrato existente a reusar:
- **Cerebro de Alicia:** `memories`, `knowledge`, `skills`, `user_personas` (diales), `user_insights` → exportado a Dropbox por `brainsync.js`.
- **Wonderland:** `agent_runs`, `agent_findings`.
- **Bammy:** `bammy_studies` + `bammy_corrections` = **este loop ya validado** para diseño; se generaliza el patrón.
- **Tea Table:** no es agente, es la **instancia de síntesis del consejo** (weekly report).

## Objetivo

Un store compartido de **lecciones** que fluyen `proposed → validated → applied`, alimentado por 4 señales y promovido solo por un gate duro en capas. Alcance: **todos** los agentes (Alicia + Wonderland), sin piloto.

## Componentes

### 1. Store — tabla `lessons` (nueva, en `alicia-brain/src/db.js`)
Campos: `id`, `scope` (`global` · `agent:<x>` · `user:<id>` · `space:<id>`), `source` (`correction`|`outcome`|`reflection`|`teatable`), `trigger` (qué la disparó), `lesson` (la regla/insight en texto), `evidence_count` (int), `risk_level` (`L0`|`L1`|`L2`|`L3`), `status` (`proposed`|`validated`|`applied`|`rejected`|`retired`), `contradicts_check` (json del resultado del chequeo de reglas duras), `validated_by` (humano/agente/auto), `applied_at`, `created_at`, `updated_at`.

### 2. Captura — las 4 señales → lección `proposed`
- **Correcciones humanas:** correcciones del Taller (`bammy_corrections`, ya existe), edits/ratings a borradores de Alicia por WhatsApp, findings de Wondies marcados como falsos → nueva lección o `evidence_count++` si ya existe una equivalente.
- **Señales de resultado (implícitas):** ¿el fix de un agente resolvió el problema o reincidió? ¿el usuario actuó sobre la sugerencia? ¿la tarea se completó? → sube evidencia o propone.
- **Auto-reflexión:** cada agente, en una corrida periódica, revisa sus `agent_runs`/mensajes recientes y propone lecciones ("esto salió mal, la próxima X").
- **Tea Table (síntesis cruzada):** el weekly report sintetiza hallazgos de TODOS los agentes y destila lecciones `scope: global`.

### 3. El gate duro (corazón) — 4 capas apiladas
Una lección pasa a `applied` solo si cruza **todas las capas que le apliquen**:
1. **(piso, siempre) No contradice reglas duras** — se chequea contra invariantes no negociables: RNE (Bammy), límites de autoridad L0-L3 (Wonderland), políticas de Hygge, seguridad. Si contradice → `rejected` automático, aunque tenga evidencia. El resultado se guarda en `contradicts_check`.
2. **Evidencia ≥N** (default N=3 casos independientes) — evita aprender de ruido o de un caso aislado.
3. **Aprobación por niveles (L0-L3):** L0 (tono/wording/cosmético) auto-promueve; L1-L2 (comportamiento, acciones, reglas de diseño) esperan aprobación humana en la superficie del agente (ver §5); L3 (destructivo/sensible) nunca auto.
4. **No-regresión** donde es factible: Bammy re-corre la lección contra estudios pasados (¿mejora sin romper otros?); Cheshire corre su suite E2E. Solo entra si no degrada.

### 4. Aplicación — cómo la lección cambia el comportamiento
La lección `validated` se escribe al **cerebro existente** (no un mecanismo nuevo):
- **Alicia:** `user_personas` (diales/instrucciones), `knowledge`, `skills`.
- **Wonderland:** catálogo de reparación (White Rabbit), checks (Cheshire), reglas de Knave, etc.
- **Bammy:** sus reglas de diseño (vía el patrón `bammy_studies/corrections`).
Cada agente **lee sus lecciones `applied` relevantes (por scope) al arrancar** y las inyecta a su contexto. `brainsync.js` las espeja a Dropbox → auditable y legible por humanos.

### 5. Superficies humanas (aprobación del gate) — **una por agente, NO un panel genérico**
- 🏗️ **Bammy → su Taller** (ya existe). Aprendizaje particular de diseño; no se mezcla con el resto.
- 🐰😺🎩🖤⚔️⚡🃏 **Wondies → Tea Table** (la instancia de síntesis del consejo): ahí se revisan y aprueban sus lecciones L1+.
- 💬 **Alicia → directo con Sebastián por WhatsApp** (1:1, conversacional): sus correcciones y aprobaciones L1+ pasan por el chat, no por un panel.

### 6. Reuso explícito
Bammy ya corre este loop (validar corrección → mejorar próximo estudio); se **generaliza** su patrón al resto. Tea Table ya es la síntesis; se le cuelga la promoción/pendientes de lecciones de los Wondies.

## No-objetivos
- No un panel "Lecciones" unificado en el ERP (rechazado: cada agente por su superficie).
- No auto-aplicar nada L1+ sin pasar por su superficie humana.
- No reescribir el cerebro; se reusa el existente.

## Criterios de éxito
1. Existe `lessons` y las 4 señales escriben lecciones `proposed` con su `scope`/`source`/`risk_level`.
2. El gate promueve `proposed → applied` solo cruzando las capas; una lección que contradice una regla dura queda `rejected` automáticamente (con evidencia y todo).
3. Lo aplicado se escribe al cerebro y cada agente lo lee al arrancar (cambia comportamiento demostrable en un caso).
4. Aprobación por superficie correcta: Bammy en Taller, Wondies en Tea Table, Alicia por WhatsApp.
5. `brainsync.js` espeja lecciones aplicadas a Dropbox.
6. Cero regresión en el cerebro/loops existentes (Bammy sigue andando).

## Abierto / a definir en el plan
- Umbral N por defecto y por `risk_level`.
- Frecuencia de la corrida de auto-reflexión por agente.
- Formato exacto de "regla dura" contra el que se chequea (lista versionada de invariantes).
