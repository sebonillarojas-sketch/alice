# Cómo genera Finch3D plantas y tipologías de vivienda

Investigación a partir de fuentes públicas: documentación técnica (`docs.finch3d.com`), página de producto, blog, prensa especializada AEC, y entrevistas a los fundadores. Fecha de la investigación: 2026-09-10.

**No se encontraron patentes públicas** a nombre de Finch, Finch3D, Finch AB, Jesper Wallgren, Pamela Nuñez Wallgren o Martin Kretz en Google Patents ni en USPTO. La pista de la tarea sobre una "patente que diga el método con precisión" no se pudo confirmar — `[documentado: no existe]`, búsquedas en `patents.google.com` y `image-ppubs.uspto.gov` no arrojaron resultados relacionados con floor plan generation bajo esos nombres.

**Corrección de un dato de partida**: no se encontró ningún fundador o figura pública de Finch3D llamado "Rasmus Fahlander". Según Crunchbase, Nordic9 y AEC Magazine, los fundadores son **Jesper Wallgren** (arquitecto, Chief Product Officer), **Pamela Nuñez Wallgren** y **Martin Kretz**, con sede en Malmö, Suecia `[documentado, https://aecmag.com/ai/finch3d-starts-to-sing/ ; https://nordic9.com/companies/finch-3d-company0390149229/]`. Tampoco se encontró evidencia pública de un origen académico en KTH o Chalmers, ni papers académicos publicados por los fundadores sobre grafos aplicados a plantas — `[no se puede determinar]`.

---

## 1. El mecanismo: ¿de dónde sale la geometría?

**Confirmado: es una combinación de grafo/optimización paramétrica para la geometría "dura" (masa, núcleo, corredor, límites de unidad) + recombinación desde biblioteca para el interior de cada unidad.** No es un modelo generativo entrenado que dibuje geometría desde cero, y no hay evidencia de wave function collapse ni shape grammar como tales.

- **Grafo automático, no editado por el usuario.** Jesper Wallgren, en entrevista con AEC Magazine: *"The graph is always working behind the design. The user is not building the graph, that is generated automatically. And the graph's job is basically to map out the architecture or the building to understand the relationship between different functions for different spaces and different objects to generate an optimal floor plan."* `[documentado, https://aecmag.com/ai/finch3d-starts-to-sing/]`

- **El usuario pone reglas, no geometría.** Mismo artículo: *"the user can assign rough rules to these plans, such as, 'Between these spaces, X should be generated', or, 'In this space, we need a minimum of X amount of square metres', or, 'This space needs at least X amount of daylight'."* Y: *"when we run our optimisation algorithms, Finch3D can take these graph rules into account. It's why we can generate detailed floor plans with very high precision."* `[documentado, misma URL]`

- **Dos motores declarados por el fundador, separados explícitamente.** En ArchDaily (2019), Wallgren distingue dos partes de la "inteligencia" de Finch:
  - *"Rule-based contains algorithms with inputs the user can change themselves. It's applicable to things like building height, apartment distribution, and wall thickness."*
  - *"The AI part focuses on understanding our users and generating different design suggestions. The more you use the software, the smarter Finch will get."* Y sobre el origen de esas sugerencias: *"By analyzing existing dwellings, we've been able to learn a lot and generate suggestions based on that."*
  - Y aclara el rol: *"the generated suggestions are not intended to be the final design but rather a great start for the architect to tweak and to add their own touch to."*
  `[documentado, https://www.archdaily.com/929300/can-a-machine-perform-the-work-of-an-architect-a-chat-with-jesper-wallgren-founder-at-finch-3d]`

- **La biblioteca de plantas es explícita y central en el producto actual.** Página de producto: *"Build a centralised Plan Library based on past projects and your institutional knowledge."* `[documentado, https://www.finch3d.com/product]` La documentación de Unit Plan Studio confirma que hay dos fuentes de plantas de unidad: *"Your Studio's Plan Library"* (con "accessibility settings, custom tags, regional data, and furniture") y *"Finch-Generated Plans"* descritas como *"Fast, regulation-aware layouts, but unfurnished."* `[documentado, https://docs.finch3d.com/courses/finch-101/finch-101-generating-unit-plans.md]`

- **Cuando no hay match en la biblioteca, el sistema "genera algo parecido a lo que el arquitecto habría diseñado", no algo nuevo desde cero.** Vía documentación indexada por Google: *"AI generates unique plans based on your adaptive plan library's design style and rules, meaning that if there isn't a plan that matches from your library, Finch will generate plans similar to what you would have designed."* `[documentado, contenido indexado de docs.finch3d.com, recuperado vía búsqueda — no se pudo abrir la página fuente directamente porque devolvió 404 al fetch directo; el enunciado aparece también parafraseado en la doc de Unit Plan Studio y en Enterprise Generate Unit Plan]`

- **Reseña técnica de terceros confirma "no es pixel-based / no es AI de imagen".** Illustrarch: *"Instead of generating floor plans from pixel-level image training (like many image-based AI tools), Finch uses a proprietary graph system that maps spatial relationships between rooms, corridors, structural elements, and building rules."* Y sobre el flujo de generación a partir de una masa: *"reads the geometry and begins populating stories with unit types and circulation paths. The algorithm considers unit mix targets, minimum and maximum area constraints, daylighting requirements, and code compliance rules simultaneously."* Y sobre el output: *"Each generation run produces multiple layout variants, each accompanied by a dashboard of key figures: gross floor area, net-to-gross ratio, unit count, CO2 estimate, and daylight simulation scores."* `[documentado, https://illustrarch.com/articles/75056-finch3d-review.html — nota: es una reseña de tercero, no documentación oficial de Finch; se marca como tal]`

- **Tres algoritmos declarados para generar la "planta baja" del edificio (footprint → núcleos → corredor → unidades)**, sin mención de grafo/ML en su descripción operativa — son procedimentales/paramétricos:
  1. *"Generate Around Existing Circulation"* — usa un núcleo ya definido por el usuario (retrofits): *"Finch will: Detect it [and] Generate a unit layout around your predefined core."*
  2. *"Generate Cores"* — para plantas largas/irregulares: *"Finch analyzes the floor plate and: Splits it into multiple vertical cores [and] Orients cores to optimize circulation [and] Wraps units around each core."*
  3. *"Generate Corridors and Core"* — desde cero, a partir de "Egress distances", "Core dimensions (depth and width)" y "Preferred core orientation".
  `[documentado, https://docs.finch3d.com/courses/finch-101/finch-101-generate-floor-plate-algorithms.md]`

**Conclusión sobre el mecanismo**: la pista del enunciado de la tarea se confirma parcialmente y se precisa. No es "recombinar plantas validadas" en sentido puro (hay generación paramétrica real para masa/núcleo/corredor, gobernada por reglas de grafo y optimización), pero **el interior de cada unidad de vivienda sí funciona predominantemente por recombinación/adaptación desde una biblioteca curada**, con un generador algorítmico de respaldo cuando no hay match, entrenado (según el fundador, ya en 2019) sobre plantas reales analizadas por el estudio. La "IA" de Finch nunca se describe como un modelo que dibuja píxeles o vectores libres — siempre opera dentro de la biblioteca o dentro del grafo de reglas.

## 2. El reparto del piso: núcleo, corredor, unidades

Documentado en detalle en la sección 1 (los tres algoritmos de "Generate Floor Plate"). Además:

- El algoritmo de corredor+núcleo+mix de unidades tiene una página propia ("Advanced: Corridor and unit mix algorithm"), pero **su contenido técnico vive solo en un video de YouTube incrustado**, no en texto — la página de documentación es apenas un título, una frase y un `{% embed %}` a `https://www.youtube.com/watch?v=5uuKiNdRoxo`. No se pudo extraer transcripción del video con las herramientas disponibles. `[documentado que la única explicación pública es en video, no en texto: https://docs.finch3d.com/courses/advanced/corridor-and-unit-mix-algorithm.md]` — el contenido técnico específico del algoritmo (cómo pesa cada variable, qué heurística de asignación usa) **no se puede determinar** de fuentes de texto públicas.
- Sí está documentado en texto, resumido por el índice de documentación: el algoritmo *"analyzes the floor plate and splits it into multiple vertical cores, orients cores to optimize circulation, wraps units around each core"*, con inputs de distancias de egreso (single exit ~18m, multi-exit ~30m), dimensiones de núcleo, y comportamiento de escaleras (esquinas vs. extremos, orientación de "attractor"). Feedback de cumplimiento en tiempo real: verde/gris/rojo. `[documentado, extraído del índice agregado de docs.finch3d.com — fuente primaria de texto no accesible directamente, solo vía índice]`
- Priorización por sliders, no por optimización ciega: *"Balance your design intent"* mediante ajustes a "Unit Mix," "Size Metric," "Grid Lines," "Daylight Access," y "Squareness and Adjacencies", con re-iteración en tiempo real: *"Finch will re-iterate each time you change these percentages."* `[documentado, mismo índice]`
- En el generador de unidad (Enterprise Generate Unit Plan): *"the plan generator matches apartment entrances to the corridor spaces"* y, para luz natural, *"the algorithm avoids putting rooms which require daylight towards the greyed out facade"* — el usuario marca qué fachadas dan a exterior/luz y el algoritmo restringe la asignación de cuartos en consecuencia. `[documentado, https://docs.finch3d.com/docs/projects-and-variants/unit-editor/enterprise-generate-unit-plan.md]`

## 3. El interior de cada unidad: ¿generado, plantilla, o adaptado?

**Es adaptación de plantilla, no generación libre**, con dos rutas:

1. **Biblioteca propia o de la organización** — plantas reales del estudio, con metadata (accesibilidad, tags, datos regionales, mobiliario). El sistema busca matches y les da un **score de coincidencia**: *"score ≥ 75%"* se recomienda. Reporta métricas de ajuste, notablemente **"Adaptivity: How much each room had to stretch or compress"** y **"Daylight: Whether daylight-required rooms meet facade requirements."** Es decir: toma una planta real y la deforma (estira/comprime cuartos) para encajar en la nueva huella. `[documentado, https://docs.finch3d.com/courses/finch-101/finch-101-generating-unit-plans.md]`
2. **"Finch-Generated Plans"** — descritas como *"Fast, regulation-aware layouts, but unfurnished"*, el respaldo algorítmico cuando la biblioteca no tiene match suficiente, según lo indexado: *"AI generates unique plans based on your adaptive plan library's design style and rules"* — o sea, incluso el "generador" está condicionado por el estilo/reglas de la biblioteca del usuario, no es independiente de ella.

**Detección automática de fachada y entrada**: *"Finch will automatically detect facade walls (for daylighting) and entry points (for circulation)"* `[documentado, índice agregado de docs.finch3d.com, sección Unit Plan Generation]`.

**Copiado/espejado inteligente entre unidades vinculadas**: *"Finch automatically mirrors layouts when orientation is reversed (e.g., corridor is on the opposite side) — and keeps them linked. Any edit made to one will update the others."* `[documentado, misma fuente]` — esto es consistencia editorial entre unidades tipo, no generación por unidad.

**Puertas y ventanas — qué significa "exact door placements"**: no es colocación por IA generativa de geometría; es edición paramétrica ejecutada por el agente Archie sobre elementos ya existentes en el modelo. Documentado literalmente: *"Edit doors in the current unit: Resize, reposition, flip hinge sides, reverse swing directions, center, or remove existing doors directly."* Para ventanas, Archie **delega** a un sub-agente especializado: *"Delegate edits for facade/story-level windows (resizing, repositioning, or retyping windows across one or more floors) to a specialized window-editing sub-agent."* Y para tareas de puertas a escala: *"Delegate large-scale door editing tasks (like standardizing widths across multiple floor plans) to a specialized door-editing sub-agent."* `[documentado, https://docs.finch3d.com/readme/news/ai-agent-archie.md]` — "exact" se refiere a precisión geométrica/paramétrica (snapping, centrado, alineación a grid), no a que un modelo decida dónde debería ir una puerta desde cero: *"Automatically snap wall vertices to a clean grid, align slightly off-angle walls to be perfectly perpendicular to bounds, or extend walls to cleanly meet unit boundaries."* `[documentado, misma URL]`

## 4. Las normas: ¿cómo entra el código local?

Tres mecanismos documentados, combinados:

1. **Reglas duras parametrizables por el usuario ("Graph Rules")** — hay páginas dedicadas a "Area Graph rules" y "Passage and room width Graph rules", ambas descritas como para *"generate compliant floor plans"*, pero **su contenido técnico detallado tampoco está en texto plano** — las páginas fetcheadas solo devuelven título + una frase + video incrustado, igual que el algoritmo de corredor. El mecanismo preciso (cómo se codifica una regla, cómo se resuelve un conflicto entre reglas) **no se puede determinar** de fuentes de texto público; solo el propósito declarado. `[documentado el propósito, no el mecanismo: https://docs.finch3d.com/courses/advanced/area-graph-rules.md ; https://docs.finch3d.com/courses/advanced/passage-and-room-width-graph-rules.md]`
2. **Verificación en tiempo real, visual** — mientras se diseña, hay feedback de cumplimiento codificado por color (verde = cumple, gris = cumple con condición, rojo = no cumple) en distancias de egreso, y "red spaces show accessibility or collision issues" para clearances de accesibilidad. Esto es **verificación posterior a cada cambio**, no una restricción que impida geométricamente el error — el sistema deja ver el estado no conforme y el usuario decide. `[documentado, índice agregado; también en https://www.finch3d.com/product: "options that already meet your code and accessibility requirements"]`
3. **La biblioteca ya viene pre-filtrada por cumplimiento** — la página de producto dice que el sistema puebla unidades con *"options that already meet your code and accessibility requirements"*, y que es *"Adaptable to local codes and regulations."* Esto sugiere que buena parte del "cumplimiento normativo" no es una verificación algorítmica universal sino que **la biblioteca de plantas de cada organización ya está tageada como conforme a su código local** — la responsabilidad de que esas plantas base cumplan la norma recae en el arquitecto que las cargó a la biblioteca, no en un motor de verificación normativa general de Finch. `[inferencia, a partir de la combinación de: biblioteca institucional + "adaptable to local codes" + falta de mención pública de un motor de compliance codificado con normas específicas de países/ciudades]`

No se encontró documentación pública de un motor de compliance codificado exhaustivamente por jurisdicción (tipo "IBC Chapter 10" o "normativa municipal de Lima"); "adaptable to local codes" es una afirmación de producto sin especificar el mecanismo — `[documentado como afirmación de marketing, no como mecanismo: https://www.finch3d.com/product]`.

## 5. Qué hace el usuario y qué hace la máquina

La frontera, tal como surge de toda la evidencia:

- **El usuario define**: la masa/huella del edificio (o la importa desde Rhino/Revit), el mix de unidades objetivo, las reglas de grafo (áreas mínimas, adyacencias, luz natural requerida), las distancias de egreso y dimensiones de núcleo, la orientación preferida de escaleras/núcleos, los pesos relativos de las prioridades de diseño (sliders), y —crucialmente— **la biblioteca de plantas de partida** (su propio archivo de proyectos pasados).
- **La máquina decide**: la partición geométrica del piso en núcleos, la orientación de circulación, el "wrap" de unidades alrededor del núcleo, el matching planta-huella con scoring, la deformación (stretch/compress) de una planta de biblioteca para encajarla, el espejado/vinculación entre unidades, el snapping y limpieza geométrica de muros, y —vía Archie— la ejecución mecánica de ediciones repetitivas (puertas, ventanas, homologación de anchos, generación de tablas/exportes).
- **Nadie edita el grafo directamente** — es generado y usado automáticamente por el sistema; el usuario opera sobre reglas y resultados, no sobre la estructura de datos interna. `[documentado, cita de Wallgren en sección 1]`
- El propio fundador encuadra el resultado como **punto de partida, no diseño final**: *"the generated suggestions are not intended to be the final design but rather a great start for the architect to tweak and to add their own touch to."* `[documentado, ArchDaily]`

## 6. El rol del LLM (Archie) — lo más importante

**Archie no genera geometría de forma libre; orquesta herramientas deterministas y delega a sub-agentes especializados.** Esto es lo mejor documentado de todo el sistema y la respuesta más clara a la pregunta central de la tarea:

- Arquitectura de agente con **delegación jerárquica explícita**, no un único modelo monolítico decidiendo todo: *"Delegate large-scale door editing tasks (like standardizing widths across multiple floor plans) to a specialized door-editing sub-agent"* y *"Delegate edits for facade/story-level windows... to a specialized window-editing sub-agent."* `[documentado, https://docs.finch3d.com/readme/news/ai-agent-archie.md]`
- Sus capacidades documentadas son, en esencia, **llamadas a funciones sobre el modelo de datos existente**, no síntesis de diseño:
  - Consulta/analítica: *"Retrieve building statistics: Get gross floor area (GFA), net internal area (NIA), unit/story counts, and area breakdowns."*
  - Búsqueda: *"Find and count elements: Search for units, spaces (rooms), doors, or walls matching specific criteria."*
  - Edición paramétrica acotada: reposicionar/redimensionar/voltear puertas ya existentes, no inventar su ubicación desde una lectura libre del plano.
  - Gestión de plantillas: *"Copy entire unit plan templates or story templates and apply them to other target units."* — de nuevo, copiar y aplicar, no generar.
  - Limpieza geométrica determinista: snapping a grid, perpendicularidad, extensión de muros a límites.
  - Exportación de datos: generar tablas CSV/XLSX (door schedules, unit mixes).
- **No se encontró en ninguna fuente pública qué modelo de lenguaje subyace a Archie** (no se menciona GPT, Claude, Gemini, ni un modelo propio) — `[no se puede determinar]`.
- No hay evidencia pública de que Archie tome decisiones de diseño no supervisadas (p. ej., decidir el mix de unidades o la forma del núcleo); sus verbos documentados son todos de tipo "resize/reposition/flip/center/remove/copy/apply/retrieve/search/export" — verbos de manipulación y consulta, no de creación compositiva. `[inferencia a partir del inventario exhaustivo de capacidades documentadas — la ausencia de un verbo generativo en toda la lista es el dato]`

**Conclusión sobre el LLM**: Archie encaja en el patrón "agente conversacional como capa de orquestación sobre un motor CAD paramétrico determinista", no en el patrón "LLM que razona sobre geometría y la dibuja". El diseño (masa → núcleo → corredor → unidades → biblioteca) ocurre en el motor de grafo/optimización y en el motor de matching de biblioteca, ambos anteriores y no-LLM; Archie llega después, como capa de conveniencia sobre datos ya estructurados.

---

## Fuentes consultadas

- `https://docs.finch3d.com/` (landing de documentación, sin detalle técnico propio)
- `https://docs.finch3d.com/llms-full.txt` (índice agregado de toda la documentación — fuente más rica en texto, aunque de segunda mano respecto a las páginas individuales)
- `https://docs.finch3d.com/sitemap.md`
- `https://docs.finch3d.com/courses/finch-101/finch-101-generate-floor-plate-algorithms.md`
- `https://docs.finch3d.com/courses/finch-101/finch-101-generating-unit-plans.md`
- `https://docs.finch3d.com/courses/advanced/corridor-and-unit-mix-algorithm.md` (solo título + video, sin texto técnico)
- `https://docs.finch3d.com/courses/advanced/area-graph-rules.md` (solo título + video)
- `https://docs.finch3d.com/courses/advanced/passage-and-room-width-graph-rules.md` (solo título + video)
- `https://docs.finch3d.com/readme/news/ai-agent-archie.md`
- `https://docs.finch3d.com/docs/projects-and-variants/unit-editor/enterprise-generate-unit-plan.md`
- `https://www.finch3d.com/product`
- `https://aecmag.com/ai/finch3d-starts-to-sing/`
- `https://architosh.com/2024/09/finch3d-advances-ai-based-floor-plan-generator/`
- `https://www.archdaily.com/929300/can-a-machine-perform-the-work-of-an-architect-a-chat-with-jesper-wallgren-founder-at-finch-3d`
- `https://illustrarch.com/articles/75056-finch3d-review.html` (reseña de tercero)
- `https://parametric-architecture.com/adaptive-building-plans-by-jesper-wallgren/` (2019, promocional, sin detalle técnico)
- `https://nordic9.com/companies/finch-3d-company0390149229/`, `https://www.crunchbase.com/organization/finch-bf21` (datos de fundadores/empresa)
- Búsquedas sin resultado relevante: Google Patents (`patents.google.com`) por Finch/Finch3D/Finch AB/Wallgren/Kretz; USPTO; papers académicos de los fundadores; nombre del LLM detrás de Archie; contenido en texto del video del algoritmo de corredor y unit mix (YouTube `5uuKiNdRoxo`), no transcripto.

## Qué no se pudo determinar

- El mecanismo interno exacto del "algoritmo de corredor y unit mix" (cómo pesa variables, qué tipo de solver usa) — la única fuente pública es un video de YouTube sin transcripción accesible.
- El mecanismo interno exacto de las "Graph Rules" (estructura de datos, cómo se resuelven conflictos entre reglas) — mismo problema, páginas de documentación con solo video.
- Si existe algún motor de verificación normativa codificado por jurisdicción específica, o si "compliance" se reduce a que la biblioteca del usuario ya viene pre-tageada por su propio equipo.
- Qué modelo de lenguaje (o si es un modelo propio) potencia a Archie.
- Cualquier patente de Finch3D o de sus fundadores — no se encontró ninguna públicamente.
- Origen académico (KTH/Chalmers) de los fundadores o papers publicados por ellos sobre grafos y plantas — no se encontró evidencia; el dato de partida de la tarea sobre "Rasmus Fahlander" como fundador tampoco pudo confirmarse (los fundadores documentados son Jesper Wallgren, Pamela Nuñez Wallgren y Martin Kretz).

---

## Qué significa para ALICE

1. **La biblioteca es el activo, no el algoritmo.** Lo que hace fuerte a Finch no es un modelo generativo sofisticado: es tener plantas reales, ya construidas y ya conformes a norma, curadas por estudio. Un generador propio necesita primero una biblioteca de plantas validadas (aunque sea pequeña) antes de necesitar un algoritmo de generación libre — el orden de prioridades importa.

2. **Separar "geometría dura" de "interior de unidad" es la decisión arquitectónica correcta.** Finch usa un motor de grafo/optimización para masa-núcleo-corredor (donde las reglas son pocas y muy verificables: egreso, adyacencia, área) y un motor de matching+deformación para el interior de cada unidad (donde la variabilidad de gustos y layouts es enorme). Pedirle a un LLM que dibuje la planta completa de una vez colapsa estas dos capas, que tienen naturalezas de problema muy distintas — una es optimización combinatoria, la otra es recuperación y adaptación de casos.

3. **"Stretch/compress con score de match" es más barato y más confiable que generar desde cero.** El patrón de Finch (buscar la planta más parecida en la biblioteca, medir cuánto hay que deformarla, mostrar esa métrica al usuario) es replicable sin ningún LLM — es geometría paramétrica + una función de distancia entre plantas. Esto es lo más directamente adoptable para ALICE a corto plazo.

4. **El LLM, si se usa, va después de la geometría, no antes.** El patrón de Archie —consultar, buscar, editar elementos ya existentes, delegar a subagentes deterministas para tareas acotadas (puertas, ventanas)— es el uso de LLM más defendible: como capa de conveniencia/edición sobre un modelo ya generado por métodos duros, no como el generador. Pedirle a un modelo de lenguaje que "dibuje la planta" es apostar a que el modelo razone correctamente sobre geometría, escala y norma en un solo paso — algo que ni Finch, con años de desarrollo y financiamiento, delega a su LLM.

5. **El cumplimiento normativo se resuelve mayormente por diseño de biblioteca + verificación visual, no por un motor de reglas universal.** Esto es alcanzable para ALICE: no hace falta codificar el reglamento nacional de edificaciones completo — alcanza con (a) que las plantas base ya cumplan, y (b) un chequeo posterior barato (distancias, áreas mínimas, accesibilidad) con feedback visual tipo semáforo, exactamente como hace Finch.

6. **La transparencia de métricas (score de match, % de adaptación, dashboard de GFA/NIA/CO2) es un differentiator de producto tan importante como el algoritmo mismo.** Vale la pena que ALICE muestre "esta planta es la más parecida y se estiró un 12% para encajar" en vez de solo entregar una geometría — genera confianza y permite al arquitecto decidir si acepta o rehace.

7. **Lo que Finch hace mejor y probablemente no vale la pena replicar de entrada**: el motor de optimización de masa/núcleo/corredor con sliders multi-objetivo (unit mix, daylight, squareness, adjacencies simultáneos) es sofisticado y años de ingeniería; para un generador propio, empezar con reglas más simples y secuenciales (definir núcleo → definir corredor → repartir unidades) es razonable antes de intentar optimización multi-objetivo en paralelo.

8. **Ojo con la trampa de "IA" en el marketing.** Ni la documentación ni la prensa técnica describen a Finch como un sistema que "diseña" con IA generativa de geometría — es optimización + reglas + biblioteca, con una capa conversacional (Archie) para tareas mecánicas. Si ALICE se está planteando competir con "más IA generativa pura", la evidencia pública sugiere que ese no es el camino que ni siquiera el líder de mercado adoptó del todo — sigue anclado en biblioteca y reglas duras.
