# Día 44 — 2026-09-17 — Mercado limeño por distrito, cuarta vuelta

## Qué estudié

Tema (8) del currículo rotativo, cuarta vuelta. Tres ángulos de mercado 2026 no cubiertos por las tres vueltas anteriores (v1: segmentación CODIP día 8; v2: piso regulatorio DS 005-2025-VIVIENDA día 20; v3: coliving/roomie día 32):

1. **El "techo técnico" de ~60 m² para 2D/3D.** El metraje promedio de venta en Lima cayó de 70.8 a 63.9 m² en los últimos cuatro años; hoy el 50.1% de las unidades vendidas está entre 40 y 60 m². Corredores y analistas describen 60 m² como un límite **técnico**, no comercial: es lo que resulta de sumar los mínimos normativos de cada ambiente (sala-comedor, 2 dormitorios, cocina, baño(s), lavandería, circulación) — no una decisión de marketing. Cifras 2026 más finas: 2D promedia 61.2 m², 3D/2B promedia 76.4 m².
2. **El home office/estudio profesional como pieza de programa en el segmento premium.** En proyectos de Lima Top 2026 dirigidos a compradores que trabajan remoto para empresas de otros países, el "estudio profesional" aparece como una pieza con identidad propia — a veces con baño propio, kitchenette y **entrada secundaria** para recibir clientes sin invadir la zona familiar —, no como un dormitorio de servicio reconvertido ni un rincón de la sala.
3. **Distribución sigue siendo el factor #1 de decisión de compra** (73% de menciones, CODIP), lo que confirma que optimizar layout — no solo precio/m² — es donde de verdad compite un proyecto en 2026.

## Ideas clave

- El techo de 60 m² no es arbitrario: es la suma de los mínimos de CHK-05 del skill (sala-comedor 16.0 + dormitorio principal 10.5 + dormitorio secundario 6.5 + cocina 4.0 + baño 2.4×2 + lavandería 1.6 + circulación) para un 3D/2B ronda exactamente esa cifra. Comprimir por debajo de eso ya no es "optimizar la distribución": es sacrificar un ambiente completo.
- El estudio/home-office premium no es un cuarto más del bloque de dormitorios: su entrada independiente lo convierte en una **cuarta zona** (junto a social/íntima/servicio, Neufert p. 294) con su propia relación con la fachada y con el ingreso.
- Los distritos que ganan demanda por conectividad (Lince, San Miguel, Ate) están en el segmento estándar (40-60 m²), mientras que el home office profesional es un fenómeno de Lima Top — son dos mercados con lógicas de distribución distintas, no una gradación continua del mismo programa.

## Reglas accionables para la distribución en Lima (agregadas a `lecciones-distribucion.md`, 171-174)

1. Antes de comprimir un área objetivo hacia el piso de mercado (60 m² para 2D/3D en 2026), sumar los mínimos reales de CHK-05 del programa completo; si el objetivo no los cubre, sacrificar un ambiente entero, nunca adelgazar todos por igual.
2. Un home office con entrada independiente se trata como cuarta zona (con su propia puerta `de:exterior`, excepción documentada de CHK-13) y proximidad a un baño sin cruzar la zona íntima familiar.
3. Actualizar las referencias de área objetivo de mercado 2D (~61 m²) y 3D/2B (~76 m²) para diseños ambientados en 2026, sin tocar `tipologias-lima.md`.
4. Todo ambiente que toque dos fachadas reales (esquina) debe declarar una ventana por cada fachada, no una sola ventana repartida — evita que el renderizador/validador le atribuya ambas al mismo lado.

Fuentes: [RPP, "Departamentos en Lima: tamaño promedio cayó de 71 a 64 metros cuadrados"](https://rpp.pe/economia/economia/departamentos-en-lima-tamano-promedio-cayo-de-71-a-64-metros-cuadrados-y-dormitorios-se-achican-llego-limite-inmobiliario-noticia-1698216); [Infobae, "La venta de departamentos en Lima... se acerca al umbral técnico de 60 m² para tres habitaciones"](https://www.infobae.com/peru/2026/07/21/la-venta-de-departamentos-en-lima-no-se-detiene-y-se-acerca-a-su-umbral-tecnico-de-60-m-para-tres-habitaciones/); [ASPAI, mismo hallazgo](https://aspai.pe/2026/07/22/la-venta-de-departamentos-en-lima-no-se-detiene-y-se-acerca-al-umbral-tecnico-de-60-m%c2%b2-para-tres-habitaciones/); [PENTHOUSE, "Tendencias 2026-2030 del residencial de lujo en Lima: home office"](https://penthouse.pe/tendencias-residencial-lujo-lima-2026-2030/); [aamiapp, "Tendencias inmobiliarias Lima 2026"](https://aamiapp.com/blog/tendencias-inmobiliarias-lima-2026-analisis-del-mercado-de-departamentos-y-proyecciones-130930) (CODIP: distribución 73% de menciones).

## Las 3 unidades de hoy

Un ejercicio de diseño por tipología (1D, 2D, 3D), cada una sobre su propio lote, sin remanentes — fachada viva, zona buffer, sala siempre con luz, baños que acompañan a los dormitorios, cocina explícita, pozo ≥6 m en una dimensión cuando el parti lo exige, lavandería y terraza siempre.

- **u01 — 1D/1B estándar en distrito en alza** (San Miguel-Lince/Lima Moderna, 7.20×7.65, 44.5 m²): fachada única frente ancho; enfilade dormitorio principal→vestidor→baño 1 (zona buffer, regla 6) sin necesidad de doble acceso (1D admite el suite como único baño, CHK-18); cocina explícita (8.3 m²) y lavandería propia al fondo, sobre el eje `muro_humedo`; terraza posterior. No usa la cifra de mercado 2026 como objetivo estricto — representa el segmento estándar de un distrito conector, no el compacto de inversión mínimo.
- **u02 — 2D/2B esquina real NORTE+ESTE, recalibrado al mercado 2026** (Surquillo-Jesús María/Lima Moderna, 9.05×8.75, 65.5 m², cerca de la mediana 2026 de 61.2 m²): sala-comedor en el vértice con **ventana de esquina real** (una ventana en el paño NORTE y otra en el paño ESTE, regla 174 nueva); baño principal en suite (vestidor+baño, regla 6) para el dormitorio principal; baño 2 con doble función — ensuite de dormitorio 2 (comparte pared con él) y de visita (accesible desde el hall sin cruzar cocina ni dormitorio principal, satisface el patrón "en 2D: en suite del principal + uno que sirva al dorm2 y de visita"); lavandería separada de la cocina; terraza generosa junto a la lavandería.
- **u03 — 3D/3B + estudio profesional con entrada secundaria, Lima Top** (La Molina/Lima Top, fachada única de frente muy ancho 21.45×14.65, 159.9 m², pozo posterior 21.45×6.20 m ≥6 m en una dimensión): aplica la regla 172 — el estudio tiene su propia puerta `de:exterior` (documentada como excepción de CHK-13 junto a la puerta principal de la sala) y accede al baño de visita a través del hall, sin cruzar la zona íntima; un baño en suite por dormitorio (segmento alto, regla 162, día 40) — dormitorio principal con vestidor+baño; dormitorio 2 y 3 con baño propio cada uno; cocina, lavandería y baño de visita contra el mismo eje `muro_humedo` que las 3 suites, todos los húmedos en una sola línea recta.

## Autocrítica (checklist)

Los 3 JSON pasan `scripts/validator.py` sin errores. Verificación manual adicional del checklist completo (CHK-01 a CHK-23):

| CHK | u01 | u02 | u03 |
|---|---|---|---|
| CHK-06 (proporción) | todas ≤ límite | todas ≤ límite | **[A]** sala-comedor 3.64 (límite 2.6) — ver justificación abajo |
| CHK-13 (una puerta exterior) | 1 puerta ✓ | 1 puerta ✓ | **[A]** 2 puertas exterior (sala + estudio) — excepción documentada por brief (regla 172) |
| CHK-17 (circulación ≤10%) | 0% (sin hall) | hall 2.05/65.51=3.1% ✓ | **[A]** hall 25.14/159.93=15.7% — ver justificación abajo |
| CHK-18 (privacidad baño) | n/a (1D, suite único) | baño 2 alcanzable sala→hall→baño2 sin cruzar dormitorio ✓ | baño visita alcanzable sala→hall→baño visita sin cruzar dormitorio ✓ |
| CHK-19 (muro húmedo) | baño1/cocina/lavandería a 0 m del eje ✓ | bañoP/cocina/baño2/lavandería a 0 m del eje ✓ | los 6 húmedos (cocina/lavandería/bañovisita/bañoP/baño2/baño3) a 0 m del eje ✓ |
| CHK-22 (toda habitación con puerta) | ✓ | ✓ | ✓ |
| regla 159/160 (acceso nunca vía baño; principal ≥ secundario) | dormitorio único, n/a jerarquía | dormitorio principal (12.24) > dormitorio 2 (7.54); ambos con vecino no-baño directo ✓ | dormitorio principal (13.6) > dormitorio 2/3 (10.2); los 3 con acceso directo desde el hall, nunca vía baño ✓ |
| regla 162 (segmento alto, un baño por dormitorio) | n/a (1D) | n/a (2D usa el estándar 2B) | 3 dormitorios, 3 baños en suite + 1 de visita ✓ |

Advertencias [A] aceptadas y justificadas:
- **u03, sala-comedor prop. 3.64:** la sala ocupa 12.00 m de un frente de 21.45 m (parti de frente muy ancho, mismo patrón de días 26/41/42/43 con salas/halls anchos); acortar su ancho para bajar la proporción reduciría el frente vivo que hoy reparten estudio+sala+terraza. Se acepta con el mismo criterio que días previos.
- **u03, 2 puertas `de:exterior`:** excepción explícita por brief — el estudio profesional necesita recibir clientes sin pasar por el ingreso familiar (regla 172 nueva, tendencia 2026 de home office con entrada propia).
- **u03, circulación 15.7%:** el hall reparte 3 dormitorios (cada uno con su baño en suite) + cocina + lavandería + baño de visita + el acceso desde sala/estudio sin cruzar ningún dormitorio ni baño entre sí — mismo "corridor tax" aceptado en días 9/31/38/41/42/43 para hall de ancho completo en 3D de fachada única.

## Nota de proceso

`correcciones/pendientes.md` sigue mostrando las mismas 4 correcciones del puente (c10-c13, día 40) sin marca de "resuelto" — van 17 días repitiéndose, ya incorporadas en profundidad desde el día 41 como reglas 159/160/162 y re-verificadas hoy contra las 3 unidades (tabla de arriba); no se reabrieron las 4 imágenes anotadas por completitud, solo se re-verificaron sus reglas. No se llamó a `aliceai.bam.pe` (bloqueo de egreso de la sesión, confirmado en `/__agentproxy/status`); Tavily no está autorizada en esta sesión no interactiva (MCP sin credenciales OAuth), la investigación se hizo con `WebSearch`, sin bloqueos del proxy en ninguna de las dos búsquedas.

Se escribieron 3 scripts propios en el scratchpad de la sesión (no versionados): `gridlib.py` (compilador de layouts por filas/columnas — cada fila cubre el ancho interior completo con su propia lista de celdas, sin exigir que las columnas se alineen entre filas; el último alto/ancho de cada fila/celda puede autocompletarse para garantizar cobertura exacta sin remanentes), `build_u0N.py` (tres instancias concretas, iteradas hasta pasar `validator.py` y las proporciones manuales de CHK-06) y `render.py` (SVG+ASCII genérico: puertas por detección de arista compartida real entre `de`/`a` con arco de giro hacia el ambiente servido, ventanas rotando entre las aristas de fachada/pozo que el ambiente realmente toca —corrige un hallazgo propio: la primera versión asignaba TODAS las ventanas de un ambiente a la misma arista aunque el ambiente tocara dos fachadas, dibujando la ventana de esquina de u02 dos veces sobre el mismo paño en vez de una por fachada; corregido rotando por índice de ventana entre las aristas disponibles, documentado como regla 174 nueva—, y detección de pozo posterior cuando el área techada no llega al fondo del lote). Los 3 JSON pasan `scripts/validator.py` sin errores. Se verificaron visualmente los 3 SVG con capturas de Chromium headless (`chromium-1194/chrome-linux/chrome --headless --screenshot`) antes de exportar: sin solapes, puertas con arco de giro hacia el ambiente servido, ventanas correctamente repartidas por fachada real (incluida la esquina de u02) o sobre el pozo declarado (u03), nunca sobre un medianero.
