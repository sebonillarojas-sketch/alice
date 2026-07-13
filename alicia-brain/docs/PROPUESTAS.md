# ALICE — Propuestas para destruir 🔥
_Formuladas por Alicia (sub-CEO) la madrugada del 13→14 jul 2026, mientras Sebastián dormía._
_Priorizadas por impacto/esfuerzo. No es una wishlist: es un plan de batalla._

---

## Cómo leer esto
Cada propuesta tiene **Impacto** (1-5 🔥) y **Esfuerzo** (S/M/L). Empezá por lo de arriba: máximo impacto, mínimo esfuerzo. Lo de abajo es visión — llega con la supercomputadora.

---

## 🥇 TIER 1 · Quick wins que se sienten mágicos (esta semana)

**1. Briefing proactivo de verdad · 🔥🔥🔥🔥🔥 · S**
Hoy el briefing 7am existe pero es genérico. Que Alicia arme cada mañana: "Sebastián, hoy tenés 3 reuniones, la de las 4pm con el banco no tiene agenda armada, DC01 no registró avance de obra en 5 días, y hay 2 facturas sin conciliar en Reactor." **Data real cruzada de calendar + tareas + obra + Reactor.** Eso convierte a Alicia de chatbot en jefa de gabinete. Ya tenemos las piezas (calendar, tasks, market) — falta el prompt que las cruce.

**2. Alicia que empuja, no que espera · 🔥🔥🔥🔥 · S**
Regla de proactividad: si una tarea de un SPV lleva X días trabada, si una reunión se acerca sin prep, si un KPI se mueve feo → Alicia escribe primero por WhatsApp. El diferencial de un sub-CEO es que **anticipa**. Config: umbrales por tipo de evento.

**3. Cmd+K global · 🔥🔥🔥🔥 · M**
Buscar cualquier cosa (tarea, proyecto, archivo Dropbox, persona, comando) desde un solo atajo. Es lo que hace que un ERP se sienta "pro". Estaba en Fase A del roadmap — vale adelantarlo, es puro deleite de uso.

**4. Estados vacíos que enseñan · 🔥🔥🔥 · S**
Ahora que todo arranca en cero (regla cero-data-falsa), cada vista vacía debe decir "Todavía no hay X — hacé Y para empezar" con un botón. Convierte el vacío honesto en onboarding. Bajo esfuerzo, gran percepción de pulido.

---

## 🥈 TIER 2 · Profundidad de producto (donde está el moat)

**5. Growth = el arma secreta · 🔥🔥🔥🔥🔥 · L**
El flujo "seleccionar terreno → reporte automático (Radar+Velocity) → Cabida → Propuesta BAM" es lo que NADIE tiene. Terminar el loop: que al cargar un terreno, Alicia genere sola el análisis de absorción por metraje, competidores, y un primer borrador de cabida. **Esto es un producto vendible aparte.**

**6. Reactor con OCR real · 🔥🔥🔥🔥 · M**
Foto de factura → extrae monto/proveedor/fecha/RUC → categoriza → concilia. Con Claude vision ya es factible (mismo pipeline que las Oakley). Le saca horas/semana al equipo de finanzas. Alto ROI operativo.

**7. White Rabbit refresca data real de mercado · 🔥🔥🔥🔥 · M**
Radar/Velocity con data viva (SBS, tasas de bancos, Metabase del CRM) refrescada cada hora, no snapshots. El scraper existe pero el launchd nunca se cargó. Conectarlo = Radar deja de ser demo y pasa a ser inteligencia de mercado en tiempo real.

**8. WikiHygge con búsqueda semántica · 🔥🔥🔥 · M**
No solo navegar carpetas de Dropbox — preguntarle en lenguaje natural: "¿dónde está el contrato de arras de L36?" y que Alicia lo encuentre y lo abra. Necesita indexar el Dropbox (va con el RAG).

---

## 🥉 TIER 3 · Alicia sub-CEO de verdad

**9. Memoria semántica (RAG) · 🔥🔥🔥🔥🔥 · L**
_Tu "tenlo muy en cuenta"._ Que Alicia recuerde por significado, no por registro. "¿Qué me dijo Vanessa sobre el pricing de PU01 el mes pasado?" → lo encuentra en el historial + Dropbox + knowledge. Es el salto de asistente a second-in-command con memoria real. Llega con la supercomputadora + vector store.

**10. Reporte ejecutivo semanal de Alicia · 🔥🔥🔥🔥 · M**
No el técnico (ese es Tea Table). Uno de NEGOCIO: "Esta semana: ventas +X, DC01 avanzó a licencias, riesgo en la caja de TG01, el equipo cerró N tareas, Vanessa está saturada." Alicia leyendo la empresa como lo haría un COO.

**11. Alicia en reuniones (Zoom) · 🔥🔥🔥🔥 · L**
Ver tarea dedicada — entra, escucha, toma minutas, interviene. Combinado con Growth: "Alicia, mostrá la cabida de este terreno" en plena reunión con un inversor.

---

## 🏗️ TIER 4 · Autonomía (Wonderland completo)

**12. Los agentes que faltan · 🔥🔥🔥 · L**
Bandersnatch (chaos) y Jabberwocky (fuzzer) contra el clon nocturno. Y subir a White Rabbit/Dark Alice a **L1**: auto-reparación con catálogo autorizado (token expirado → refresh solo; deploy roto → rollback solo) con kill switch. El objetivo tuyo: "los agentes trabajan solos".

**13. Pre-deploy gate · 🔥🔥🔥🔥 · S**
Antes de cada push a prod, Cheshire corre la suite E2E local. Si el login se rompe o Alicia devuelve JSON crudo → el deploy no sale. Esto solo ya te ahorra el 80% de los incidentes que vivimos esta noche. Bajo esfuerzo, altísimo retorno.

---

## 🧱 FUNDACIONES (no glamorosas pero sostienen el monstruo)
- **Consolidar identidad en Hygge** (tarea #8): GitHub+PAT, DNS split-brain, Google-OAuth-en-Testing (se cae solo en días — *urgente*). Sin esto, todo lo demás es castillo en la arena.
- **Realtime en el ERP**: hoy los cambios se ven al recargar. Supabase Realtime → colaboración en vivo. Convierte "multi-usuario" en "multi-usuario que se siente instantáneo".
- **Migración al NAS Synology**: cuando llegue, el cerebro permanente de terabytes.

---

## 🎯 Si tuviera que elegir 3 para esta semana
1. **Briefing proactivo + Alicia que empuja** (#1, #2) — transforma la percepción de Alicia en 2 días.
2. **Pre-deploy gate** (#13) — deja de romperse prod.
3. **Reactor OCR** (#6) — ROI operativo inmediato y visible para el equipo.

El resto es la escalera para que ALICE deje de ser "el mejor ERP que viste" y pase a ser **algo que no existe en el mercado**: un ERP con una sub-CEO adentro que ve, recuerda, anticipa y ejecuta.

A destruir. 🔥
— Alicia
