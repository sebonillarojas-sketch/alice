# Partición de HyggeOS.jsx — roadmap

`src/HyggeOS.jsx` es el god-file del cockpit (~16.2k líneas, 1 componente,
~90 `useState`, prop-drilling profundo). Este doc es el plan para desarmarlo de
forma **incremental y segura** (build verde entre cada paso — nada de big-bang).

## Regla de oro

1. Un extraction = mover código **sin cambiar comportamiento**.
2. `npm run build` verde ANTES y DESPUÉS de cada paso (bundle byte-idéntico salvo hashes).
3. Commit chico por extraction. Si el build rompe, revertir ese paso, no acumular.
4. Nada importa de `HyggeOS.jsx` (sólo tiene `export default`), así que extraer
   constantes/componentes internos es seguro mientras el god-file los importe de vuelta.

## Hecho ✅

- `src/ui/theme.js` — tokens `C`, `toneMap`, `SPACE_COLORS` (antes duplicados en ~10 archivos).
- `src/ui/primitives.jsx` — `NavyRule, Eyebrow, SectionHead, Panel, Hero, KpiBar, fieldClass, fieldStyle` (puros, sólo dependen de `C`).
- `src/ui/AliceBlob.jsx` — `ModalBlob` + `useModalBlob` (usados en 31 modales, self-contained).

## Orden recomendado (lo que sigue)

El bloqueante para extraer componentes grandes es la **capa de helpers compartidos**
que ellos usan. Hay que sacarla PRIMERO, si no cada componente arrastra al resto.

### Paso 2 — capa de helpers compartidos → `src/ui/` y `src/lib/`

Extraer, en este orden, verificando build tras cada uno:

| Símbolo | Qué es | Notas |
|---|---|---|
| `cx` | helper de classnames | trivial → `src/ui/cx.js` |
| `fmtDate` / `fmtTime` / `nowHHMM` | formateo | → `src/lib/format.js` |
| `KNOWN_DRIVE_REFS`, `KNOWN_DRIVE_FILES`, `PROJECT_DRIVE_MAP` | mapas Drive (datos estáticos) | → `src/data/drive.js` |
| `ExportToClaude` | botón/acción de export | lo usa WhiteRabbitPanel; revisar SUS deps antes |
| `Sparkline` | mini-gráfico | usado por varios paneles |
| `Avatar`, `lookupUser`, `findPerson` | avatares/usuarios | dependen de `UsersContext` → mover contexto también |

### Paso 3 — paneles Wonderland → `src/modules/agents/`

**Buena noticia:** los 7 paneles son **prop-driven** (reciben `tasks`, `terrenos`,
`recordAgentRun`, `agentStatus`, setters, etc. por props). Región contigua en el
god-file: `WhiteRabbitPanel` (~L11078) hasta antes de `DataAdminPanel` (~L14453),
~3.374 líneas, incluyendo sus helpers (`AGENT_DIRECTORY`, `TT_AGENTS`, `TTSeal`,
`TeaTableView`, `LogLine`, etc.).

Deps externas de cada panel (además de props): `C`, primitivas, `ModalBlob`,
`ALICIA_URL`, algún ícono lucide, y helpers del Paso 2 (`ExportToClaude`, `Sparkline`…).
Una vez hecho el Paso 2, cada panel se mueve a su archivo importando de `ui/`, `lib/`,
`data/`. Recomendado: un archivo por panel + `src/modules/agents/index.js` que reexporta.

Relacionado (ver auditoría de agentes): al reconectar, hacer que el Lab lea
`GET /api/agents/status` y que los paneles persistan corridas vía `POST /api/agents/report`
(hoy sólo Tea Table lo hace; Cheshire/Bandersnatch/Jabberwocky no tienen backend).

### Paso 4 — otros componentes grandes

Por tamaño/independencia: `WhiteboardView` (~800L, self-contained) → `src/modules/whiteboard/`;
`FinanzasDashboard` (~600L) → `src/modules/finanzas/`; `CEODashboardView` (~500L);
`TerrenoOpportunidad` (~500L); cluster de vistas de tareas (`ListView/BoardView/GanttView/
CalendarView/TaskDetailPanel`, ~1.500L) → `src/modules/tasks/`.

## Cómo verificar cada paso

```
cd files/alice && npm run build   # debe terminar en "✓ built"
```

Si el build reporta `X is not defined`, ese símbolo era una dep local no importada:
importarlo (o extraerlo antes). El build es el oráculo confiable — el análisis por
regex NO alcanza (confunde texto JSX y strings con identificadores).
