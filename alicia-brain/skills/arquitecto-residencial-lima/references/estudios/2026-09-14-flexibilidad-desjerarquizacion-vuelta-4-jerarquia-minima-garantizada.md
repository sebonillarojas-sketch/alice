# Día 41 — Flexibilidad y desjerarquización, cuarta vuelta: la jerarquía mínima garantizada

El currículo de 12 temas se completó tres veces (días 1-12, 13-24, 25-36) y ayer (día 40) cerró el
tema (4) por cuarta vez. Hoy toca el tema (5) **flexibilidad y desjerarquización** en su cuarta
vuelta. Las tres anteriores fueron: v1 (día 5) RNE Art. 11 + tabiques removibles; v2 (día 17)
Open Building/Habraken (soporte-infill, puerta corrediza de vano ancho); v3 (día 29) dormitorios de
área equivalente/idéntica para desjerarquizar por tamaño, marcando el rol solo por el baño en suite.

## Corrección de Sebastián aplicada hoy como criterio duro

Antes de diseñar se leyó `correcciones/pendientes.md`: contiene 4 correcciones **nuevas** del
puente (c10-c13, día 40) — la primera novedad real desde el día 25 (c5-c9 llevaban 15 días
repitiéndose ya incorporadas a las reglas 102-105/110-113/114-116). Se abrieron y miraron las 4
imágenes anotadas (`c10.png` aprobado sin notas, `c11.png`, `c12.png`, `c13.png`) antes de diseñar:

- **c11 (día 40, unidad 2D, a_corregir)**: "No es correcto acceder a un dormitorio a través de un
  baño. Y el dormitorio principal es de menor tamaño que el dormitorio secundario." — auditando la
  imagen, el recorrido de puertas del `2026-09-13-u02.json` iba sala→baño 2→vestidor→dormitorio
  principal: para llegar al dormitorio principal había que atravesar el baño 2. Y el dormitorio
  principal (9.82 m²) era más chico que el dormitorio 2 (16.70 m²).
- **c12 y c13 (día 40, unidad 3D, a_corregir, dos imágenes sobre el mismo plano)**: "No es correcto
  en un segmento alto tener un solo baño para 3 dormitorios. Recuerda que nos estamos enfocando en
  segmento a." — el `2026-09-13-u03.json` resolvía 3 dormitorios con solo 2 baños (uno en suite del
  principal + uno compartido entre los 2 secundarios), aceptable en el segmento estándar del skill
  (tabla del Paso 1: "3D→2B estándar") pero no en el segmento alto/Lima Top que el brief de ayer
  declaraba.
- **c10 (aprobado, sin notas)**: la unidad 1D de ayer confirma que un baño accesible SOLO desde el
  dormitorio principal (ensuite puro, sin acceso de visita) es válido en 1D — el patrón a evitar es
  específicamente que un baño sea la única ruta HACIA un dormitorio, no que un baño sea un
  dead-end sin visita.

Estas dos correcciones se cruzan exactamente con el ángulo de hoy: la "desjerarquización" del tema
5 (dormitorios de tamaño equivalente, v3, regla 114) tiene un límite que el diseño de ayer cruzó sin
querer — igualar o invertir tamaños no puede degradar al dormitorio principal por debajo del
secundario, y ninguna técnica de circulación (loop, regla 153) puede resolver un dormitorio
poniendo un baño como su única puerta de entrada.

## Qué dice la literatura sobre los límites de la desjerarquización

Un artículo académico revisado hoy (SciELO, arquitectura chilena) marca la distinción central: la
flexibilidad por **equivalencia de jerarquía** (dormitorios de tamaño y circulación similares, para
que cualquier usuario se apropie de cualquier espacio) es una alternativa deliberada a la
jerarquización funcionalista por defecto (sala/dormitorio principal/dormitorios secundarios con
roles fijos) — pero es una sustitución de UN criterio de jerarquía por OTRO, nunca la ausencia de
todo criterio. Aplicado a la regla 114 (día 29): igualar áreas es correcto; invertirlas (que el
"secundario" quede más grande que el "principal") no tiene ninguna base en la literatura de
flexibilidad revisada — no es una técnica de desjerarquización, es simplemente un error de reparto.

Sobre el hallazgo de circulación (c11): la literatura de baños Jack-and-Jill (dos dormitorios que
comparten un baño intermedio) documenta como defecto conocido que, sin querer, uno de los dos
dormitorios termine funcionando como el "paso obligado" hacia el baño del otro — la privacidad de
ese dormitorio queda comprometida porque cualquiera que use el baño cruza por su cuarto. El caso de
ayer es la variante más severa del mismo defecto: no un dormitorio sirviendo de paso hacia un baño,
sino un BAÑO sirviendo de paso hacia un dormitorio — ni siquiera aplica la lógica de "dos dormitorios
comparten instalación", porque el baño en el medio no es compartido por dos dormitorios, es la
antesala obligada de uno solo.

Sobre bedroom sizing y valorización: fuentes de tasación inmobiliaria (JVM Lending) documentan que
"tres dormitorios espaciosos y funcionales rinden más en el mercado que cuatro dormitorios chicos
que no caben muebles estándar" — el tamaño de dormitorio no entra directo en la fórmula de
valorización pero sí indirectamente vía el área bruta habitable (GLA), y el dormitorio principal es,
por convención de mercado (no por norma), el ancla de esa métrica: nunca el más chico de la unidad.

## Reglas accionables para la distribución en Lima (agregadas a lecciones-distribucion.md)

159. Ningún dormitorio puede depender de atravesar un baño (propio o de otro dormitorio) como
     única ruta de acceso, ni siquiera cuando el baño ocupa la posición de "zona buffer" (regla 6)
     entre la sala y el dormitorio principal — el vestidor puede ser un buffer atravesable, el baño
     (aparatos sanitarios, privacidad de uso, posible ocupación) nunca. Verificación de Paso 8: para
     cada dormitorio, listar sus vecinos directos en el grafo de puertas; si el ÚNICO vecino no-exterior
     es un ambiente "baño"/"baño visita", es error bloqueante.
160. El dormitorio principal nunca termina con área menor que un dormitorio secundario, ni siquiera
     aplicando la técnica de "dormitorios equivalentes" (regla 114, día 29): la equivalencia es un
     piso (secundario ≈ principal), nunca un techo que invierta la jerarquía. Verificación de Paso 8:
     comparar el área de "dormitorio principal" contra cada "dormitorio N"; si el principal es menor,
     es error bloqueante.
161. La desjerarquización real (regla 114-116 y la literatura de flexibilidad como "sistema
     emergente") no elimina todo criterio de jerarquía: sustituye la jerarquía POR TAMAÑO (default
     funcionalista) por una jerarquía marcada SOLO por el atributo que distingue el rol (baño en
     suite, regla 6), manteniendo un piso de área y posición para el dormitorio principal.
162. En segmento alto (Lima Top, área objetivo ≥84 m² por la tabla del Paso 1 del skill), un 3D no
     se resuelve con el 2B estándar de mercado: cada dormitorio necesita su propio baño (3B), nunca
     dos dormitorios secundarios compartiendo un único baño — la corrección de Sebastián marca esto
     como bloqueante, no como preferencia. El 2B estándar sigue siendo válido en segmento medio.

## Aplicación a las 3 unidades de hoy

Las 3 unidades (1D, 2D, 3D) aplican ambas reglas nuevas como criterio duro, además de las reglas
obligatorias de siempre (fachada viva, zona buffer, baños acompañando dormitorios, cocina explícita,
pozo ≥6 m en una dimensión, lavandería y terraza siempre):

- **u01 (1D/1B, San Miguel)**: dormitorio principal accede directo desde la sala-comedor (nunca vía
  el baño); el baño 1 es un dead-end ensuite alcanzado solo desde el vestidor — válido porque el
  dormitorio en sí NUNCA depende del baño para su propio acceso (mismo patrón aprobado en c10).
- **u02 (2D/2B, esquina real NORTE+ESTE)**: dormitorio principal 9.66 m² > dormitorio 2 7.84 m²
  (corrige c11 directamente); dormitorio 2 tiene puerta directa al hall (no depende del baño 2 para
  entrar) y el baño 2 es un loop en miniatura (regla 153) con doble acceso real: hall→baño 2 (visita)
  y dormitorio 2→baño 2 (ensuite), ambas aristas con adyacencia física verificada.
- **u03 (3D/3B, fachada única de frente amplio, La Molina-Surco/Lima Top)**: corrige c12/c13 con un
  baño en suite por dormitorio (9.76/7.85/7.70 m², principal siempre el mayor) — los 3 dormitorios,
  sus 3 baños, la cocina, la lavandería y el baño de visita quedan todos en una sola fila contra un
  `muro_humedo` de eje único (evita el error geométrico de intentar alinear dos clusters de húmedos
  separados por el hall, que en un primer borrador falló CHK-19 con 3 errores de "a 1.48 m del muro
  húmedo" — se corrigió fusionando el cluster de servicio (cocina/lavandería/baño visita) a la MISMA
  fila que los 3 baños en suite, en vez de dejarlo en una fila intermedia entre la sala y el hall).

Advertencia [A] aceptada y justificada: circulación de u03 en 14.6% (22.19/151.64 m², hall de ancho
completo de 18.00 m que reparte 3 dormitorios + cocina + baño visita sin cruzar ningún baño ni
dormitorio entre sí) — por encima del 10% recomendado, mismo razonamiento de "corridor tax" aceptado
desde los días 9/31/38 cuando el hall sirve muchas piezas sin ambigüedad de recorrido.

No se llamó a `aliceai.bam.pe` (bloqueo de egreso de la sesión, confirmado en `/__agentproxy/status`
antes de empezar). Tavily no está autorizada en esta sesión no interactiva (MCP sin credenciales);
la investigación se hizo con `WebSearch` — dos intentos de `WebFetch` directos (housingdesignmatters.com
y scielo.cl) fueron bloqueados por el proxy de egreso o por resolución DNS, se usaron los resúmenes
de `WebSearch` (que sí llegó a esas mismas fuentes) como base citable. Se instaló `shapely` y
`cairosvg` (no disponibles en el entorno) para escribir un compilador de layouts por rectángulos
propio (`builder.py`, scratchpad, no versionado) que verifica cobertura exacta del envolvente
(sin huecos ni solapes) por muestreo de 5 cm antes de emitir el JSON, deriva `muros` por fusión de
tramos contiguos reales, y expone un reporte de área/proporción por ambiente para iterar sin
recalcular a mano. Se escribió también un verificador suplementario (`manual_checks.py`) que sí
calcula CHK-06 (proporción), CHK-17 (circulación) y las dos reglas nuevas 159/160 sobre los 3 JSON
finales — los tres pasan limpio. Los 3 JSON pasan `scripts/validator.py` del skill sin errores; el
renderizador SVG+ASCII propio (`render.py`, scratchpad, no versionado) detecta la arista compartida
real entre ambientes por solape de proyección para ubicar puertas (arco de giro hacia el ambiente
servido) y dibuja ventanas solo sobre el borde global del lote o sobre un borde compartido con
terraza/pozo, nunca sobre un medianero; se verificó visualmente con `cairosvg` antes de exportar —
las 3 plantas renderizan sin solapes ni remanentes.

## Fuentes

- [SciELO Chile, "Consideraciones acerca del concepto de flexibilidad: el hogar como sistema emergente"](https://www.scielo.cl/scielo.php?script=sci_arttext&pid=S0717-69962023000100004)
- [JVM Lending, "Bedroom Counts And Home Values — A Very Big Deal!"](https://www.jvmlending.com/blog/bedroom-counts-and-home-values-a-very-big-deal/)
- [Lamont Bros., "Pros and Cons of a Jack and Jill Bathroom"](https://www.lamontbros.com/learning-center/pros-and-cons-of-a-jack-and-jill-bathroom)
- [Housing Design Matters, "Jack & Jill – A Cautionary Tale"](https://www.housingdesignmatters.com/jack-jill/) (resumen vía WebSearch, WebFetch directo bloqueado por el proxy)
- Corrección directa de Sebastián, día 40 (`correcciones/pendientes.md` c11/c12/c13, commit del puente sobre `2026-09-13-u02.json`/`2026-09-13-u03.json`)
