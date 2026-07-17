# Análisis: `generateUnitPlan.worker-l3uP7vKh.js` (bundle minificado)

_Análisis de ingeniería inversa "read-only" de un Web Worker minificado de una app comercial
de diseño arquitectónico paramétrico. Objetivo: entender su arquitectura y algoritmos para
informar el motor propio de ALICE (`files/alice/src/modules/planos` + `cabida`).
No se copia código ni assets del bundle._

---

## 1. Qué es

- **Web Worker** empaquetado con Vite (sufijo hash `l3uP7vKh`), instrumentado con **Sentry**
  (release `4e3bfca8fd64d02bb34976bbbe50054b12906297`).
- Expone **una sola función** vía **Comlink** (RPC main-thread ↔ worker):

  ```js
  expose({ generateUnitPlanFromDraft })
  ```

- Dominio: generación de **planos de unidad** (departamentos) dentro de una **story** (piso)
  de un edificio. Terminología del modelo: `story / unit / space / wall / wallSegment /
  divider / transition (puertas) / windowInstance / planObjectInstance / planTemplate /
  spaceType / GIA boundary`. Unidades en **milímetros**, puntos 3D `[x, y, z]` con z =
  elevación del piso. Polígonos con winding **CW = sólido, CCW = hueco**.
- El vocabulario (story/unit/space, GIA = Gross Internal Area, stats de "narrowest passage"
  e "inscribed circle") apunta a una herramienta de estudios de cabida / generative design
  residencial (estilo Finch/Archilogic). Es exactamente el mismo problema que la pestaña
  **Cabida** de Growth en ALICE.

## 2. Librerías embebidas en el bundle

| Librería | Rol en el worker |
|---|---|
| **Comlink** | Exponer la API del worker como promesas en el main thread |
| **lodash** (build "4.18.1", fork/custom) | utilidades |
| **js-angusj-clipper** (Clipper WASM + fallback asm.js embebido en base64) | offset/boolean de polígonos de alta robustez (cargado pero el grueso del boolean usa la lib siguiente) |
| **polygon-clipping** (algoritmo Martinez + splaytree) | `union / intersection / difference / xor` de multipolígonos |
| **polylabel** (pole of inaccessibility) | posición de etiquetas y círculo inscrito máximo |
| **earcut** | triangulación de polígonos con huecos → meshes |
| **rbush** (R-tree) | índice espacial de vértices/aristas del edge graph |
| **robust-predicates** (`orient2d`) | orientación numéricamente exacta |
| **immer** | snapshots inmutables (stats) |
| **fnv-plus + safe-stable-stringify** | hash FNV-1a estable por entidad (change detection) |
| **serialize-error / clase `ExtraError`** | errores con `extra` + `cause` encadenado, para Sentry |
| **@sentry/core** (scope mínimo) | captura de excepciones dentro del worker |

Lección de arquitectura: **todo el motor geométrico vive en un worker** y el main thread
solo intercambia datos serializables. Nada de DOM; los meshes/polígonos vuelven listos
para render.

## 3. Modelo de datos

### 3.1 Edge graph (grafo de aristas)

Estructura central: `{ vertices: (Point3|undefined)[], edges: ([vi, vj]|undefined)[] }`
con borrado por `undefined` (índices estables). Sobre él:

- Inserción de segmentos con **partición automática en intersecciones** (split de aristas
  existentes y del segmento nuevo, snap de extremos a vértices/aristas cercanos, tolerancia
  1 mm).
- **Merge de vértices casi coincidentes** y split de aristas atravesadas por vértices
  (`deduplicate`), con preferencia por coordenadas enteras al fusionar.
- **Validación** post-mutación (ningún vértice a <1 mm de otro vértice/arista ajena) —
  lanzan `ExtraError` con todo el contexto si el grafo queda inválido.
- **Índice R-tree** de vértices y aristas para todas las consultas de proximidad.
- **Extracción de ciclos mínimos** (caras planares): se recorren aristas dirigidas no
  visitadas eligiendo en cada vértice la siguiente arista por **ángulo mínimo CCW**
  respecto a la entrante; los ciclos CW son contornos y los CCW huecos; luego se agrupan
  por contención (área + point-in-polygon) → polígonos con huecos.

### 3.2 Wall guides (guías de muro)

`{ edgeGraph, guides: { [edgeIndex]: { source, geometry } } }` — cada arista del grafo
lleva metadata:

- `geometry.type`: `simple` (muro interior, con `width`), `outer` (muro perimetral),
  `bounds` (límite de la unidad), `connector` (conector auxiliar interior→perímetro),
  `none` (separador de ambientes **sin** muro → "dividers").
- `source`: `story-plan` | `unit-plan` — de qué nivel de edición proviene la arista.

Es la representación editable: el usuario dibuja ejes de muro; los muros con espesor,
espacios, puertas y ventanas se **derivan** de las guías.

### 3.3 Catálogos de puertas y ventanas

Definiciones data-driven embebidas:

- **Puertas**: swing, closet, pocket, open (vano), doubleSwing, bifold, bypass, revolving,
  más variantes de ancho fijo 600/700/800/900/1000 mm. Cada una: `isFlippable`,
  `isRotatable`, `isScalable`, `width`, `drawings` (polilíneas + curvas Bézier del símbolo
  2D, ancladas a `center|frontSide|backSide`) y `bounds` (zonas de barrido para validar
  colocación).
- **Ventanas**: `standard` 900×1200, con dibujo en planta y `facadeDrawings` (alzado),
  altura de alféizar por defecto **900 mm**.

### 3.4 Plan template

El "draft" referencia un `planTemplate` con `subContainers` (contenedores de espacio con
`bounds`, `spaceTypeId`, `tagIds`), `transitions` (puertas), `windows`, `planObjects` y sus
propias wall guides. A cada subContainer se le calcula un `referencePoint` interior
(punto-en-polígono robusto) para el matching espacial.

## 4. Pipeline de `generateUnitPlanFromDraft(unitDraft, existingResources, ctx, …)`

Entrada clave: `unitDraft = { id, storyId, polygon, boundsWallGuideSegments, wallGuides,
story: { globalTransform, height, interiorPolygon }, planTemplateId }` y
`ctx = { planAttachmentTransform, plan (template), spaceTypes }`.

1. **Transformación a espacio local**: compone `planAttachmentTransform × story.globalTransform`
   (matrices 4×4, con manejo de espejado: si `det < 0` se invierte el winding y el flip de
   puertas), y lleva polígono de unidad + segmentos de bounds al espacio del template.
   Precisión de redondeo: 10 decimales.
2. **Construcción de wall guides de la unidad** (`buildUnitWallGuides`):
   - Parte de las guías del template, las **snapea** al polígono de la unidad, las recorta
     (crop) contra él y les asigna ancho default a las que no lo tienen.
   - Deriva guías `bounds` de los linderos de la unidad: cada segmento del bounds se
     intersecta con el polígono y se subdivide en los puntos de cruce; solo se conservan
     los tramos cuyo punto medio cae dentro de la unidad y no se solapan con guías
     existentes.
   - **Conecta las guías interiores al perímetro**: para cada vértice interior que toca el
     polígono de bounds busca el punto más cercano sobre guías con espesor y agrega aristas
     `connector` (partiendo aristas en los cruces). Marca todo con `source: 'unit'` y
     fusiona con las guías de bounds.
3. **Espacios** (generador, memoizado por hash FNV del input):
   - Filtra separadores (`none` de origen unit) → aristas que dividen ambientes sin muro.
   - Extrae **áreas cerradas** = ciclos del grafo cuyo punto representativo cae dentro del
     polígono de la unidad.
   - Por área cerrada calcula el **inner boundary**: offset hacia adentro **por-arista**
     (media anchura si `simple`, anchura completa si `outer`, 0 si `bounds`), resolviendo
     esquinas por **intersección de rectas offset (miter)** con tope de distancia
     (1000 mm) y fallback a dos puntos si el miter explota; los huecos se restan con
     boolean ops; el resultado se limpia (dedupe, colineales, "jagged sides" con umbral
     ~90% del muro más angosto). Descarta restos < 10 000 mm² (0.01 m²).
   - Vuelve a partir cada inner boundary por los separadores (nuevo edge graph efímero +
     extracción de ciclos) → un **space** por ambiente.
   - Cada space: `labelPosition` (punto interior tipo polylabel, memoizado), `polygon`,
     `mesh` (extrusión a `storyHeight − 500` mm), `boundsWallGuideSegments`,
     `boundaryEdgeIndices`, y matching contra `subContainers` del template por contención
     del label point → hereda `spaceTypeId` y `tagIds`.
4. **Muros** (`walls`):
   - `unitPolygon − ⋃(spacePolygons)` = masa de muros. Antes del boolean, los vértices de
     los spaces que tocan el contorno de la unidad se **empujan 5 mm hacia afuera** para
     evitar slivers degenerados (truco anti-epsilon).
   - Se restan los **cutouts de puertas y ventanas**: rectángulo de `ancho_de_hoja ×
     (espesor_de_guía + 2 mm)` centrado en la ubicación, orientado con la dirección del
     elemento (la puerta se re-proyecta sobre el eje de su guía antes).
   - Cada polígono resultante se extruye (earcut, tapa+fondo+laterales, winding corregido)
     a `storyHeight − 500`.
5. **Wall segments** (`wallSegments`): por cada arista `simple` de las guías genera el
   rectángulo del muro (ancho de guía, default 120 mm), lo intersecta con la unidad y lo
   extruye. Conserva `edgeIndexInPlanTemplate` → es la unidad de selección/edición.
6. **Dividers**: aristas `none` de origen distinto a `story-plan` → separadores visibles.
7. **Transitions (puertas)**: resuelve el **attachment** de cada puerta con prioridad:
   1) muro exterior (interiorPolygon de la story, espesor = outerWallWidth),
   2) `boundsWallGuideSegments` con espesor (attachment `parentWall`, offset por caras),
   3) segmentos del polígono de bounds, 4) arista de wall guide a ≤10 mm (descarta puertas
   de guía fuera de la unidad). Calcula 3 transforms 4×4 (`frontSide/backSide/center`):
   espejo si `isFlipped`, rotación al `direction`, traslación a `location` ± offset de cara
   (media anchura del muro). Determina `facing` (inwards/outwards) con el perpendicular
   del segmento vs `direction`.
8. **Ventanas**: igual, con transform `center` (planta, escala de ancho) y `facade`
   (alzado: rotación −90°, alféizar 900 mm, escala de alto).
9. **Vuelta a espacio global + estabilidad**:
   - Transforma todo el plan al espacio global e invierte flips donde corresponde.
   - **Matching de IDs** contra `existingResources`: por `planContainerId`, si no por
     **igualdad de polígono** (tolerancia 1 mm, invariante a rotación de índices y sentido),
     si no por **máximo solape** (`área_intersección − área_diferencia`). Los nuevos
     reciben `unitId-N` secuencial. Esto es lo que evita que regenerar el plano "baraje"
     los ambientes.
   - **Stats por space** (con immer para snapshot): área en m² (mm²/1e6), **círculo
     inscrito máximo** (polylabel con `.distance`), y **pasaje más angosto**: para cada
     vértice, distancia perpendicular a cada segmento no adyacente; ignora anchos
     < 300 mm; candidato válido si `0.5·ancho / ancho_opuesto < 1.05`; caso especial
     rectángulo (línea media). Si falla el cálculo → `captureException` a Sentry con stats
     vacíos, **no** rompe la generación.
   - Join de spaces con unit/spaceType/planContainer y **hash FNV-1a** por entidad
     (stringify estable sin `id/hash`) para diffing barato en el main thread.

## 5. Constantes y tolerancias (calibración de un motor en producción)

| Constante | Valor | Uso |
|---|---|---|
| Ancho de muro default | **120 mm** | guías `simple` sin width |
| Altura de extrusión | `storyHeight − 500 mm` | muros/spaces (deja la losa) |
| Epsilon geométrico | 0.01 mm | dedupe de puntos, colineales |
| Tolerancia edge graph | 1 mm | snap/merge/validación |
| Precisión de transform | 10 decimales | redondeo post-matriz |
| Snap de puertas a guía | 10 mm | resolución de attachment |
| Miter máximo | 1000 mm | offset por-arista de boundaries |
| Empuje anti-sliver | 5 mm | vértices de space sobre el contorno |
| Área mínima de space | 10 000 mm² | descarta restos del offset |
| Pasaje: ancho ignorable | 300 mm / ratio 1.05 | stats de pasillo angosto |
| Alféizar default | 900 mm | ventanas |

## 6. Qué aplicarle a ALICE (planos/cabida)

El worker resuelve, con más blindaje, exactamente los problemas que ya golpearon a
`modules/planos/geometry.js` (el fix del 16-jul de vértices colineales en `offsetEdges`):

1. **Sanitizar antes de operar, no parchear el offset**: pipeline fijo de
   `dedupe → quitar colineales (ε 0.01 mm) → redondear` en cada entrada y cada salida de
   boolean/offset. El fix de `cad.js` (simplificar al importar) va en esa dirección;
   conviene aplicarlo también a la salida de `offsetEdges`/`clipConvex`.
2. **Miter con tope + fallback**: en offsets por-arista, si la intersección de rectas
   offset queda a más de ~1 m del vértice (ángulos casi colineales), usar los **dos**
   puntos de arranque de las rectas offset en vez de abortar. Generaliza el fix de
   colineales a ángulos casi-planos.
3. **Boolean ops de verdad**: para `unidad − espacios`, huecos y recortes de
   puertas/ventanas, usar `polygon-clipping` (martinez, ~10 KB) en lugar de clipping
   convexo propio — `clipConvex` limita a lotes convexos y la cabida real ya usa lotes CAD
   arbitrarios.
4. **Polylabel** para etiquetas y para el **círculo inscrito** (métrica útil de calidad de
   ambiente en cabida); el detector de "pasaje angosto" es barato y da un check automático
   de pasillos < mínimo normativo.
5. **IDs estables por solape** al regenerar distribuciones: matching
   `intersección − diferencia` contra la corrida anterior para que la UI no pierda
   selección/overrides al recalcular partis.
6. **Worker + Comlink**: cuando el editor de planos crezca, mover el motor a un worker con
   una API de una función y hash por entidad para re-render selectivo.
7. **Errores con contexto**: patrón `ExtraError` (payload completo de la geometría que
   falló) → los bugs de geometría se reproducen del reporte, sin adivinar.

## 7. Advertencia de uso

Este documento describe **arquitectura y algoritmos** observados en un bundle público
minificado, con fines de interoperabilidad y aprendizaje. No copiar al ERP el código,
los catálogos de puertas/ventanas ni los dibujos embebidos del bundle: implementar las
ideas sobre las librerías open-source citadas (polygon-clipping, polylabel, earcut, rbush),
que son las mismas que usa el worker.
