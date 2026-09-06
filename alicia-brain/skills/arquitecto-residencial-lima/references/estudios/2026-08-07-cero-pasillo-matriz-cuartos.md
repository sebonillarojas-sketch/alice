# Día 3 — 2026-08-07 (segunda sesión) — Cero-pasillo y matriz de cuartos

## Qué estudié

Tema 3 del currículo: cómo eliminar circulación muerta (pasillos, halls sobredimensionados) usando la **matriz de adyacencia** como herramienta previa al parti, en vez de dibujar habitaciones y descubrir después que hace falta un pasillo para conectarlas.

- **La "corridor tax"** (Lorenzo Centioni, Centioni Architects, video "I Designed This 2-Bed Apartment With ZERO Corridors", mar. 2026): en un flat de 2 dormitorios, el pasillo que solo sirve para caminar de la sala a los dormitorios puede costar 1.5–2.5 m² de área techada que no genera ningún metro habitable — el equivalente a un walk-in closet completo. Su método: identificar qué puertas necesitan estar "a mano" desde la sala-comedor y cuáles pueden colgar directamente de un dormitorio o de un hall mínimo compartido, en vez de alinear todas las puertas sobre un corredor continuo.
- **"The death of the hallway"** (John Burns Research and Consulting / New Home Trends Institute, encuesta de diseño residencial de EE.UU. 2024, jbrec.com): la táctica dominante en plantas nuevas no es achicar cuartos para bajar el área total, sino **eliminar circulación no funcional** ("Tetris-ing the functional rooms together") — encajar los ambientes entre sí de modo que las paredes compartidas hagan de límite y el paso de un ambiente a otro sea directo. Advertencia práctica: al bajar tabiques de circulación, el aislamiento acústico se resuelve con la posición de los cuartos (un clóset entre dos dormitorios que compartirían pared) en vez de con muro adicional — aplica directo al muro húmedo del Paso 3 del skill.
- **Matriz de adyacencia / diagrama de burbujas** (biblus.accasoftware.com; vantagespace.com "adjacency matrix"; slideshare "Diagramación Arquitectónica", Arq. Luis A. Soto Santizo): metodología de programación arquitectónica en 3 pasos antes de dibujar un solo muro:
  1. **Matriz de relaciones ponderadas**: tabla ambiente × ambiente, cada celda puntuada como "debe estar junto a" / "cerca" / "aceptable" / "separado" (no una escala binaria conectado/no-conectado).
  2. **Diagrama de burbujas**: las burbujas con relación "debe estar junto a" se dibujan a TOQUE (contacto directo, comparten pared con puerta o vano ancho); las de "separado" se alejan a propósito.
  3. Recién ahí se pasa a bloques proporcionados (rectángulo real del ambiente) preservando esa topología — la burbuja envuelve al bloque, no al revés.
  El error que este método previene: dibujar primero la forma bonita del lote y descubrir después que dos ambientes que debían tocarse quedaron separados por un tercero, obligando a insertar un pasillo de rescate.
- **Bridger AAD ("Streamlining Circulation")**: cuando un pasillo es inevitable (3D profundos, lote de fachada única con crujía > 6 m), la corrección de mercado es hacerlo multifuncional — closet lineal a lo largo (300–350 mm de profundidad no restan ancho de paso) en vez de agrandarlo o dejarlo ciego; nunca agrandar el pasillo "por si acaso".

## Ideas clave para la distribución en Lima

1. La matriz de adyacencia se construye ANTES del Paso 2 (zonificación) del skill: fija qué ambientes van a toque (sala-cocina, dormitorio principal-baño en suite, sala-terraza) y cuáles se alejan (dormitorio-cocina, baño-sala) antes de trazar el parti, no después.
2. "Cero pasillo" no es dogma — es la consecuencia de una matriz bien resuelta: si la sala-comedor puede ser el distribuidor directo de todas las puertas del bloque íntimo (2D con máximo 3 puertas alrededor de la sala), no hace falta pasillo. Pasa a ser inevitable recién con 3+ piezas del bloque de noche que no caben alrededor de un mismo perímetro de sala (coincide con el Paso 4 del skill: hall solo si 3+ puertas).
3. Cuando el pasillo es inevitable, tratarlo como ambiente productivo: clóset lineal empotrado a lo largo de un lado, nunca muro ciego desnudo — conecta directo con la regla dura de Sebastián de no dejar tramos > 3 m sin amoblar.
4. El "buffer acústico" de la lección del Día 2 (baño + vestidor entre sala y dormitorio principal) es un caso particular de matriz de adyacencia con relación "separado" resuelta con un ambiente intermedio en vez de con más muro — mismo principio, aplicado a ruido en vez de a circulación.

## Reglas accionables para la distribución en Lima

1. Antes de dibujar el parti, construir la matriz ambiente×ambiente con 4 niveles (junto/cerca/aceptable/separado); todo par "junto" debe terminar a toque (pared compartida con vano o puerta ancha) en el JSON final — verificable revisando que `puertas` conecte ese par directamente. — Fuente: biblus.accasoftware.com; vantagespace.com/adjacency-matrix.
2. Pasillo solo se justifica cuando el bloque íntimo tiene 3+ piezas que no caben alrededor del perímetro de la sala-comedor (cero-pasillo es el default, no la excepción) — si aparece, dimensionarlo al mínimo normativo (0.90 m) y forrarlo con clóset lineal (300–350 mm) en vez de ensancharlo. — Fuente: Centioni Architects (corridor tax); Bridger AAD; RNE A.020 Art. 13.
3. Resolver el aislamiento acústico entre dormitorio y zona social con POSICIÓN de ambientes (clóset o baño intermedio) antes que con muro adicional — coherente con la regla de zona buffer del Día 2 y con la tendencia de mercado de reducir tabiquería interior. — Fuente: JBREC/NHTI "death of the hallway" 2024.
4. Validar la matriz de adyacencia contra el muro húmedo del Paso 3 ANTES de fijar el parti: si cocina y baño principal quedan como "junto" en la matriz pero el muro húmedo los ubica en ejes opuestos, hay que resolver el conflicto ahí, no forzarlo después con más pasillo. — Fuente: síntesis SKILL.md Paso 3 + Paso 4.

Estas 4 reglas se agregan a `lecciones-distribucion.md`.
