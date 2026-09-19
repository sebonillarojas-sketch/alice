# Día 29 — Flexibilidad y desjerarquización, tercera vuelta: dormitorios de área equivalente

Tema (5) del currículo, tercera vuelta. Cubierto antes: día 5 (RNE Art. 11 + tabiques removibles no portantes) y día 17 (Open Building/Habraken soporte-infill + puerta corrediza de vano ancho). Ángulo de hoy, genuinamente nuevo frente a esas dos vueltas: **dormitorios de área equivalente** (sin la jerarquía por defecto "principal grande / secundario mínimo"), reforzado con mobiliario/tabique corredizo como segunda capa de desjerarquización y la cocina central-visible como contraparte.

## Investigación

- [designboom, "what if housing was designed around changing relationships rather than nuclear families?"](https://www.designboom.com/architecture/housing-designed-around-changing-relationships-nuclear-families/): resume la investigación **"Housing Standardisation: The Architecture of Regulations and Design Standards"** (Lucia Alonso Aranda y Sam Jacoby, Royal College of Art, financiada por el UK AHRC), que rastrea cómo los estándares de vivienda ingleses de mediados del siglo XX consolidaron plantas organizadas alrededor de "padres + hijos" — con habitaciones y relaciones espaciales de tamaño ya predefinido por la norma. Su contrapropuesta: dormitorios de **tamaño igual, sin ensuite diferenciador**, más una cocina central y visible que habilita el trabajo doméstico compartido, para hogares cuyas relaciones cambian más rápido que el edificio (separaciones, amigos que crían juntos, adultos mayores que se mudan con la familia).
- [ScienceDirect, "Housing flexibility problem: Review of recent limitations and solutions"](https://www.sciencedirect.com/science/article/pii/S2095263517300742): confirma que la **adaptabilidad espacial es una herramienta para reemplazar la jerarquía espacial** y mejorar la calidad de vida en vivienda flexible — la vivienda convencional asume que las relaciones entre piezas y sus ocupantes permanecen estables, lo cual rara vez es cierto.
- [Dezeen, "Design Eight Five Two use sliding furniture to create flexible Hong Kong apartment"](https://www.dezeen.com/2017/01/30/design-eight-five-two-sliding-furniture-partitions-hong-kong-apartment-architecture/): ejemplo real de **mobiliario corredizo como partición** (no un tabique) que reconfigura ambientes sin obra — mismo principio detrás del lanzamiento de la línea de muebles móviles IKEA Rognan en Hong Kong y Japón (2020) para vivienda compacta.

`WebFetch` directo a designboom.com, sciencedirect.com y dezeen.com fue bloqueado por el proxy de egreso de la sesión (mismo patrón que días 19-21); se usaron los resúmenes que trajo `WebSearch` (que sí llegó a esas fuentes) como base citable — consistente con la práctica ya establecida en este log.

## Reglas accionables para la distribución en Lima (114-116, agregadas también a `lecciones-distribucion.md`)

114. **Dormitorio principal y secundario(s) con área lo más cercana posible entre sí (idéntica cuando el parti lo permite)** — la jerarquía se marca SOLO por el baño (principal en suite), nunca por el tamaño de la pieza. Fuente: designboom / Housing Standardisation; ScienceDirect.
115. **Mobiliario o tabique corredizo como segunda capa de desjerarquización**, más allá del tabique removible ya cubierto el día 5 — closet/estante corredizo empotrado en un muro no portante, útil cuando el reglamento de propiedad horizontal no permite tocar muros. Fuente: Dezeen (Design Eight Five Two); IKEA Rognan.
116. **La cocina central y visible (apertura ancha ≥1.20 m sin hoja hacia la sala) es la contraparte de los dormitorios sin jerarquía** — reafirma la regla 8 (cocina explícita) y la regla 102 (cocina abierta ≥5 m² sin depósito) como decisión de desjerarquización, no solo de programa. Fuente: síntesis designboom / Housing Standardisation.

## Nota sobre `pendientes.md`

`correcciones/pendientes.md` sigue igual que desde el día 25 (c5-c9, ya aplicadas en las reglas 102-105) — sin corrección nueva del puente que leer hoy. Se re-revisaron las imágenes `c5.png` y `c8.png` por completitud (los errores que muestran —depósito en vez de cocina, un solo baño para tres dormitorios— ya están resueltos desde el día 26).

## Las 3 unidades de hoy

### u01 — 1D/1B amplio, fachada única frente ancho — Magdalena del Mar, Lima Moderna (7.60×6.20 m, 40.81 m²)

Banda frontal (sala-comedor + dormitorio principal + terraza, las tres tocando la fachada) sobre banda posterior (vestidor → baño en suite, cocina abierta con lavadero integrado). **Ángulo de hoy aplicado**: la cocina (10.10 m², regla 116) se conecta a la sala por una apertura ancha de 1.20 m sin hoja — visible desde el ingreso, no escondida detrás de un pasillo de servicio. Enfilade dormitorio→vestidor→baño (zona buffer, regla 6).

Autocrítica (checklist-validacion.md): CHK-01 a CHK-22 pasan sin bloqueantes (`scripts/validator.py` limpio). Advertencias [A] aceptadas: CHK-06 baño 1 en ratio 2.32:1 (bajo el máximo 2.4, sin margen adicional por compartir columna con el vestidor); CHK-23 el paño posterior de dormitorio principal (3.45 m) y el lateral de sala-comedor (3.15 m) se resuelven con clóset empotrado y sofá+estantería de la librería de mobiliario, respectivamente — ninguno queda muerto.

### u02 — 2D/2B esquina real, dormitorios equivalentes — Barranco, Lima Moderna (8.20×9.65 m, 70.26 m²)

Lote de esquina (dos fachadas vivas, calle norte y calle este). Sala-comedor en el vértice (toca ambas calles). **Ángulo de hoy aplicado explícitamente**: dormitorio principal y dormitorio 2 tienen área **idéntica** (9.68 m² cada uno) — cada uno con su propia fachada, mismo ancho de columna (3.025 m) y misma profundidad (3.20 m). La única diferencia es que el principal tiene baño en suite (bañoP + hall, regla 7); dormitorio 2 usa baño 2 (doble acceso: privado desde el dormitorio + público desde el hall, regla 92). Núcleo húmedo en un solo eje vertical (x=3.30, regla 110/111): bañoP, baño 2 y cocina flush contra la misma pared. Terraza en la fachada del oeste, continuando la sala (regla 90).

Autocrítica: CHK-01 a CHK-22 sin bloqueantes. Advertencias [A] aceptadas y justificadas: (1) sala-comedor en 14.07 m² — bajo el óptimo de 16 m² para 2D/3D del checklist (aunque bien sobre el mínimo mecánico de 10.5 m²) porque se priorizó igualar el ancho de columna de los dos dormitorios (tema de hoy) sobre maximizar la profundidad de la sala; (2) cocina en 22.44 m² (~32% del área techada, sobre el 12-14% de proporción recomendado en tipologias-lima.md §7) — con lavadero integrado (regla 102), aceptable en el segmento Lima Moderna-alto pero generosa; se documenta como gran-room abierto, no como error; (3) el dormitorio principal no lleva vestidor propio (accede directo a bañoP) — el colchón vestidor+baño de la regla 6 se demuestra en cambio en u01, donde el ancho de columna alcanzaba.

### u03 — 3D/2B esquina real, dormitorios secundarios equivalentes — La Molina, Lima Top (7.40×13.25 m, 87.42 m²)

Lote de esquina profundo. Dormitorio principal y dormitorio 2 tocan la fachada norte (calle); sala-comedor toca la fachada oeste (calle) y se extiende en profundidad; terraza + pasillo interior + dormitorio 3 + cocina ocupan la banda posterior. **Ángulo de hoy aplicado explícitamente**: dormitorio 2 y dormitorio 3 (los dos secundarios) tienen área **idéntica** (11.59 m² cada uno) — ningún hijo/adulto tiene la pieza "chica". El pasillo interior (3.90 m², adyacente a sala y a dormitorio 3 por solape real de arista, no solo por el grafo JSON — regla 104) evita que dormitorio 3 dependa solo de la terraza para su acceso, la corrección exacta de c9 del día 25. Núcleo húmedo en un solo eje vertical contra el medianero derecho (bañoP, baño 2, lavandería y cocina, los cuatro flush contra x=7.40).

Autocrítica: CHK-01 a CHK-22 sin bloqueantes; circulación (pasillo) en 4.46% del área techada, cómodamente bajo el 10%. Advertencia [A] aceptada: igual que en u02, el dormitorio principal no lleva vestidor propio (accede directo a bañoP) — mismo trade-off, mismo motivo (ancho de columna dedicado a mantener la equivalencia de área entre los dos dormitorios secundarios en vez de sumar una pieza más al núcleo húmedo).

## Proceso de dibujo

Los 3 layouts se generaron con un compilador propio (`gen2.py`, scratchpad) que deriva `muros` automáticamente de una grilla de rectángulos (agrupa caras enfrentadas a 0.15 m en un eje de muro, fusionando solo los tramos de eje realmente contiguos). Un primer intento fusionaba tramos NO contiguos del mismo eje x/y separados por un hueco (p. ej. un eje que solo tiene pared arriba y abajo de una sala, no en el medio) en un único segmento que atravesaba visualmente el ambiente — corregido para fusionar solo intervalos contiguos antes de exportar.

El renderizador SVG propio (`svggen.py`, scratchpad) calcula el arco de giro de cada puerta por bisagra + producto cruzado (determina el sentido de barrido hacia el ambiente `a`), y trata las aperturas anchas (mampara a terraza, apertura a cocina, ≥1.20 m) como umbral simple sin arco de giro — no corresponde el símbolo de puerta batiente a una corredera. Verificando con `cairosvg` (SVG→PNG) antes de exportar se corrigió un error real: el arco de la puerta corrediza sala→terraza de u02 tenía radio 1.60 m (el ancho de la puerta) mayor que la profundidad real de la terraza (1.25 m), sobresaliendo del ambiente — resuelto al excluir del arco toda apertura ≥1.20 m. Las 3 plantas finales no presentan solapes, ventanas sobre medianero, ni puertas fantasma (toda adyacencia de puerta se verificó a mano por solape de arista real, regla 104).

## Vista ASCII (proporciones aproximadas)

**u01 — 1D/1B, Magdalena del Mar (7.60×6.20 m)**
```
+------------------+------------------+----------+
| dormitorio       | sala-comedor     | terraza  |
| principal        |                  |          |
| 10.00 m²         | 10.87 m²         | 3.45 m²  |
|                  |                  |          |
+--------+---------+---------+--------+----------+
|vestidor| baño 1  |                             |
|2.75 m² | 3.62 m² |     cocina — 10.10 m²       |
|        |         |  (lavadero integrado, visible desde la sala) |
+--------+---------+-----------------------------+
```

**u02 — 2D/2B esquina, Barranco (8.20×9.65 m)**
```
+------------------+----------+------------------+
| dormitorio       | baño     | dormitorio 2     |
| principal        | principal| (área IDÉNTICA   |
| 9.68 m²          | 2.48 m²  |  a la principal) |
|                  +----------+ 9.68 m²          |
|                  | baño 2   |                  |
|                  | 2.40 m²  |                  |
+------------------+----------+------------------+
|                  |                              |
| sala-comedor     |         hall (5.73 m²)       |
| 14.07 m²         +------------------------------+
|                  |                              |
|                  |        cocina — 22.44 m²      |
+------------------+       (lavadero integrado)    |
| terraza 3.78 m²  |                              |
+------------------+------------------------------+
```

**u03 — 3D/2B esquina, La Molina (7.40×13.25 m)**
```
+------------------+------------------+
| dormitorio 2     | dormitorio       |
| (área IDÉNTICA   | principal        |
|  a dorm. 3)      | 15.01 m²         |
| 11.59 m²         |                  |
+------------------+--------+---------+
|                  | baño principal   |
|  sala-comedor    | 3.06 m²          |
|  19.88 m²        +------------------+
|                  | baño 2  3.06 m²  |
+--------+---------+------------------+
|terraza |  pasillo | lavandería      |
|2.28 m² |  3.90 m² | 2.04 m²         |
+--------+---------+------------------+
| dormitorio 3     | cocina           |
| (= dorm. 2)      | 15.01 m²         |
| 11.59 m²         | (lavadero integr.)|
+------------------+------------------+
```
