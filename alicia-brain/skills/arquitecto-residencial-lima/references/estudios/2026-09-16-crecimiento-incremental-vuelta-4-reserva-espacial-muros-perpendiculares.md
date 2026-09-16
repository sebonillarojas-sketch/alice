# Día 43 — 2026-09-16 — Crecimiento incremental, cuarta vuelta: el patio como reserva espacial y los muros portantes perpendiculares a la calle

Tema (7) del currículo rotativo, cuarta vuelta. Vueltas anteriores sobre este tema: día 7 (PREVI Lima 1969 / "half a good house" de ELEMENTAL, general), día 19 (independización registral de aires, Ley 27157), día 31 (vivienda productiva con acceso independiente, John Turner). Ángulo de hoy, no cubierto antes: **cómo se distribuye la planta de la etapa 1 para que la ampliación futura sea geométricamente gratuita** — no solo "dejar un cuarto vacío", sino que el patio/pozo de hoy sea la huella exacta del ambiente de mañana, y que la estructura de hoy ya anticipe por dónde crece.

## Qué se investigó

Un estudio de cross-case analysis sobre las 8 propuestas de PREVI Lima (1967-1976) identifica tres principios de diseño que habilitan el crecimiento guiado por el residente: **(1)** el patio interior como reserva espacial, **(2)** muros portantes medianeros orientados perpendiculares a la calle, y **(3)** un núcleo fijo de servicios que ancla las instalaciones mientras maximiza la flexibilidad — "Designing for the Unfinished: PREVI Lima and the Architecture of Incremental Growth" (ICCAUA journal). Estos tres principios son justo lo que le faltaba a las tres vueltas anteriores del tema, que hablaban de "dejar espacio para crecer" en abstracto sin especificar CÓMO se distribuye ese espacio hoy para que no sea un desperdicio.

Complementario: la literatura general de "core house"/vivienda incremental (MIT SIGUS, UN-Habitat, IOP Science) coincide en que la etapa inicial ("seed dwelling") debe incluir el núcleo húmedo fijo (cocina+baño) más al menos un dormitorio, dejando el resto como "espacio de expansión" que el residente llena según sus recursos — no como un lote vacío sin relación con la huella futura, sino como una extensión predecible del mismo esqueleto estructural.

Un dato peruano específico (ya citado el día 40, reutilizado hoy con el ángulo correcto): más del 40% de las viviendas autoconstruidas de Lima Metropolitana ya se ampliaron, y sobre eso la vivienda semilla necesita un plan de ampliación explícito, no una esperanza.

## Ideas clave

- El patio/pozo que hoy da luz y ventilación a la sala o al dormitorio principal NO es un remanente: es la huella dimensionada EXACTAMENTE como el futuro dormitorio 2 (o 3, o 4), con el mismo ancho de crujía y el mismo eje de muro húmedo que usaría la ampliación. Esto es distinto de simplemente "dejar el fondo del lote sin construir" — el patio de reserva de hoy YA tiene las proporciones correctas de una habitación real.
- Los muros perpendiculares a la fachada (los medianeros, en un lote entre-medianeras) se construyen portantes y de punta a punta desde el día uno — incluso donde hoy no hay techo — para que la ampliación futura sea agregar SOLO el muro transversal de cierre (tabique, no portante) y el techo de la bahía nueva, sin tocar estructura ya resuelta ni pedir un muro nuevo compartido con el vecino.
- El núcleo húmedo fijo (regla 156-158, día 40, pensado para crecimiento VERTICAL) tiene un equivalente para crecimiento HORIZONTAL: se ubica siempre en la porción YA CONSTRUIDA de la vivienda semilla — nunca en la bahía de reserva — para que cocina y baño operen desde el día uno sin depender de que la ampliación se concrete.
- La reserva espacial exige una contabilidad de luz a futuro: cuando el patio se techa y se convierte en dormitorio, el ambiente que hoy tomaba luz de ese patio (la sala, el dormitorio principal) pierde su ventana — hay que declarar en la memoria de diseño de la etapa 1 cuál será la fuente de luz alterna en la etapa 2 (ventana de esquina, tragaluz, o la fachada nueva del ambiente que se agrega, con vidrio interior hacia el ambiente que se queda sin pozo).

## Reglas accionables agregadas a `lecciones-distribucion.md` (167-170)

167. El patio/pozo de una vivienda de crecimiento incremental se dimensiona como la huella exacta (mismo ancho y profundidad de crujía) del ambiente que se construirá en la siguiente etapa, no como un remanente sin proporción.
168. Los muros medianeros (perpendiculares a la fachada) se construyen portantes de punta a punta del lote desde el día uno, para que la ampliación agregue solo bahías completas con un muro transversal tabique de cierre — nunca un portante nuevo.
169. El núcleo húmedo fijo se ubica siempre en la porción ya construida de la vivienda semilla, nunca en la bahía de reserva.
170. Toda vivienda de crecimiento incremental documenta en su memoria de diseño la fuente de luz alterna que recibirá, en la etapa siguiente, el ambiente que hoy toma luz del patio de reserva.

## `correcciones/pendientes.md`

Sigue mostrando las mismas 4 correcciones del puente (c10/c11/c12/c13, día 40) sin marca de "resuelto" — van 16 días repitiéndose; ya incorporadas en profundidad como reglas 159/160/162 desde el día 41 y re-verificadas contra las 3 unidades de hoy (ningún dormitorio depende de un baño para su acceso — los 3 ejercicios usan un hall o un vestidor como único vecino no-baño de cada dormitorio; el dormitorio principal es siempre ≥ que cada secundario; u03, segmento alto, resuelve un baño por dormitorio). No se reabrieron las 4 imágenes anotadas por completitud (ya auditadas a fondo desde el día 41).

## Metodología y verificación

No se llamó a `aliceai.bam.pe` (bloqueo de egreso confirmado). Tavily no está autorizada en esta sesión no interactiva; la investigación se hizo con `WebSearch` — varios intentos de `WebFetch` directo (habitat.org, iopscience.iop.org, jensbrandt.net, journal.iccaua.com) fueron bloqueados por el proxy de egreso, así que las fuentes citadas arriba se apoyan en los resúmenes que `WebSearch` sí alcanzó.

Se instaló el paquete `playwright` (no disponible en el entorno; el binario de Chromium ya estaba pre-instalado en `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) para verificar visualmente los 3 SVG antes de exportarlos. Se escribieron en el scratchpad de la sesión (no versionados): `gridbuild.py` (compilador de layouts por filas/columnas con offset automático de medio espesor de muro por lado, reutilizado para las 3 unidades) y `render.py` (renderizador SVG+ASCII genérico: dibuja `muros` directamente desde el JSON, y calcula la posición de puertas/ventanas por solape de proyección real entre los polígonos de los ambientes conectados — sin coordenadas de pantalla fijas por unidad).

Los 3 JSON pasan `scripts/validator.py` sin errores ni advertencias. Hallazgo importante del día: **`validator.py` no comprueba la adyacencia física real de las puertas (CHK-14) — solo que los nombres referenciados existan y que el grafo esté conectado** — así que se escribió una verificación manual aparte (proyección de solape entre los polígonos de `de` y `a`) para las 3 unidades, y esa verificación SÍ encontró errores reales que el validador había dejado pasar:
1. En un primer borrador de u02, la puerta `hall→dormitorio principal` no tenía arista compartida en absoluto (el hall quedaba lejos del dormitorio principal en el layout por filas/columnas original) — error real de "puerta fantasma", el mismo patrón ya documentado los días 25/30/38. Se corrigió rediseñando u02 con un **hall como fila propia de ancho completo** entre la fila de húmedos y la fila de dormitorios (igual que u03), de modo que el hall es automáticamente vecino de TODOS los ambientes de la fila de abajo sin necesitar alinear columnas a mano.
2. En el mismo borrador, la puerta `sala-comedor→cocina` (pensada como apertura ancha tipo americana) medía 1.80 m pero el solape real disponible era de solo 1.65 m — se corrigió angostando la puerta a 1.60 m.
3. En u02 (segunda iteración), `sala-comedor→hall` y `sala-comedor→baño 2` fallaban porque la terraza (al otro extremo del frente) tapaba el solape necesario — se corrigió invirtiendo el orden de sala/terraza en la fila 1 para que toda la fila de húmedos quedara bajo la sala, no bajo la terraza.

Se verificaron visualmente los 3 SVG con capturas de Chromium headless antes de exportar: sin solapes, puertas con arco de giro hacia el ambiente servido, ventanas solo sobre fachada real o sobre el pozo/patio de reserva declarado. Circulación (hall) de u02: 9.79%; de u03: 9.97% — ambas justo bajo el 10% recomendado, sin necesidad de advertencia [A].

## Las 3 tipologías de hoy (ejercicios independientes)

- **u01 — 1D/1B, San Juan de Lurigancho/Lima Norte (6.30×12.75 m, 71.13 m²).** Vivienda semilla de crecimiento horizontal: sala-comedor al frente, núcleo húmedo (vestidor+baño+cocina+lavandería) en la porción ya construida, dormitorio principal, y un patio de reserva de ancho completo (6.05 m ≥ 6 m) que es la huella exacta del futuro dormitorio 2. Medianeros portantes de punta a punta.
- **u02 — 2D/2B, Jesús María-Surquillo/Lima Moderna-Top (7.40×12.50 m, 80.33 m²).** Reserva para un futuro dormitorio 3. Hall de ancho completo como único distribuidor del bloque íntimo (vestidor, dormitorio principal, dormitorio 2 y baño 2 son todos vecinos directos del hall); baño 2 con doble acceso real (sala/visita + hall).
- **u03 — 3D/3B, La Molina-Surco/Lima Top (9.35×13.35 m, 109.54 m²).** Segmento alto (regla 162: un baño en suite por dormitorio, resuelto en una sola fila de húmedos). Reserva para un 4to ambiente (dormitorio 4 o estudio). Hall de ancho completo reparte los 3 dormitorios, el vestidor de la suite y el baño 3, con baño 2 de doble acceso sala/hall para cumplir CHK-18 sin cruzar ningún dormitorio.
