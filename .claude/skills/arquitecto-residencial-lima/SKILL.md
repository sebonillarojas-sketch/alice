---
name: arquitecto-residencial-lima
description: Diseña y genera plantas residenciales (flats y departamentos) para Lima, Perú — del brief al layout JSON validado contra RNE, Neufert y el mercado limeño. Usar siempre que se pida diseñar, generar, dimensionar o corregir una planta, plano o distribución de vivienda en Lima.
---

# Arquitecto residencial Lima

Metodología para producir la planta de una vivienda limeña como layout JSON estricto, correcto por norma (RNE) y por antropometría (Neufert), y competitivo por mercado (Nexo Inmobiliario).

Antes de diseñar, leé las referencias de este skill:
- `references/rne.md` — norma vigente (A.010/A.020/A.120/A.130) con artículos citados. Ojo: el "1/8 de iluminación" es criterio de proyecto; el piso normativo vigente es 10% (RNE A.020 Art. 12.4).
- `references/neufert.md` — dimensiones antropométricas con página citada.
- `references/tipologias-lima.md` — estadística de 6,686 tipologías reales + 12 ejemplares JSON (T01–T12).
- `references/checklist-validacion.md` — las reglas mecánicas que el layout DEBE pasar antes de entregarse.

Unidades: metros y m². Origen de coordenadas en la esquina superior-izquierda del lote proyectado; x = frente, y = fondo.

## Paso 1 — Brief → programa

Extraé del brief: dormitorios, baños, área objetivo, tipo de fachada (única / esquina / pozo), segmento y distrito. Lo NO especificado se completa con la estadística de mercado (tipologias-lima.md §1–§6):

- Sin programa: **2D/2B** (34.7% del mercado, el combo dominante).
- Baños por dormitorios: 1D→1B, 2D→2B, 3D→2B (estándar) o 3B solo si el área objetivo ≥ 84 m² (Lima Top).
- Área objetivo si falta (mediana flat): 1D ≈ 41 m² (compacto de inversión ≈ 33), 2D ≈ 58, 3D/2B ≈ 71–74, 3D/3B ≈ 90. Mantenete dentro del rango competitivo p25–p75 de §6.
- Distrito: Lima Moderna define el estándar compacto; Lima Top corre ~10–16 m² arriba en 2D/3D.
- Programa de ambientes: sala-comedor, cocina (kitchenette integrada admisible solo en 1D), dormitorio principal + secundarios, baños, lavandería (puede alojarse en cocina ≥ 5 m²), hall/pasillo solo si el parti lo exige, terraza según segmento.
- Aforo de referencia: 1D = 2 pers., 2D = 3, 3D = 4 (RNE A.020 Art. 7) — dimensioná comedor y clósets para ese número.

## Paso 2 — Zonificación día/noche y parti

Tres zonas siempre: **social** (sala-comedor, terraza), **íntima** (dormitorios), **servicio** (cocina, baños, lavandería); la entrada es el cuarto elemento (Neufert p. 294). Estar y dormir al lado asoleado; servicios al lado sombrío — en Lima el lado frío es el SUR (Neufert p. 272, adaptado a hemisferio sur); dormitorios idealmente al este (sol de mañana, Neufert p. 274).

Elegí el parti por las fachadas disponibles y la **crujía máxima iluminable ≈ 5.5–6.5 m de fondo desde la ventana** (~2.2× la altura libre; los ejemplares de fachada única T03/T04 tienen fondos de 5.55–5.80 m):

- **Fachada única, frente ancho**: banda iluminada al frente (sala central flanqueada por dormitorios), banda húmeda al fondo (T03, T04). El parti más eficiente del mercado.
- **Fachada única, lote profundo**: peine o social al frente + dormitorios a patio/pozo posterior, núcleo húmedo central (T07, T09). Pozo de luz: mínimo 2.00 m a dormitorio/sala y 1.80 m a cocina en unifamiliar; 2.10 m absoluto en multifamiliar (RNE A.020 Art. 11.4).
- **Esquina**: social en el vértice, barra íntima al fondo, banda húmeda lateral (T05, T08, T10, T11). Permite 3D sin pasillo.

Ningún habitable puede quedar sin frente a fachada o pozo (checklist CHK-10/CHK-11).

## Paso 3 — Posición del muro húmedo

Antes de dibujar ambientes, fijá el **muro húmedo**: un solo eje (horizontal o vertical) al que se apilan cocina + baños + lavandería, contiguos o espalda con espalda. Criterio económico: todos los servicios en UN ducto/montante vertical, superponible piso a piso (Neufert p. 277); WC a máx. 1.00 m de la bajante (Neufert p. 57); dos baños espalda a espalda comparten muro instalado (Neufert p. 263); montantes en ductos exclusivos o muros divisorios (RNE A.020 Art. 23.3). En multifamiliar el núcleo húmedo va al lado interior menos iluminado, liberando la fachada para social y dormitorios (Neufert p. 292–294).

Patrones probados: banda húmeda posterior corrida (T03/T04), eje vertical lateral (T05/T08/T10), núcleo central con ducto (T09/T11). El segmento elegido se emite como `muro_humedo` en el JSON y el checklist lo verifica (CHK-19).

## Paso 4 — Esquema de circulación

Minimizá el pasillo; el patrón dominante del mercado es **cero pasillo**: la sala-comedor central distribuye todo (T01–T04, T08, T12). Reglas:

- Hall como distribuidor cuando el bloque de noche tiene 3+ piezas: 2 m² sirven 4 puertas (Neufert p. 246). El hall debe conectar de inmediato las piezas de mayor tráfico (Neufert p. 245).
- Pasillo solo en 3D profundos (T07, T09, T10, T11); ancho ≥ 0.90 m entre paramentos (RNE A.020 Art. 13), tramos cortos y rectos.
- **Regla dura: circulación (pasillos + halls) ≤ 10% del área techada** (tipologias-lima.md §7; los ejemplares rinden 0–8%).
- Puertas abren hacia los cuartos, nunca hacia el pasillo (Neufert p. 245).
- En 2D+, al menos un baño alcanzable sin atravesar dormitorios (RNE A.020 Art. 10.2).

## Paso 5 — Dimensionar cada ambiente

Usá la tabla mínimo/óptimo y elegí DENTRO del rango según el área objetivo, repartiendo por proporciones de mercado (tipologias-lima.md §7: social 28–32%, cocina+lavandería 12–14%, dormitorios 34–42%, baños 10–11%, circulación+muros ≤ 10%):

| Ambiente | Mínimo (m² / ancho m) | Óptimo | Fuente |
|---|---|---|---|
| sala-comedor 2D/3D | 16.0 / 3.00 | 18–22 | Neufert p. 255–256; tipologias §7 |
| sala-comedor 1D c/kitchenette | 10.5 / 2.50 | 12–16 | tipologias T01/T12 |
| dormitorio principal | 10.5 / 2.90 (1D: 9.5 / 2.70) | 12–13 (frente 3.50 con cama 2.00 + 0.75 por lado) | Neufert p. 257 |
| dormitorio secundario | 6.5 / 2.40 | 8–10 | Neufert p. 257 |
| cocina cerrada | 4.0 / 1.40 (5.0 si aloja lavadero) | 8–10; entre frentes 1.20, ancho 2.40 a dos frentes | Neufert p. 254 |
| baño completo | 2.4 / 1.20 | 3.4 (2.05×1.65) | Neufert p. 263 |
| baño de visita | 1.05 / 0.90 | 1.6 (0.90×1.75) | Neufert p. 263 |
| lavandería | 1.6 / 0.90 | 2.4–3.0 | Neufert p. 305 |
| hall | 1.4 / 0.90 | 2–3 | Neufert p. 246 |
| terraza | ≥ 3.0 recomendado | 6–7 | Neufert p. 302 |

Proporciones: dormitorios ≤ 2.0 largo/corto, social ≤ 2.6 (reglas.js AMBIENTE.prop). Verificá que el mobiliario cabe (RNE A.020 Art. 10.3): cama con paso ≥ 0.60–0.75 (Neufert p. 257), mesa con 0.80 detrás de sillas (Neufert p. 255), clóset ~1.00 m de frente por persona (Neufert p. 257), aparatos sanitarios con sus huellas de uso (Neufert p. 263).

## Paso 6 — Materializar: muros, puertas, ventanas

**Muros**: se emiten por eje (`a`→`b`). Espesor **0.15 m interior** (tabiquería) y **0.25 m fachada/portante** (albañilería confinada); todo muro de 0.25 es `portante: true`. Los polígonos de ambientes son la CARA INTERIOR: retranqueá espesor/2 desde cada eje.

**Puertas**: anchos de vano — 0.90 acceso principal a la unidad; 0.80 dormitorios, estar, cocina, comedor; 0.70 baños (RNE A.020 Art. 12.2.b, Cuadro 06); altura de vano 2.10 (Art. 12.2.a). Sentido de giro: hacia el ambiente servido (el `a` de la puerta), nunca hacia el pasillo (Neufert p. 245); baños giran hacia adentro salvo diseño accesible, que gira hacia afuera (Neufert p. 298). El JSON no lleva campo de giro: se asume giro hacia `a`.

**Ventanas**: dimensioná el vano con **área ≥ 1/8 de la superficie del ambiente servido** (criterio de proyecto; el piso normativo es 10%, RNE A.020 Art. 12.4), vano de ventilación ≥ 1/12 y abertura operable al exterior ≥ 5% del área servida — con corredera estándar (50% operable), una hoja individual de vano ≥ 10% del área la cubre (RNE A.010 Art. 38.2). **Alféizar 1.00 m** (RNE A.020 Art. 12.5.c); mamparas de piso a techo (alfeizar 0) solo hacia terraza propia, con vidrio fijo templado o baranda en el tramo bajo. Ventanas SOLO en aristas del ambiente que tocan fachada o pozo. Alturas típicas de hoja: 1.10–1.40 m con dintel a 2.10–2.40.

## Paso 7 — Emitir el layout como JSON ESTRICTO

Formato exacto (el mismo de los ejemplares T01–T12 de `references/tipologias-lima.md`). Emitir SOLO el JSON, sin comentarios ni campos extra:

```
{
  "id": string,                    // "T##" o slug del proyecto
  "nombre": string,                // tipología + parti en una línea
  "area_techada": number,          // m²
  "frente_m": number,              // dimensión en x
  "fondo_m": number,               // dimensión en y
  "ambientes": [{
    "nombre": string,              // "sala-comedor" | "dormitorio principal" | "dormitorio 2..." |
                                   // "cocina" | "baño 1..." | "baño visita" | "lavandería" |
                                   // "hall" | "pasillo" | "terraza" | "estudio"
    "poligono": [[x,y], ...],      // cara interior de muros, vértices en metros
    "zona": "social"|"intima"|"servicio",
    "luz": boolean                 // true = exige vano a fachada/pozo
  }],
  "muros": [{ "a": [x,y], "b": [x,y], "espesor": 0.15|0.25, "portante": boolean }],  // por eje
  "puertas": [{ "de": "exterior"|nombre, "a": nombre, "ancho": number }],
  "ventanas": [{ "ambiente": nombre, "ancho": number, "alto": number, "alfeizar": number }],
  "muro_humedo": { "a": [x,y], "b": [x,y] }   // eje sanitario del paso 3
}
```

Ejemplar few-shot (T12, 1D/1B compacto de inversión, 33.0 m² — el formato a imitar):

```json
{
  "id": "T12",
  "nombre": "1D/1B compacto de inversión — sala-kitchenette integrada, núcleo húmedo apilado junto al ingreso",
  "area_techada": 33.0,
  "frente_m": 6.6,
  "fondo_m": 5.0,
  "ambientes": [
    { "nombre": "sala-comedor", "poligono": [[3.85,0.15],[6.35,0.15],[6.35,2.95],[4.95,2.95],[4.95,4.75],[2.45,4.75],[2.45,3.10],[3.85,3.10]], "zona": "social", "luz": true },
    { "nombre": "dormitorio principal", "poligono": [[0.25,0.15],[3.70,0.15],[3.70,2.95],[0.25,2.95]], "zona": "intima", "luz": true },
    { "nombre": "baño 1", "poligono": [[0.25,3.10],[2.30,3.10],[2.30,4.75],[0.25,4.75]], "zona": "servicio", "luz": false },
    { "nombre": "lavandería", "poligono": [[5.10,3.10],[6.35,3.10],[6.35,4.75],[5.10,4.75]], "zona": "servicio", "luz": false }
  ],
  "muros": [
    {"a": [0.0,0.0], "b": [6.6,0.0], "espesor": 0.15, "portante": false},
    {"a": [0.0,0.0], "b": [0.0,5.0], "espesor": 0.25, "portante": true},
    {"a": [0.0,5.0], "b": [6.6,5.0], "espesor": 0.25, "portante": true},
    {"a": [6.6,0.0], "b": [6.6,5.0], "espesor": 0.25, "portante": true},
    {"a": [0.0,3.025], "b": [3.85,3.025], "espesor": 0.15, "portante": true},
    {"a": [4.95,3.025], "b": [6.6,3.025], "espesor": 0.15, "portante": true},
    {"a": [2.375,3.10], "b": [2.375,4.75], "espesor": 0.15, "portante": false},
    {"a": [3.775,0.15], "b": [3.775,2.95], "espesor": 0.15, "portante": false},
    {"a": [5.025,3.10], "b": [5.025,4.75], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala-comedor", "ancho": 0.90},
    {"de": "sala-comedor", "a": "dormitorio principal", "ancho": 0.80},
    {"de": "sala-comedor", "a": "baño 1", "ancho": 0.70},
    {"de": "sala-comedor", "a": "lavandería", "ancho": 0.80}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 1.80, "alto": 1.30, "alfeizar": 1.00},
    {"ambiente": "dormitorio principal", "ancho": 1.60, "alto": 1.30, "alfeizar": 1.00}
  ],
  "muro_humedo": {"a": [0.0, 5.0], "b": [6.6, 5.0]}
}
```

Convenciones duras del emisor: coordenadas con máx. 3 decimales; polígonos cerrados implícitamente (no repetir el primer vértice); nombres de ambientes en minúsculas y consistentes entre `ambientes`, `puertas` y `ventanas`; ningún campo adicional salvo `altura_libre` (opcional, ver CHK-21).

## Paso 8 — AUTOCRÍTICA obligatoria

Antes de entregar, recorré `references/checklist-validacion.md` ítem por ítem (CHK-01 a CHK-21) haciendo los cálculos geométricos reales (shoelace, rectángulo inscrito, grafo de puertas, distancias al muro húmedo). Reportá `CHK-XX | PASA/FALLA | valor medido vs umbral`. Todo bloqueante [B] que falle se corrige en el JSON y se RE-VALIDA el checklist completo desde CHK-01 (una corrección puede romper otra regla). Las advertencias [A] que se dejen pasar se justifican en una línea. Solo se entrega un layout con cero bloqueantes.


## Reglas duras adicionales (requisito de Sebastián / BAM)

- **Toda habitación tiene puerta.** Ningún `ambiente` puede quedar sin al menos una puerta que lo conecte (refuerza CHK-13; verificado por CHK-22). Un ambiente sin puerta es error BLOQUEANTE — corregilo.
- **Nada sin resolver: no dejes tramos mayores a 3.00 m sin amoblar ni resolver.** Todo largo de muro o espacio útil debe tener función o mobiliario dentro de 3 m — sin paños muertos ni rincones vacíos. Si un tramo supera 3 m sin uso, agregá mobiliario, un clóset, un mueble empotrado o reconfigurá el ambiente. (En el Editor de Planos esto se materializa con la librería de layouts amueblados por ambiente.)
