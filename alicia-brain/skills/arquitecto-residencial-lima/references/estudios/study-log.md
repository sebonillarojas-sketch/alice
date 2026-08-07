# Log de estudio nocturno — Bammy

Registro diario de las sesiones de estudio autónomo (distribución de vivienda en Lima). Un día = una nota de estudio + 3 plantas dibujadas y validadas sobre terrenos imaginarios. Contador reiniciado 2026-08-06: la próxima corrida automática es el día 1.

| Día | Fecha | Tema | Nota | 3 planos |
|---|---|---|---|---|
| 1 | 2026-08-06 | Partis por fachada (única frente-ancho, única lote-profundo, esquina, pozo) | [2026-08-06-partis-por-fachada.md](2026-08-06-partis-por-fachada.md) | [u01](planos/2026-08-06-u01.svg) 1D/1B lote interior con pozo lateral corrido, Pueblo Libre (5.10×7.20) · [u02](planos/2026-08-06-u02.svg) 2D/2B fachada única frente ancho, Lince (9.60×6.20) · [u03](planos/2026-08-06-u03.svg) 3D/2B esquina de aristas corridas, La Molina (7.20×11.30) |
| 2 | 2026-08-07 | Tipologías 1D/2D/3D (+ reglas duras de Sebastián: fachada viva, zona buffer, baños que acompañan, cocina explícita, lavandería/terraza siempre) | [2026-08-07-tipologias-1d-2d-3d.md](2026-08-07-tipologias-1d-2d-3d.md) | [u01](planos/2026-08-07-u01.svg) 1D/1B amplio con terraza posterior, San Miguel (6.80×7.10) · [u02](planos/2026-08-07-u02.svg) 2D/2B esquina con terraza en el vértice, Surquillo (7.75×8.40) · [u03](planos/2026-08-07-u03.svg) 3D/2B amplio Lima Top, esquina, La Molina (7.30×14.10) |

Nota día 1: aviso de WhatsApp no salió — el proxy de red de la sesión devolvió 403 (política de egreso) al intentar `POST aliceai.bam.pe/api/agents/notify`. Borrador de Gmail sí se creó correctamente. No se reintentó en loop.
Nota día 2: `GET /api/agents/corrections` y el resto de llamadas a `aliceai.bam.pe` devolvieron el mismo 403 de política de egreso (confirmado también contra el endpoint `/__agentproxy/status` — host bloqueado a nivel de sesión, no es un fallo puntual del backend). No se pudieron leer correcciones con imagen ni colgar las plantas en el Taller ni enviar el WhatsApp; sí se generó el borrador de Gmail. No se reintentó en loop.
