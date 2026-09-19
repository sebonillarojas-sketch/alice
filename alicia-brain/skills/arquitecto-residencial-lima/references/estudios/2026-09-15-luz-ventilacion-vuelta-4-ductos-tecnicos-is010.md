# Día 42 — Luz y ventilación en la distribución, cuarta vuelta: el ducto técnico (RNE A.010 Art. 44)

El currículo de 12 temas se completó tres veces (días 1-12, 13-24, 25-36) y ayer (día 41) cerró el
tema (5) por cuarta vez. Hoy toca el tema (6) **luz y ventilación en la distribución** en su cuarta
vuelta. Las tres anteriores fueron: v1 (día 6) crujía máxima iluminable + ventana de esquina +
efecto chimenea; v2 (día 18) viento predominante SUR-OESTE de Lima + muro-ala junto a ventanas de
ventilación unilateral; v3 (día 30) ventilación cruzada verificada sobre la ruta completa de
puertas + dimensionamiento asimétrico entrada:salida 1:1.5-2.

Las tres vueltas anteriores asumieron siempre que un ambiente húmedo (baño, cocina) que no consigue
vano de fachada/pozo simplemente "pierde la pugna" y queda a oscuras (regla 113, día 28: "cuando
cocina y baño compiten por el único paño de pozo disponible, la ventana se le cede al baño y la
cocina ventila por ducto IS.010"). Hoy se estudia el mecanismo normativo REAL detrás de esa
alternativa — el ducto de ventilación técnica del RNE A.010 Art. 44 — con su dimensionamiento
exacto, y se usa para invertir el reparto del día 28: si un baño NUNCA necesita ventana pero una
cocina sí se complica sin ella (campana, tiro de humos), el default debería favorecer a la cocina,
no al baño.

## Corrección de Sebastián — sin novedad hoy

`correcciones/pendientes.md` sigue mostrando las mismas 4 correcciones del puente (c10 aprobado sin
notas, c11/c12/c13 a_corregir) que llegaron el día 40 y que el día 41 ya incorporó como reglas 159
("ningún dormitorio depende de atravesar un baño"), 160 ("el principal nunca es menor que un
secundario") y 162 ("en segmento alto, un 3D no se resuelve con 2B: cada dormitorio necesita su
propio baño"). No hay marca de "resuelto" en el archivo todavía, pero como ya está aplicado en
profundidad desde ayer, no se reabrieron las 4 imágenes anotadas por completitud — sí se
re-verificaron sus 3 reglas contra las unidades de hoy (ver más abajo, las 3 pasan). No se llamó a
`aliceai.bam.pe` (bloqueo de egreso de la sesión); Tavily no está autorizada en esta sesión
no interactiva, la investigación se hizo con `WebSearch` (dos intentos de `WebFetch` directo a PDFs
oficiales de gob.pe/limacap.org/museos.cultura.pe fueron bloqueados por el proxy de egreso, se usaron
los resúmenes de `WebSearch` que sí alcanzó esas mismas fuentes).

## Qué dice la norma: RNE A.010 Art. 44 — ductos para ventilación

El RNE A.010 (RM N.º 191-2021-VIVIENDA, "Condiciones Generales de Diseño") dedica su Artículo 44 a
los ductos de ventilación técnica cuando un ambiente húmedo no ventila por vano directo:

- **Dimensionamiento**: la sección del ducto se calcula a razón de **0.036 m² por cada inodoro** del
  servicio sanitario que ventila por piso, con un **mínimo absoluto de 0.036 m²** aunque el servicio
  tenga un solo aparato. Es una cifra pequeña (equivalente a un chaflán de ~0.19×0.19 m) pero es la
  base legal exacta que faltaba citar en las tres vueltas anteriores de este tema, que hablaban de
  "ducto IS.010" en abstracto (regla 113, día 28) sin dimensionarlo.
- Cuando el ducto **también aloja montantes** de agua, desagüe o electricidad (no solo aire), su
  sección debe **incrementarse** en función del diámetro de esos montantes — no alcanza con los
  0.036 m²/inodoro si el mismo ducto hace de riser sanitario (conexión directa con la regla 156-158,
  día 40, sobre el muro húmedo previsto para el segundo piso).
- Un ducto de **0.36 m² o más**, si su losa/cielo raso es accesible para personas, necesita un
  sistema de protección contra caídas — un umbral 10× mayor al mínimo de un solo inodoro, relevante
  recién cuando se agrupan varios baños en un troncal común (ver regla 164 abajo).
- En edificaciones de más de 15 m de altura el ducto necesita extracción mecánica por ambiente o
  extracción eólica en el último nivel — no aplica a las viviendas unifamiliares/flats bajos de hoy,
  pero confirma que el ducto pasivo (el que se usa en los 3 ejercicios de hoy) es la solución
  estándar para edificaciones bajas.

## La cocina nunca gana la pugna con el baño hasta hoy: se invierte el reparto del día 28

La regla 113 (día 28) resolvía el conflicto por el único paño de pozo disponible cediéndole la
ventana al baño y mandando la cocina a ducto. Con el Art. 44 ya dimensionado queda claro que esa
decisión estaba al revés: un baño **nunca** necesita ventana bajo el RNE (ventila 100% por ducto sin
excepción, ni siquiera como advertencia [A]), mientras que una cocina sin vano exige resolver una
extracción de mayor caudal (campana + tiro de humos hasta cubierta) — una complicación real que un
baño no tiene. El default debería ser: **la cocina se queda con el vano si hay que elegir, el/los
baño(s) se resuelven 100% por ducto técnico**. Las 3 unidades de hoy aplican este reparto invertido
como ejercicio explícito, y además muestran que ceder la ventana del pozo a un baño no es solo una
concesión: es una LIBERTAD de planta, porque un ambiente 100% ducteado ya no necesita tocar el
perímetro/pozo en absoluto — puede ubicarse en cualquier punto del eje húmedo mientras se mantenga
dentro de los 0.30-0.60 m que exige el `muro_humedo` (CHK-19), acercándose en cambio a la puerta que
sirve (dormitorio o hall) en vez de forzarse contra la fachada.

## Reglas accionables para la distribución en Lima (agregadas a lecciones-distribucion.md)

163. **RNE A.010 Art. 44 — ducto de ventilación técnica para SS.HH.: sección mínima 0.036 m² por
     inodoro servido por piso** (mínimo absoluto 0.036 m² aunque el servicio tenga un solo aparato);
     si el mismo ducto aloja montantes de agua/desagüe/electricidad, incrementar la sección en
     función del diámetro de esos montantes — no alcanza con los 0.036 m²/inodoro. — Fuente: RNE
     A.010 Art. 44 (RM N.º 191-2021-VIVIENDA).
164. **Cuando varios baños comparten el eje húmedo, agrupar sus ductos de ventilación en un TRONCAL
     COMÚN dimensionado por la suma de inodoros servidos** (n×0.036 m²) en vez de N ductos
     individuales — mismo principio de Neufert p. 277 (un solo montante vertical para todos los
     servicios) aplicado ahora a la ventilación, no solo a agua/desagüe. Umbral a vigilar: un ducto
     agrupado que supere 0.36 m² y tenga losa/cielo raso accesible necesita protección anticaída
     (RNE A.010 Art. 44).
165. **Un baño nunca necesita ventana** (el RNE permite 100% ducto para SS.HH. sin excepción, regla
     163), **mientras que una cocina sin ventana sí exige un ducto de mayor caudal** (campana + tiro
     de humos) y compromete el confort real de cocinar: en la disputa por el único vano de
     pozo/fachada disponible entre un baño y una cocina, el default es ceder la ventana a la
     COCINA y resolver el/los baño(s) 100% por ducto técnico — contrario a la regla 113 (día 28),
     que cedía la ventana al baño; se mantiene la regla 113 como técnica válida solo cuando el
     brief prioriza explícitamente el baño (p. ej. un baño accesible que necesite luz natural por
     norma local distinta a la de Lima).
166. **Ceder la ventana del pozo/fachada a un ambiente húmedo no es solo una concesión: es un grado
     de libertad de planta.** Un baño (o cocina) resuelto 100% por ducto técnico ya no necesita
     tocar el perímetro/pozo en absoluto — puede ubicarse en cualquier punto del eje húmedo mientras
     se mantenga dentro de los 0.30-0.60 m que exige CHK-19, acercándose en cambio a la puerta que
     sirve (dormitorio en suite u hall) en vez de forzarse contra la fachada solo para "ganar" un
     vano que ni siquiera necesita.

## Aplicación a las 3 unidades de hoy

Las 3 unidades aplican el reparto invertido (regla 165) y el dimensionamiento del ducto (regla 163)
como ejercicio central del día, además de las reglas obligatorias de siempre (fachada viva, zona
buffer, sala con luz, baños acompañando a los dormitorios, cocina explícita, pozo ≥6 m en una
dimensión, lavandería y terraza siempre) y las correcciones ya vigentes (159/160/162):

- **u01 (1D/1B, fachada única frente ancho, San Miguel-Pueblo Libre/Lima Moderna, 8.85×7.35 m)**:
  baño 1 (en suite, único baño del día por ser 1D — regla 7) linda físicamente con el pozo posterior
  pero **cede el 100% de su vano a la cocina**, que sí se queda con ventana (1.20×1.00 m,
  1.20 m² ≥ 8.96/8 requerido); baño 1 ventila 100% por ducto técnico de 0.036 m² (1 inodoro). Zona
  buffer (vestidor+baño) interpuesta entre el dormitorio principal (frente) y el resto de la casa,
  con enfilade dormitorio→vestidor→baño.
- **u02 (2D/2B, esquina real NORTE+ESTE, Jesús María-Surquillo/Lima Moderna-Top, 12.20×7.35 m)**:
  los **2 baños** (principal y baño 2, que sirve a dormitorio 2 y de visita vía la lavandería sin
  cruzar ningún dormitorio — CHK-18) se resuelven **100% por ducto técnico agrupado** (2 inodoros ×
  0.036 = 0.072 m² en un troncal común, regla 164) — esto libera el 100% de AMBAS fachadas vivas
  (norte + este) para sala, los 2 dormitorios y la terraza, incluida una ventana de esquina real en
  dormitorio 2. Corrige c11 explícitamente: dormitorio principal (10.23 m²) > dormitorio 2
  (9.61 m²), y ningún dormitorio depende de un baño para su propio acceso.
- **u03 (3D/4B, fachada única de frente amplio, segmento alto, La Molina-Surco/Lima Top,
  19.50×10.30 m)**: corrige c12/c13 con **un baño en suite por dormitorio** (regla 162, segmento
  alto) más un baño de visita — 4 baños en total, todos resueltos 100% por ducto técnico agrupado en
  un troncal común de 4×0.036 = 0.144 m² a lo largo del eje húmedo (regla 164), mientras la
  **cocina SÍ conserva su ventana** al pozo posterior (1.40×1.00 m) — el reparto invertido de la
  regla 165 aplicado a la escala más grande del día. Hall de ancho completo (19.25 m, corregido por
  adyacencia real con las 9 piezas del fondo, técnica del día 26/30/38) reparte 3 dormitorios +
  cocina + baño de visita sin cruzar ningún baño.

Advertencia [A] aceptada y justificada: circulación de u03 en 11.76 % (21.17/180.0 m², hall de
ancho completo que reparte 9 piezas del fondo sin ambigüedad de recorrido) — por encima del 10 %
recomendado, mismo razonamiento aceptado desde los días 9/31/38/41 cuando el hall sirve muchas
piezas independientes sin pasillo adicional.

## Proceso y herramientas

No se llamó a `aliceai.bam.pe` (bloqueo de egreso de la sesión, confirmado antes de empezar).
Tavily no está autorizada en esta sesión no interactiva; la investigación se hizo con `WebSearch`,
que alcanzó a resumir el contenido del Art. 44 aunque los `WebFetch` directos a los PDF oficiales
(limacap.org, cdn.www.gob.pe, museos.cultura.pe) fueron bloqueados por el proxy de egreso de este
entorno. Se escribieron 3 herramientas propias en el scratchpad (no versionadas): `gridlib.py` (un
compilador de layouts por filas/columnas que DERIVA `frente_m`/`fondo_m` de las profundidades y
anchos elegidos en vez de fijarlos a priori — garantiza cobertura exacta del envolvente sin
remanentes por construcción, con el inset de medio espesor de muro documentado en SKILL.md Paso 6),
`checks.py` (verificación geométrica real de adyacencia de puertas y de CHK-11 "ventana solo en
fachada/pozo", que `validator.py` no implementa pese a mencionarlas en sus comentarios) y
`render.py` (renderizador SVG+ASCII genérico: detecta la arista compartida real entre ambientes
para dibujar puertas con arco de giro hacia el ambiente servido, y prioriza la adyacencia a un
ambiente "pozo" declarado por sobre un simple toque de perímetro para decidir en qué fachada va cada
ventana — corrigiendo en el camino un bug propio que dibujaba una ventana sobre un medianero en
`u03` porque ese ambiente también tocaba x=0 de refilón). Los 3 JSON pasan `scripts/validator.py`
sin errores; se verificaron visualmente los 3 SVG con Chromium headless antes de exportar — las 3
plantas renderizan sin solapes, con las puertas girando hacia el ambiente servido y las ventanas
correctamente sobre fachada real o sobre el pozo declarado (nunca sobre un medianero).

## Fuentes

- RNE, Norma A.010 "Condiciones Generales de Diseño" (RM N.º 191-2021-VIVIENDA), Art. 44 — ductos
  para ventilación (vía WebSearch, resumen de limacap.org / cdn.www.gob.pe / museos.cultura.pe,
  WebFetch directo bloqueado por el proxy de egreso de este entorno).
- RNE, Norma EM.030 "Instalaciones de Ventilación" (RM N.º 232-2020-VIVIENDA) — contexto normativo
  general de ventilación mecánica/eólica en ductos.
- Corrección directa de Sebastián, día 40 (`correcciones/pendientes.md` c10/c11/c12/c13), ya
  incorporada como reglas 159/160/162 desde el día 41 y re-verificada hoy contra las 3 unidades.
