# Estadísticas de mercado — Tipologías residenciales Lima

Fuente: 6,687 tipologías reales scrapeadas de Nexo Inmobiliario (6,686 limpias). 89.8% flats, 10.1% dúplex, 0.1% tríplex. Los percentiles de área corresponden a **flats** salvo indicación.

## 1. Distribución por número de dormitorios

| Dorms | n | % del mercado | % flat | Baños (mediana) |
|---|---|---|---|---|
| 1D | 1,485 | 22.2% | 95.3% | 1 |
| 2D | 2,751 | 41.1% | 92.5% | 2 |
| 3D | 2,379 | 35.6% | 85.3% | 2 |
| 4D | 67 | 1.0% | 20.9% (mayoría dúplex) | 4 |

El mercado limeño es esencialmente 2D (41%) y 3D (36%); el 4D es marginal y casi siempre dúplex.

## 2. Áreas por percentil (m², flats)

| Dorms | p10 | p25 | mediana | p75 | p90 |
|---|---|---|---|---|---|
| 1D | 34.3 | 40.0 | 41.2 | 48.4 | 60.3 |
| 2D | 50.4 | 54.1 | 58.4 | 67.1 | 80.4 |
| 3D | 64.4 | 67.8 | 73.8 | 87.2 | 103.2 |
| 4D | 87.2 | 96.6 | 121.3 | 136.6 | 145.9 |

## 3. Combos dormitorios × baños más frecuentes

| Combo | n | % del total | Área mediana (flat) |
|---|---|---|---|
| 2D/2B | 2,320 | 34.7% | 58.0 |
| 3D/2B | 1,652 | 24.7% | 71.0 |
| 1D/1B | 1,197 | 17.9% | 40.6 |
| 3D/3B | 602 | 9.0% | 90.4 |
| 1D/2B | 268 | 4.0% | — |
| 2D/3B | 242 | 3.6% | — |
| 2D/1B | 177 | 2.6% | — |
| 3D/4B | 86 | 1.3% | — |

Los tres combos dominantes (2D/2B, 3D/2B, 1D/1B) concentran el **77.3%** del mercado.

## 4. Diferencias por zona y distrito

| Zona | n | Área mediana | Mediana 1D | Mediana 2D | Mediana 3D |
|---|---|---|---|---|---|
| Lima Moderna | 2,804 | 59.1 | 40.5 | 56.6 | 71.7 |
| Lima Top | 2,187 | 77.0 | 45.0 | 66.8 | 88.1 |
| Lima Sur | 591 | 63.2 | 40.4 | 54.6 | 66.6 |
| Lima Centro | 443 | 57.5 | 41.1 | 56.1 | 68.5 |

Lima Top (Miraflores 83.0, Surco 85.9, San Borja 90.0 de mediana) corre ~10–16 m² por encima de Lima Moderna en 2D y 3D. Lima Moderna (San Miguel 58.6, Jesús María 60.9, Magdalena 63.6, Surquillo 54.7, Lince 58.2) es el volumen del mercado y define el estándar compacto. San Isidro aparece con mediana baja (60.5) por peso de producto 1D de inversión.

## 5. Ratio baño/dormitorio

Mediana **1.0**, media **0.97**: la norma limeña es un baño por dormitorio hasta 2D (2D/2B) y 2 baños para 3D (ratio 0.67) en el segmento medio; el 3D/3B (ratio 1.0) es producto de segmento alto (mediana 90.4 m²). El medio baño social casi no existe como categoría separada en el dato (se cuenta como baño).

## 6. Target de diseño (rango de área competitivo)

| Programa | Rango competitivo (p25–p75) | Sweet spot (mediana) | Segmento |
|---|---|---|---|
| 1D/1B compacto | 30–36 | ~33 | inversión/renta (cola baja: 151 unidades ≤35 m²) |
| 1D/1B | 40–48 | ~41 | Lima Moderna/Centro |
| 2D/2B | 54–67 | ~58 | núcleo del mercado (34.7%) |
| 3D/2B | 68–78 | ~71–74 | familiar estándar |
| 3D/3B | 84–105 | ~90 | Lima Top |
| 4D | 97–137 | ~121 | nicho (1%), usualmente dúplex |

## 7. Reparto de área por ambiente (ESTIMACIÓN — proporciones estándar de la práctica, no medidas en el dataset)

| Grupo de ambientes | 1D | 2D | 3D |
|---|---|---|---|
| Social (sala-comedor + terraza) | ~32% | ~30% | ~28% |
| Cocina + lavandería | ~14% | ~13% | ~12% |
| Dormitorios (incl. clósets) | ~34% | ~38% | ~42% |
| Baños | ~10% | ~11% | ~10% |
| Circulación + muros | ~10% | ~8% | ~8% |

Regla práctica: dormitorio principal 10.5–13 m², secundario 8–10 m², baño completo 3.2–4 m², cocina lineal 5–7 m², sala-comedor 16–22 m² según programa. Circulación objetivo <10% del área techada.

## Tipologías ejemplares (few-shot)

### T01 — 1D/1B estándar Lima Moderna — sala-comedor con kitchenette abierta (1D/1B, 40.6 m²)

Partición binaria pura: un solo tabique central divide la mitad social (sala-comedor con kitchenette abierta, al frente) de la mitad íntima (dormitorio en el otro frente). Baño y lavandería se recuestan contra el muro posterior, que concentra todo el muro húmedo; la sala distribuye directamente a los tres ambientes sin pasillo.
Circulación mínima (<5%): el sweet spot de 40.6 m² coincide con la mediana 1D/1B de Lima Moderna.

```json
{
  "id": "T01",
  "nombre": "1D/1B estándar Lima Moderna — sala-comedor con kitchenette abierta",
  "area_techada": 40.6,
  "frente_m": 6.6,
  "fondo_m": 6.15,
  "ambientes": [
    {
      "nombre": "sala-comedor",
      "poligono": [[0.15, 0.15], [3.30, 0.15], [3.30, 6.00], [1.35, 6.00], [1.35, 3.90], [0.15, 3.90]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[3.45, 0.15], [6.45, 0.15], [6.45, 6.00], [5.25, 6.00], [5.25, 3.70], [3.45, 3.70]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "baño 1",
      "poligono": [[3.45, 3.85], [5.10, 3.85], [5.10, 6.00], [3.45, 6.00]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[0.15, 4.05], [1.20, 4.05], [1.20, 6.00], [0.15, 6.00]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    {"a": [0.0, 0.075], "b": [6.60, 0.075], "espesor": 0.15, "portante": true},
    {"a": [0.0, 6.075], "b": [6.60, 6.075], "espesor": 0.15, "portante": true},
    {"a": [0.075, 0.0], "b": [0.075, 6.15], "espesor": 0.15, "portante": true},
    {"a": [6.525, 0.0], "b": [6.525, 6.15], "espesor": 0.15, "portante": true},
    {"a": [3.375, 0.15], "b": [3.375, 6.00], "espesor": 0.15, "portante": false},
    {"a": [3.45, 3.775], "b": [5.10, 3.775], "espesor": 0.15, "portante": false},
    {"a": [5.175, 3.85], "b": [5.175, 6.00], "espesor": 0.15, "portante": false},
    {"a": [1.275, 4.05], "b": [1.275, 6.00], "espesor": 0.15, "portante": false},
    {"a": [0.15, 3.975], "b": [1.20, 3.975], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala-comedor", "ancho": 0.90},
    {"de": "sala-comedor", "a": "dormitorio principal", "ancho": 0.80},
    {"de": "sala-comedor", "a": "baño 1", "ancho": 0.70},
    {"de": "sala-comedor", "a": "lavandería", "ancho": 0.80}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 1.80, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio principal", "ancho": 1.50, "alto": 1.20, "alfeizar": 1.00}
  ],
  "muro_humedo": {"a": [0.15, 6.075], "b": [5.10, 6.075]}
}
```

### T02 — 1D/1B amplio con terraza (1D/1B, 46.2 m²)

Zonificación en dos bandas: social al frente (sala + terraza que muerde la planta en el vértice del dormitorio) y servicios al fondo (cocina cerrada y baño espalda con espalda contra el tabique central, que es el muro húmedo compartido). El dormitorio funciona en suite: el baño se accede desde el dormitorio, no desde la sala.
La terraza retranqueada da profundidad a la fachada sin sacrificar área techada útil.

```json
{
  "id": "T02",
  "nombre": "1D/1B amplio con terraza",
  "area_techada": 46.2,
  "frente_m": 6.55,
  "fondo_m": 7.05,
  "ambientes": [
    {
      "nombre": "sala-comedor",
      "poligono": [[0.25, 0.15], [3.55, 0.15], [3.55, 5.00], [0.25, 5.00]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "terraza",
      "poligono": [[3.70, 0.15], [4.875, 0.15], [4.875, 2.475], [3.70, 2.475]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "cocina",
      "poligono": [[0.25, 5.15], [3.55, 5.15], [3.55, 6.80], [0.25, 6.80]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[5.025, 0.15], [6.30, 0.15], [6.30, 5.35], [3.70, 5.35], [3.70, 2.625], [5.025, 2.625]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "baño 1",
      "poligono": [[3.70, 5.50], [6.30, 5.50], [6.30, 6.80], [3.70, 6.80]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    {"a": [0.0, 0.0], "b": [6.55, 0.0], "espesor": 0.15, "portante": false},
    {"a": [0.0, 0.0], "b": [0.0, 7.05], "espesor": 0.25, "portante": true},
    {"a": [6.55, 0.0], "b": [6.55, 7.05], "espesor": 0.25, "portante": true},
    {"a": [0.0, 7.05], "b": [6.55, 7.05], "espesor": 0.25, "portante": true},
    {"a": [3.625, 0.15], "b": [3.625, 6.80], "espesor": 0.15, "portante": false},
    {"a": [0.25, 5.075], "b": [3.55, 5.075], "espesor": 0.15, "portante": false},
    {"a": [3.70, 5.425], "b": [6.30, 5.425], "espesor": 0.15, "portante": false},
    {"a": [3.70, 2.55], "b": [4.95, 2.55], "espesor": 0.15, "portante": false},
    {"a": [4.95, 0.15], "b": [4.95, 2.55], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala-comedor", "ancho": 0.90},
    {"de": "sala-comedor", "a": "cocina", "ancho": 1.20},
    {"de": "sala-comedor", "a": "terraza", "ancho": 1.80},
    {"de": "sala-comedor", "a": "dormitorio principal", "ancho": 0.80},
    {"de": "dormitorio principal", "a": "baño 1", "ancho": 0.70}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 2.40, "alto": 1.40, "alfeizar": 1.00},
    {"ambiente": "dormitorio principal", "ancho": 1.05, "alto": 1.40, "alfeizar": 1.00}
  ],
  "muro_humedo": {"a": [3.625, 5.15], "b": [3.625, 6.80]}
}
```

### T03 — 2D/2B compacto de volumen — sala central distribuidora, banda húmeda posterior (Surquillo/Lince) (2D/2B, 55.4 m²)

Frente ancho (9.55 m) y poco fondo (5.8 m): los tres ambientes que necesitan luz —dormitorio 2, sala y dormitorio principal— se alinean en la banda de fachada, con la sala al centro como distribuidora (sin pasillo). Toda la banda posterior es servicio: lavandería-cocina-baño 2-baño 1 en fila sobre un único muro húmedo continuo al fondo.
Parti típico de edificio de volumen en Surquillo/Lince: máxima eficiencia con circulación casi nula.

```json
{
  "id": "T03",
  "nombre": "2D/2B compacto de volumen — sala central distribuidora, banda húmeda posterior (Surquillo/Lince)",
  "area_techada": 55.4,
  "frente_m": 9.55,
  "fondo_m": 5.8,
  "ambientes": [
    {
      "nombre": "dormitorio 2",
      "poligono": [[0.25, 0.25], [2.70, 0.25], [2.70, 3.75], [0.25, 3.75]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "sala",
      "poligono": [[2.85, 0.25], [6.00, 0.25], [6.00, 3.75], [2.85, 3.75]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[6.15, 0.25], [9.30, 0.25], [9.30, 3.75], [6.15, 3.75]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "lavandería",
      "poligono": [[0.25, 3.90], [1.70, 3.90], [1.70, 5.55], [0.25, 5.55]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "cocina",
      "poligono": [[1.85, 3.90], [5.00, 3.90], [5.00, 5.55], [1.85, 5.55]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[5.15, 3.90], [7.05, 3.90], [7.05, 5.55], [5.15, 5.55]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 1",
      "poligono": [[7.20, 3.90], [9.30, 3.90], [9.30, 5.55], [7.20, 5.55]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    {"a": [0.0, 0.125], "b": [9.55, 0.125], "espesor": 0.25, "portante": true},
    {"a": [0.0, 5.675], "b": [9.55, 5.675], "espesor": 0.25, "portante": true},
    {"a": [0.125, 0.0], "b": [0.125, 5.80], "espesor": 0.25, "portante": true},
    {"a": [9.425, 0.0], "b": [9.425, 5.80], "espesor": 0.25, "portante": true},
    {"a": [0.25, 3.825], "b": [9.30, 3.825], "espesor": 0.15, "portante": false},
    {"a": [2.775, 0.25], "b": [2.775, 3.90], "espesor": 0.15, "portante": false},
    {"a": [6.075, 0.25], "b": [6.075, 3.90], "espesor": 0.15, "portante": false},
    {"a": [1.775, 3.90], "b": [1.775, 5.55], "espesor": 0.15, "portante": false},
    {"a": [5.075, 3.90], "b": [5.075, 5.55], "espesor": 0.15, "portante": false},
    {"a": [7.125, 3.90], "b": [7.125, 5.55], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala", "ancho": 0.90},
    {"de": "sala", "a": "dormitorio 2", "ancho": 0.80},
    {"de": "sala", "a": "dormitorio principal", "ancho": 0.80},
    {"de": "sala", "a": "cocina", "ancho": 1.50},
    {"de": "sala", "a": "baño 2", "ancho": 0.70},
    {"de": "dormitorio principal", "a": "baño 1", "ancho": 0.70},
    {"de": "cocina", "a": "lavandería", "ancho": 0.80}
  ],
  "ventanas": [
    {"ambiente": "sala", "ancho": 1.60, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio 2", "ancho": 1.20, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio principal", "ancho": 1.60, "alto": 1.20, "alfeizar": 1.00}
  ],
  "muro_humedo": {"a": [0.25, 5.55], "b": [9.30, 5.55]}
}
```

### T04 — 2D/2B mediana de mercado — sala central distribuidora, banda húmeda al fondo, fachada única (2D/2B, 58.0 m²)

La mediana exacta del mercado (58 m², combo dominante 34.7%). Fachada única de 10.45 m: sala-comedor central de frente a fondo que distribuye a los dos dormitorios laterales sin ningún pasillo. Banda húmeda al fondo partida en dos paquetes: baños gemelos detrás del principal (uno en suite) y cocina-lavandería detrás del dormitorio 2.
El muro posterior portante concentra todas las montantes: un solo muro húmedo para 4 ambientes de servicio.

```json
{
  "id": "T04",
  "nombre": "2D/2B mediana de mercado — sala central distribuidora, banda húmeda al fondo, fachada única",
  "area_techada": 58.0,
  "frente_m": 10.45,
  "fondo_m": 5.55,
  "ambientes": [
    {
      "nombre": "sala-comedor",
      "poligono": [[3.85, 0.15], [7.05, 0.15], [7.05, 5.40], [3.85, 5.40]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[0.15, 0.15], [3.70, 0.15], [3.70, 3.55], [0.15, 3.55]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[7.20, 0.15], [10.30, 0.15], [10.30, 3.00], [7.20, 3.00]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "baño 1",
      "poligono": [[0.15, 3.70], [1.85, 3.70], [1.85, 5.40], [0.15, 5.40]],
      "zona": "intima",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[2.00, 3.70], [3.70, 3.70], [3.70, 5.40], [2.00, 5.40]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "cocina",
      "poligono": [[7.20, 3.15], [9.20, 3.15], [9.20, 5.40], [7.20, 5.40]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[9.20, 3.15], [10.30, 3.15], [10.30, 5.40], [9.20, 5.40]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    { "a": [0.0, 0.075], "b": [10.45, 0.075], "espesor": 0.15, "portante": false },
    { "a": [0.0, 5.475], "b": [10.45, 5.475], "espesor": 0.15, "portante": true },
    { "a": [0.075, 0.0], "b": [0.075, 5.55], "espesor": 0.15, "portante": true },
    { "a": [10.375, 0.0], "b": [10.375, 5.55], "espesor": 0.15, "portante": true },
    { "a": [3.775, 0.0], "b": [3.775, 5.55], "espesor": 0.15, "portante": true },
    { "a": [7.125, 0.0], "b": [7.125, 5.55], "espesor": 0.15, "portante": true },
    { "a": [0.0, 3.625], "b": [3.775, 3.625], "espesor": 0.15, "portante": false },
    { "a": [1.925, 3.625], "b": [1.925, 5.55], "espesor": 0.15, "portante": false },
    { "a": [7.125, 3.075], "b": [10.45, 3.075], "espesor": 0.15, "portante": false }
  ],
  "puertas": [
    { "de": "exterior", "a": "sala-comedor", "ancho": 0.90 },
    { "de": "sala-comedor", "a": "dormitorio principal", "ancho": 0.80 },
    { "de": "sala-comedor", "a": "dormitorio 2", "ancho": 0.80 },
    { "de": "sala-comedor", "a": "cocina", "ancho": 0.80 },
    { "de": "cocina", "a": "lavandería", "ancho": 0.80 },
    { "de": "sala-comedor", "a": "baño 2", "ancho": 0.70 },
    { "de": "dormitorio principal", "a": "baño 1", "ancho": 0.70 }
  ],
  "ventanas": [
    { "ambiente": "sala-comedor", "ancho": 2.40, "alto": 1.40, "alfeizar": 1.00 },
    { "ambiente": "dormitorio principal", "ancho": 1.80, "alto": 1.40, "alfeizar": 1.00 },
    { "ambiente": "dormitorio 2", "ancho": 1.20, "alto": 1.40, "alfeizar": 1.00 }
  ],
  "muro_humedo": { "a": [0.15, 5.475], "b": [10.30, 5.475] }
}
```

### T05 — 2D/2B con terraza en esquina (2D/2B, 62.0 m²)

Esquinero con terraza mordida en el vértice: la sala en L abraza la terraza y toma luz de dos frentes. Hall central corto que separa el paquete íntimo (dormitorio principal al fondo) del social, y sirve a ambos baños. Núcleo húmedo apilado en franja vertical derecha: cocina, baño 1, baño 2 y lavandería comparten el muro húmedo del medianero.
Los dos dormitorios quedan en esquinas opuestas: máxima privacidad acústica entre ellos.

```json
{
  "id": "T05",
  "nombre": "2D/2B con terraza en esquina",
  "area_techada": 62.0,
  "frente_m": 7.75,
  "fondo_m": 8.4,
  "ambientes": [
    {
      "nombre": "terraza",
      "poligono": [[0, 0], [2.45, 0], [2.45, 1.1], [1.1, 1.1], [1.1, 2.45], [0, 2.45]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "sala-comedor",
      "poligono": [[2.6, 0], [4.55, 0], [4.55, 4.7], [0, 4.7], [0, 2.6], [1.25, 2.6], [1.25, 1.25], [2.6, 1.25]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[4.7, 0], [7.75, 0], [7.75, 3.0], [4.7, 3.0]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "cocina",
      "poligono": [[4.7, 3.15], [7.75, 3.15], [7.75, 4.7], [6.3, 4.7], [4.7, 4.7]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[0, 4.85], [3.5, 4.85], [3.5, 8.4], [0, 8.4]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "hall",
      "poligono": [[3.65, 4.85], [4.55, 4.85], [4.55, 8.4], [3.65, 8.4]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "baño 1",
      "poligono": [[4.7, 4.85], [6.2, 4.85], [6.2, 6.55], [4.7, 6.55]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[4.7, 6.7], [6.2, 6.7], [6.2, 8.4], [4.7, 8.4]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[6.35, 4.85], [7.75, 4.85], [7.75, 8.4], [6.35, 8.4]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    {"a": [2.45, 0], "b": [7.75, 0], "espesor": 0.25, "portante": true},
    {"a": [0, 2.45], "b": [0, 8.4], "espesor": 0.25, "portante": true},
    {"a": [0, 8.4], "b": [7.75, 8.4], "espesor": 0.25, "portante": true},
    {"a": [7.75, 0], "b": [7.75, 8.4], "espesor": 0.25, "portante": true},
    {"a": [0, 0], "b": [2.45, 0], "espesor": 0.15, "portante": false},
    {"a": [0, 0], "b": [0, 2.45], "espesor": 0.15, "portante": false},
    {"a": [2.53, 0], "b": [2.53, 1.18], "espesor": 0.15, "portante": false},
    {"a": [1.18, 1.18], "b": [2.53, 1.18], "espesor": 0.15, "portante": false},
    {"a": [1.18, 1.18], "b": [1.18, 2.53], "espesor": 0.15, "portante": false},
    {"a": [0, 2.53], "b": [1.18, 2.53], "espesor": 0.15, "portante": false},
    {"a": [4.63, 0], "b": [4.63, 4.78], "espesor": 0.15, "portante": true},
    {"a": [4.7, 3.08], "b": [7.75, 3.08], "espesor": 0.15, "portante": false},
    {"a": [0, 4.78], "b": [7.75, 4.78], "espesor": 0.15, "portante": true},
    {"a": [3.58, 4.85], "b": [3.58, 8.4], "espesor": 0.15, "portante": false},
    {"a": [4.63, 4.85], "b": [4.63, 8.4], "espesor": 0.15, "portante": false},
    {"a": [6.28, 4.85], "b": [6.28, 8.4], "espesor": 0.15, "portante": false},
    {"a": [4.7, 6.63], "b": [6.2, 6.63], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "hall", "ancho": 0.9},
    {"de": "hall", "a": "sala-comedor", "ancho": 0.8},
    {"de": "hall", "a": "dormitorio principal", "ancho": 0.8},
    {"de": "hall", "a": "baño 1", "ancho": 0.7},
    {"de": "hall", "a": "baño 2", "ancho": 0.7},
    {"de": "sala-comedor", "a": "cocina", "ancho": 1.2},
    {"de": "sala-comedor", "a": "dormitorio 2", "ancho": 0.8},
    {"de": "cocina", "a": "lavandería", "ancho": 0.8},
    {"de": "sala-comedor", "a": "terraza", "ancho": 1.2}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 1.8, "alto": 1.2, "alfeizar": 1.0},
    {"ambiente": "sala-comedor", "ancho": 1.4, "alto": 1.2, "alfeizar": 1.0},
    {"ambiente": "dormitorio 2", "ancho": 1.5, "alto": 1.2, "alfeizar": 1.0},
    {"ambiente": "dormitorio principal", "ancho": 1.6, "alto": 1.2, "alfeizar": 1.0}
  ],
  "muro_humedo": {"a": [6.28, 4.7], "b": [6.28, 8.4]}
}
```

### T06 — 2D/2B amplio Lima Top — fachada única, terraza y dormitorio en suite (2D/2B, 67.02 m²)

Producto Lima Top (67 m², p75 del combo 2D/2B): fachada única con tres paquetes claros — íntimo a la izquierda (principal en suite + dormitorio 2 sobre hall propio), social a la derecha (sala vertical con terraza retranqueada y mampara de piso a techo). Banda de servicio completa al fondo: baño 1, lavandería, cocina y baño 2 en fila sobre el muro húmedo posterior.
El hall íntimo aísla los dormitorios del área social: zonificación de segmento alto.

```json
{
  "id": "T06",
  "nombre": "2D/2B amplio Lima Top — fachada única, terraza y dormitorio en suite",
  "area_techada": 67.02,
  "frente_m": 9.9,
  "fondo_m": 6.77,
  "ambientes": [
    {
      "nombre": "dormitorio principal",
      "poligono": [[0.25, 0.15], [3.45, 0.15], [3.45, 4.27], [0.25, 4.27]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[3.6, 0.15], [6.3, 0.15], [6.3, 3.22], [3.6, 3.22]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "hall",
      "poligono": [[3.6, 3.37], [6.3, 3.37], [6.3, 4.27], [3.6, 4.27]],
      "zona": "intima",
      "luz": false
    },
    {
      "nombre": "terraza",
      "poligono": [[6.45, 0.15], [8.6, 0.15], [8.6, 2.0], [6.45, 2.0]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "sala-comedor",
      "poligono": [[8.6, 0.15], [9.65, 0.15], [9.65, 6.52], [6.45, 6.52], [6.45, 2.0], [8.6, 2.0]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "baño 1",
      "poligono": [[0.25, 4.42], [1.5, 4.42], [1.5, 6.52], [0.25, 6.52]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[1.65, 4.42], [2.65, 4.42], [2.65, 6.52], [1.65, 6.52]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "cocina",
      "poligono": [[2.8, 4.42], [4.95, 4.42], [4.95, 6.52], [2.8, 6.52]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[5.1, 4.42], [6.3, 4.42], [6.3, 6.52], [5.1, 6.52]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    { "a": [0.0, 0.075], "b": [6.45, 0.075], "espesor": 0.15, "portante": false },
    { "a": [8.6, 0.075], "b": [9.9, 0.075], "espesor": 0.15, "portante": false },
    { "a": [0.125, 0.0], "b": [0.125, 6.77], "espesor": 0.25, "portante": true },
    { "a": [9.775, 0.0], "b": [9.775, 6.77], "espesor": 0.25, "portante": true },
    { "a": [0.0, 6.645], "b": [9.9, 6.645], "espesor": 0.25, "portante": true },
    { "a": [3.525, 0.15], "b": [3.525, 4.42], "espesor": 0.15, "portante": false },
    { "a": [6.375, 0.15], "b": [6.375, 6.52], "espesor": 0.15, "portante": true },
    { "a": [0.25, 4.345], "b": [6.3, 4.345], "espesor": 0.15, "portante": false },
    { "a": [3.6, 3.295], "b": [6.3, 3.295], "espesor": 0.15, "portante": false },
    { "a": [1.575, 4.42], "b": [1.575, 6.52], "espesor": 0.15, "portante": false },
    { "a": [2.725, 4.42], "b": [2.725, 6.52], "espesor": 0.15, "portante": false },
    { "a": [5.025, 4.42], "b": [5.025, 6.52], "espesor": 0.15, "portante": false }
  ],
  "puertas": [
    { "de": "exterior", "a": "sala-comedor", "ancho": 0.9 },
    { "de": "sala-comedor", "a": "terraza", "ancho": 1.8 },
    { "de": "sala-comedor", "a": "hall", "ancho": 0.9 },
    { "de": "hall", "a": "dormitorio 2", "ancho": 0.8 },
    { "de": "hall", "a": "dormitorio principal", "ancho": 0.8 },
    { "de": "hall", "a": "baño 2", "ancho": 0.7 },
    { "de": "hall", "a": "cocina", "ancho": 0.8 },
    { "de": "dormitorio principal", "a": "baño 1", "ancho": 0.7 },
    { "de": "cocina", "a": "lavandería", "ancho": 0.8 }
  ],
  "ventanas": [
    { "ambiente": "dormitorio principal", "ancho": 2.2, "alto": 1.2, "alfeizar": 1.0 },
    { "ambiente": "dormitorio 2", "ancho": 1.8, "alto": 1.2, "alfeizar": 1.0 },
    { "ambiente": "sala-comedor", "ancho": 1.0, "alto": 2.1, "alfeizar": 0.0 }
  ],
  "muro_humedo": { "a": [0.25, 6.52], "b": [6.3, 6.52] }
}
```

### T07 — 3D/2B esencial en peine — fachada única, muro húmedo central (3D/2B, 75.3 m²)

El 3D esencial en peine: fachada única larga (12.75 m) con los tres dormitorios en fila sobre la fachada y la sala-comedor en el extremo izquierdo, con cocina abierta detrás. Un pasillo posterior de 0.90 m recorre la zona íntima y sirve a los dos baños, lavandería y terraza técnica alineados sobre el muro húmedo central.
Estructura clara de muros portantes transversales: parti repetible en edificios de vivienda masiva.

```json
{
  "id": "T07",
  "nombre": "3D/2B esencial en peine — fachada única, muro húmedo central",
  "area_techada": 75.3,
  "frente_m": 12.75,
  "fondo_m": 6.35,
  "ambientes": [
    {
      "nombre": "sala-comedor",
      "poligono": [[0.15, 0.15], [3.75, 0.15], [3.75, 4.75], [0.15, 4.75]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "cocina",
      "poligono": [[0.15, 4.75], [3.75, 4.75], [3.75, 6.20], [0.15, 6.20]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[3.90, 0.15], [6.40, 0.15], [6.40, 3.55], [3.90, 3.55]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 3",
      "poligono": [[6.55, 0.15], [9.05, 0.15], [9.05, 3.55], [6.55, 3.55]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[9.20, 0.15], [12.60, 0.15], [12.60, 3.55], [9.20, 3.55]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "pasillo",
      "poligono": [[3.90, 3.70], [10.20, 3.70], [10.20, 4.60], [3.90, 4.60]],
      "zona": "intima",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[3.90, 4.75], [6.30, 4.75], [6.30, 6.20], [3.90, 6.20]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 1",
      "poligono": [[6.45, 4.75], [8.65, 4.75], [8.65, 6.20], [6.45, 6.20]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[8.80, 4.75], [10.20, 4.75], [10.20, 6.20], [8.80, 6.20]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "terraza",
      "poligono": [[10.35, 3.70], [12.60, 3.70], [12.60, 6.20], [10.35, 6.20]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    { "a": [0.00, 0.075], "b": [12.75, 0.075], "espesor": 0.15, "portante": true },
    { "a": [0.00, 6.275], "b": [12.75, 6.275], "espesor": 0.15, "portante": true },
    { "a": [0.075, 0.00], "b": [0.075, 6.35], "espesor": 0.15, "portante": true },
    { "a": [12.675, 0.00], "b": [12.675, 6.35], "espesor": 0.15, "portante": true },
    { "a": [3.825, 0.15], "b": [3.825, 6.20], "espesor": 0.15, "portante": true },
    { "a": [6.475, 0.15], "b": [6.475, 3.55], "espesor": 0.15, "portante": false },
    { "a": [9.125, 0.15], "b": [9.125, 3.55], "espesor": 0.15, "portante": false },
    { "a": [3.90, 3.625], "b": [12.60, 3.625], "espesor": 0.15, "portante": true },
    { "a": [3.90, 4.675], "b": [10.35, 4.675], "espesor": 0.15, "portante": false },
    { "a": [6.375, 4.75], "b": [6.375, 6.20], "espesor": 0.15, "portante": false },
    { "a": [8.725, 4.75], "b": [8.725, 6.20], "espesor": 0.15, "portante": false },
    { "a": [10.275, 3.70], "b": [10.275, 6.20], "espesor": 0.15, "portante": false }
  ],
  "puertas": [
    { "de": "exterior", "a": "sala-comedor", "ancho": 0.90 },
    { "de": "sala-comedor", "a": "cocina", "ancho": 2.40 },
    { "de": "sala-comedor", "a": "pasillo", "ancho": 0.90 },
    { "de": "pasillo", "a": "dormitorio 2", "ancho": 0.80 },
    { "de": "pasillo", "a": "dormitorio 3", "ancho": 0.80 },
    { "de": "pasillo", "a": "dormitorio principal", "ancho": 0.80 },
    { "de": "pasillo", "a": "baño 2", "ancho": 0.70 },
    { "de": "pasillo", "a": "baño 1", "ancho": 0.70 },
    { "de": "pasillo", "a": "lavandería", "ancho": 0.80 },
    { "de": "lavandería", "a": "terraza", "ancho": 0.80 }
  ],
  "ventanas": [
    { "ambiente": "sala-comedor", "ancho": 2.10, "alto": 1.20, "alfeizar": 1.00 },
    { "ambiente": "dormitorio 2", "ancho": 1.20, "alto": 1.10, "alfeizar": 1.00 },
    { "ambiente": "dormitorio 3", "ancho": 1.20, "alto": 1.10, "alfeizar": 1.00 },
    { "ambiente": "dormitorio principal", "ancho": 1.40, "alto": 1.10, "alfeizar": 1.00 }
  ],
  "muro_humedo": { "a": [3.90, 4.675], "b": [10.35, 4.675] }
}
```

### T08 — 3D/2B familiar estándar — esquinero, sala central distribuidora y banda húmeda al lado derecho (3D/2B, 74.0 m²)

El familiar estándar (74 m², cerca de la mediana 3D/2B de 71): esquinero con sala-comedor central que distribuye a TODO —tres dormitorios, cocina y baño social— sin un solo metro de pasillo. Dormitorios en frente y fondo; baños apilados al centro-derecha (principal en suite) y cocina al fondo.
Todo el paquete sanitario cuelga del medianero derecho: un solo muro húmedo vertical de 6.3 m.

```json
{
  "id": "T08",
  "nombre": "3D/2B familiar estándar — esquinero, sala central distribuidora y banda húmeda al lado derecho",
  "area_techada": 74.0,
  "frente_m": 7.05,
  "fondo_m": 10.5,
  "ambientes": [
    {
      "nombre": "sala-comedor",
      "poligono": [[0.25, 3.95], [5.15, 3.95], [5.15, 7.75], [0.25, 7.75]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "cocina",
      "poligono": [[3.45, 7.9], [6.8, 7.9], [6.8, 10.25], [3.45, 10.25]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[3.2, 0.25], [6.8, 0.25], [6.8, 3.8], [3.2, 3.8]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[0.25, 0.25], [3.05, 0.25], [3.05, 3.8], [0.25, 3.8]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 3",
      "poligono": [[0.25, 7.9], [3.3, 7.9], [3.3, 10.25], [0.25, 10.25]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "baño 2",
      "poligono": [[5.3, 3.95], [6.8, 3.95], [6.8, 5.75], [5.3, 5.75]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 1",
      "poligono": [[5.3, 5.9], [6.8, 5.9], [6.8, 7.75], [5.3, 7.75]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    {"a": [0.0, 0.0], "b": [7.05, 0.0], "espesor": 0.25, "portante": true},
    {"a": [7.05, 0.0], "b": [7.05, 10.5], "espesor": 0.25, "portante": true},
    {"a": [7.05, 10.5], "b": [0.0, 10.5], "espesor": 0.25, "portante": true},
    {"a": [0.0, 10.5], "b": [0.0, 0.0], "espesor": 0.25, "portante": true},
    {"a": [3.125, 0.25], "b": [3.125, 3.8], "espesor": 0.15, "portante": false},
    {"a": [0.25, 3.875], "b": [6.8, 3.875], "espesor": 0.15, "portante": true},
    {"a": [5.225, 3.95], "b": [5.225, 7.75], "espesor": 0.15, "portante": false},
    {"a": [5.3, 5.825], "b": [6.8, 5.825], "espesor": 0.15, "portante": false},
    {"a": [0.25, 7.825], "b": [6.8, 7.825], "espesor": 0.15, "portante": true},
    {"a": [3.375, 7.9], "b": [3.375, 10.25], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala-comedor", "ancho": 0.9},
    {"de": "sala-comedor", "a": "cocina", "ancho": 0.8},
    {"de": "sala-comedor", "a": "dormitorio principal", "ancho": 0.8},
    {"de": "sala-comedor", "a": "dormitorio 2", "ancho": 0.8},
    {"de": "sala-comedor", "a": "dormitorio 3", "ancho": 0.8},
    {"de": "sala-comedor", "a": "baño 1", "ancho": 0.7},
    {"de": "dormitorio principal", "a": "baño 2", "ancho": 0.7}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 2.4, "alto": 1.2, "alfeizar": 1.0},
    {"ambiente": "dormitorio principal", "ancho": 1.8, "alto": 1.2, "alfeizar": 1.0},
    {"ambiente": "dormitorio 2", "ancho": 1.5, "alto": 1.2, "alfeizar": 1.0},
    {"ambiente": "dormitorio 3", "ancho": 1.2, "alto": 1.0, "alfeizar": 1.1}
  ],
  "muro_humedo": {"a": [6.8, 3.95], "b": [6.8, 10.25]}
}
```

### T09 — 3D/2B con estar íntimo — fachada única profunda, núcleo húmedo central con ducto, hall ensanchado como mini-estar/escritorio, dormitorios al patio posterior y pozo lateral (3D/2B, 78.4 m²)

Fachada única muy profunda (6.85 × 11.45 m) resuelta en cuatro franjas: social+terraza al frente, núcleo húmedo central (cocina-lavandería-baño 2) con ducto, franja de dormitorio 3 + hall ensanchado que funciona como mini-estar/escritorio + baño 1, y dormitorios principal y 2 al fondo ventilando a patio posterior y pozo lateral.
El muro húmedo central minimiza recorridos de montantes en un lote profundo, el caso difícil típico de Lima.

```json
{
  "id": "T09",
  "nombre": "3D/2B con estar íntimo — fachada única profunda, núcleo húmedo central con ducto, hall ensanchado como mini-estar/escritorio, dormitorios al patio posterior y pozo lateral",
  "area_techada": 78.4,
  "frente_m": 6.85,
  "fondo_m": 11.45,
  "ambientes": [
    {
      "nombre": "terraza",
      "poligono": [[0.25, 0.25], [1.35, 0.25], [1.35, 3.45], [0.25, 3.45]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "sala-comedor",
      "poligono": [[1.50, 0.25], [6.60, 0.25], [6.60, 3.45], [1.50, 3.45]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "cocina",
      "poligono": [[0.25, 3.60], [2.85, 3.60], [2.85, 5.65], [0.25, 5.65]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[3.00, 3.60], [4.00, 3.60], [4.00, 5.65], [3.00, 5.65]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "pasillo",
      "poligono": [[4.15, 3.60], [5.05, 3.60], [5.05, 5.65], [4.15, 5.65]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[5.20, 3.60], [6.60, 3.60], [6.60, 5.65], [5.20, 5.65]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "dormitorio 3",
      "poligono": [[0.25, 5.80], [3.00, 5.80], [3.00, 8.25], [0.25, 8.25]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "hall",
      "poligono": [[3.15, 5.80], [5.00, 5.80], [5.00, 8.25], [3.15, 8.25]],
      "zona": "intima",
      "luz": false
    },
    {
      "nombre": "baño 1",
      "poligono": [[5.15, 5.80], [6.60, 5.80], [6.60, 8.25], [5.15, 8.25]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[0.25, 8.40], [3.95, 8.40], [3.95, 11.20], [0.25, 11.20]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[4.10, 8.40], [6.60, 8.40], [6.60, 11.20], [4.10, 11.20]],
      "zona": "intima",
      "luz": true
    }
  ],
  "muros": [
    {"a": [0.0, 0.0], "b": [6.85, 0.0], "espesor": 0.25, "portante": true},
    {"a": [6.85, 0.0], "b": [6.85, 11.45], "espesor": 0.25, "portante": true},
    {"a": [6.85, 11.45], "b": [0.0, 11.45], "espesor": 0.25, "portante": true},
    {"a": [0.0, 11.45], "b": [0.0, 0.0], "espesor": 0.25, "portante": true},
    {"a": [1.425, 0.25], "b": [1.425, 3.45], "espesor": 0.15, "portante": false},
    {"a": [0.25, 3.525], "b": [6.60, 3.525], "espesor": 0.15, "portante": true},
    {"a": [2.925, 3.60], "b": [2.925, 5.65], "espesor": 0.15, "portante": false},
    {"a": [4.075, 3.60], "b": [4.075, 5.65], "espesor": 0.15, "portante": false},
    {"a": [5.125, 3.60], "b": [5.125, 5.65], "espesor": 0.15, "portante": false},
    {"a": [0.25, 5.725], "b": [6.60, 5.725], "espesor": 0.15, "portante": true},
    {"a": [3.075, 5.80], "b": [3.075, 8.25], "espesor": 0.15, "portante": false},
    {"a": [5.075, 5.80], "b": [5.075, 8.25], "espesor": 0.15, "portante": false},
    {"a": [0.25, 8.325], "b": [6.60, 8.325], "espesor": 0.15, "portante": true},
    {"a": [4.025, 8.40], "b": [4.025, 11.20], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala-comedor", "ancho": 0.90},
    {"de": "sala-comedor", "a": "terraza", "ancho": 1.40},
    {"de": "sala-comedor", "a": "cocina", "ancho": 0.80},
    {"de": "cocina", "a": "lavandería", "ancho": 0.80},
    {"de": "sala-comedor", "a": "pasillo", "ancho": 0.90},
    {"de": "pasillo", "a": "baño 2", "ancho": 0.70},
    {"de": "pasillo", "a": "hall", "ancho": 0.85},
    {"de": "hall", "a": "dormitorio 3", "ancho": 0.80},
    {"de": "hall", "a": "baño 1", "ancho": 0.70},
    {"de": "hall", "a": "dormitorio principal", "ancho": 0.80},
    {"de": "hall", "a": "dormitorio 2", "ancho": 0.80}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 2.40, "alto": 1.30, "alfeizar": 1.00},
    {"ambiente": "dormitorio principal", "ancho": 1.60, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio 2", "ancho": 1.20, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio 3", "ancho": 1.20, "alto": 1.10, "alfeizar": 1.00}
  ],
  "muro_humedo": {"a": [0.25, 5.725], "b": [6.60, 5.725]}
}
```

### T10 — 3D/2B amplio Lima Top — esquina, social en el vértice (3D/2B, 85 m²)

Producto amplio Lima Top (85 m², p75 del 3D) en esquina: el social ocupa el vértice con terraza y ventanas a dos frentes. Un pasillo vertical único distribuye a los tres dormitorios de la banda izquierda (todos con luz) y toda la banda de servicios —cocina, lavandería, baño 2, baño 1 en suite— se apila contra el medianero derecho.
Muro húmedo único de 9 m sobre el medianero: registro sanitario perfecto piso a piso.

```json
{
  "id": "T10",
  "nombre": "3D/2B amplio Lima Top — esquina, social en el vértice",
  "area_techada": 85,
  "frente_m": 7.30,
  "fondo_m": 14.10,
  "ambientes": [
    {
      "nombre": "terraza",
      "poligono": [[0.25, 0.25], [2.25, 0.25], [2.25, 2.75], [0.25, 2.75]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "sala-comedor",
      "poligono": [[2.25, 0.25], [7.05, 0.25], [7.05, 4.45], [0.25, 4.45], [0.25, 2.75], [2.25, 2.75]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "cocina",
      "poligono": [[4.90, 4.70], [7.05, 4.70], [7.05, 8.40], [4.90, 8.40]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[4.90, 8.55], [7.05, 8.55], [7.05, 9.50], [4.90, 9.50]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[4.90, 9.65], [7.05, 9.65], [7.05, 11.40], [4.90, 11.40]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 1",
      "poligono": [[4.90, 11.55], [7.05, 11.55], [7.05, 13.50], [4.90, 13.50]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "pasillo",
      "poligono": [[3.85, 4.70], [4.75, 4.70], [4.75, 10.60], [3.85, 10.60]],
      "zona": "intima",
      "luz": false
    },
    {
      "nombre": "dormitorio 3",
      "poligono": [[0.25, 4.70], [3.70, 4.70], [3.70, 7.50], [0.25, 7.50]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[0.25, 7.65], [3.70, 7.65], [3.70, 10.60], [0.25, 10.60]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[0.25, 10.75], [4.75, 10.75], [4.75, 13.85], [0.25, 13.85]],
      "zona": "intima",
      "luz": true
    }
  ],
  "muros": [
    {"a": [0.0, 0.0], "b": [7.30, 0.0], "espesor": 0.25, "portante": true},
    {"a": [0.0, 0.0], "b": [0.0, 14.10], "espesor": 0.25, "portante": true},
    {"a": [7.30, 0.0], "b": [7.30, 14.10], "espesor": 0.25, "portante": true},
    {"a": [0.0, 14.10], "b": [7.30, 14.10], "espesor": 0.25, "portante": true},
    {"a": [0.25, 4.575], "b": [7.05, 4.575], "espesor": 0.25, "portante": true},
    {"a": [3.775, 4.70], "b": [3.775, 10.675], "espesor": 0.15, "portante": false},
    {"a": [4.825, 4.70], "b": [4.825, 13.85], "espesor": 0.15, "portante": false},
    {"a": [0.25, 7.575], "b": [3.70, 7.575], "espesor": 0.15, "portante": false},
    {"a": [0.25, 10.675], "b": [4.75, 10.675], "espesor": 0.15, "portante": false},
    {"a": [4.90, 8.475], "b": [7.05, 8.475], "espesor": 0.15, "portante": false},
    {"a": [4.90, 9.575], "b": [7.05, 9.575], "espesor": 0.15, "portante": false},
    {"a": [4.90, 11.475], "b": [7.05, 11.475], "espesor": 0.15, "portante": false},
    {"a": [2.25, 0.25], "b": [2.25, 2.75], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala-comedor", "ancho": 0.90},
    {"de": "sala-comedor", "a": "terraza", "ancho": 1.80},
    {"de": "sala-comedor", "a": "cocina", "ancho": 0.80},
    {"de": "sala-comedor", "a": "pasillo", "ancho": 0.90},
    {"de": "cocina", "a": "lavandería", "ancho": 0.80},
    {"de": "pasillo", "a": "dormitorio 3", "ancho": 0.80},
    {"de": "pasillo", "a": "dormitorio 2", "ancho": 0.80},
    {"de": "pasillo", "a": "dormitorio principal", "ancho": 0.80},
    {"de": "pasillo", "a": "baño 2", "ancho": 0.70},
    {"de": "dormitorio principal", "a": "baño 1", "ancho": 0.70}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 3.00, "alto": 1.40, "alfeizar": 1.00},
    {"ambiente": "sala-comedor", "ancho": 1.20, "alto": 1.40, "alfeizar": 1.00},
    {"ambiente": "dormitorio 3", "ancho": 1.50, "alto": 1.40, "alfeizar": 1.00},
    {"ambiente": "dormitorio 2", "ancho": 1.50, "alto": 1.40, "alfeizar": 1.00},
    {"ambiente": "dormitorio principal", "ancho": 1.80, "alto": 1.40, "alfeizar": 1.00}
  ],
  "muro_humedo": {"a": [7.05, 4.70], "b": [7.05, 13.85]}
}
```

### T11 — 3D/3B premium en esquina — Lima Top (3D/3B, 95.06 m²)

Premium Lima Top (95 m², mediana del 3D/3B): social en el vértice de la esquina con terraza, baño de visita junto a la sala como tercer baño (el sello del segmento alto). Los tres baños + cocina + lavandería se apilan en un núcleo central sobre un solo muro húmedo vertical; pasillo corto que sirve al bloque íntimo de la banda izquierda, con principal en suite ampliado.
Doble circulación mínima (sala distribuye a dormitorio 2, pasillo al resto): jerarquía social/íntima muy marcada.

```json
{
  "id": "T11",
  "nombre": "3D/3B premium en esquina — Lima Top",
  "area_techada": 95.06,
  "frente_m": 9.70,
  "fondo_m": 9.80,
  "ambientes": [
    {
      "nombre": "sala-comedor",
      "poligono": [[3.95, 0.25], [7.20, 0.25], [7.20, 2.80], [9.45, 2.80], [9.45, 4.45], [5.05, 4.45], [5.05, 3.45], [3.95, 3.45]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "terraza",
      "poligono": [[7.35, 0.25], [9.45, 0.25], [9.45, 2.65], [7.35, 2.65]],
      "zona": "social",
      "luz": false
    },
    {
      "nombre": "cocina",
      "poligono": [[7.00, 4.60], [9.45, 4.60], [9.45, 8.15], [7.00, 8.15]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[7.00, 8.30], [9.45, 8.30], [9.45, 9.55], [7.00, 9.55]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño visita",
      "poligono": [[5.05, 4.60], [6.85, 4.60], [6.85, 6.00], [5.05, 6.00]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 2",
      "poligono": [[5.05, 6.15], [6.85, 6.15], [6.85, 7.55], [5.05, 7.55]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "baño 1",
      "poligono": [[5.05, 7.70], [6.85, 7.70], [6.85, 9.55], [5.05, 9.55]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "pasillo",
      "poligono": [[3.95, 3.60], [4.90, 3.60], [4.90, 7.35], [3.95, 7.35]],
      "zona": "intima",
      "luz": false
    },
    {
      "nombre": "dormitorio 2",
      "poligono": [[0.25, 0.25], [3.80, 0.25], [3.80, 3.30], [0.25, 3.30]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio 3",
      "poligono": [[0.25, 3.45], [3.80, 3.45], [3.80, 6.15], [0.25, 6.15]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[0.25, 6.30], [3.80, 6.30], [3.80, 7.50], [4.90, 7.50], [4.90, 9.55], [0.25, 9.55]],
      "zona": "intima",
      "luz": true
    }
  ],
  "muros": [
    {"a": [0.00, 0.125], "b": [9.70, 0.125], "espesor": 0.25, "portante": true},
    {"a": [9.575, 0.00], "b": [9.575, 9.80], "espesor": 0.25, "portante": true},
    {"a": [0.00, 9.675], "b": [9.70, 9.675], "espesor": 0.25, "portante": true},
    {"a": [0.125, 0.00], "b": [0.125, 9.80], "espesor": 0.25, "portante": true},
    {"a": [3.875, 0.25], "b": [3.875, 7.50], "espesor": 0.15, "portante": true},
    {"a": [0.25, 3.375], "b": [3.80, 3.375], "espesor": 0.15, "portante": false},
    {"a": [0.25, 6.225], "b": [3.80, 6.225], "espesor": 0.15, "portante": false},
    {"a": [3.95, 3.525], "b": [4.90, 3.525], "espesor": 0.15, "portante": false},
    {"a": [3.95, 7.425], "b": [4.90, 7.425], "espesor": 0.15, "portante": false},
    {"a": [4.975, 3.45], "b": [4.975, 9.55], "espesor": 0.15, "portante": false},
    {"a": [6.925, 4.45], "b": [6.925, 9.55], "espesor": 0.15, "portante": false},
    {"a": [5.05, 4.525], "b": [9.45, 4.525], "espesor": 0.15, "portante": false},
    {"a": [5.05, 6.075], "b": [6.85, 6.075], "espesor": 0.15, "portante": false},
    {"a": [5.05, 7.625], "b": [6.85, 7.625], "espesor": 0.15, "portante": false},
    {"a": [7.00, 8.225], "b": [9.45, 8.225], "espesor": 0.15, "portante": false},
    {"a": [7.275, 0.25], "b": [7.275, 2.65], "espesor": 0.15, "portante": false},
    {"a": [7.35, 2.725], "b": [9.45, 2.725], "espesor": 0.15, "portante": false}
  ],
  "puertas": [
    {"de": "exterior", "a": "sala-comedor", "ancho": 0.90},
    {"de": "sala-comedor", "a": "terraza", "ancho": 1.50},
    {"de": "sala-comedor", "a": "cocina", "ancho": 0.90},
    {"de": "sala-comedor", "a": "baño visita", "ancho": 0.70},
    {"de": "sala-comedor", "a": "dormitorio 2", "ancho": 0.80},
    {"de": "sala-comedor", "a": "pasillo", "ancho": 0.90},
    {"de": "cocina", "a": "lavandería", "ancho": 0.80},
    {"de": "pasillo", "a": "dormitorio 3", "ancho": 0.80},
    {"de": "pasillo", "a": "dormitorio principal", "ancho": 0.80},
    {"de": "pasillo", "a": "baño 2", "ancho": 0.70},
    {"de": "dormitorio principal", "a": "baño 1", "ancho": 0.70}
  ],
  "ventanas": [
    {"ambiente": "sala-comedor", "ancho": 2.40, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio 2", "ancho": 1.60, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio 3", "ancho": 1.50, "alto": 1.20, "alfeizar": 1.00},
    {"ambiente": "dormitorio principal", "ancho": 2.00, "alto": 1.20, "alfeizar": 1.00}
  ],
  "muro_humedo": {"a": [6.925, 4.45], "b": [6.925, 9.55]}
}
```

### T12 — 1D/1B compacto de inversión — sala-kitchenette integrada, núcleo húmedo apilado junto al ingreso (1D/1B, 33.0 m²)

La planta mínima de inversión/renta (33 m², cola baja del 1D): sala-kitchenette en L junto al ingreso, dormitorio en el frente opuesto. Baño y lavandería ocupan los extremos de la banda posterior, ambos colgados del muro húmedo del fondo; la L de la sala absorbe toda la circulación.
Dos ambientes con luz sobre un solo frente de 6.6 m: el mínimo viable con ventilación normativa.

```json
{
  "id": "T12",
  "nombre": "1D/1B compacto de inversión — sala-kitchenette integrada, núcleo húmedo apilado junto al ingreso",
  "area_techada": 33.0,
  "frente_m": 6.6,
  "fondo_m": 5.0,
  "ambientes": [
    {
      "nombre": "sala-comedor",
      "poligono": [[3.85, 0.15], [6.35, 0.15], [6.35, 2.95], [4.95, 2.95], [4.95, 4.75], [2.45, 4.75], [2.45, 3.10], [3.85, 3.10]],
      "zona": "social",
      "luz": true
    },
    {
      "nombre": "dormitorio principal",
      "poligono": [[0.25, 0.15], [3.70, 0.15], [3.70, 2.95], [0.25, 2.95]],
      "zona": "intima",
      "luz": true
    },
    {
      "nombre": "baño 1",
      "poligono": [[0.25, 3.10], [2.30, 3.10], [2.30, 4.75], [0.25, 4.75]],
      "zona": "servicio",
      "luz": false
    },
    {
      "nombre": "lavandería",
      "poligono": [[5.10, 3.10], [6.35, 3.10], [6.35, 4.75], [5.10, 4.75]],
      "zona": "servicio",
      "luz": false
    }
  ],
  "muros": [
    {"a": [0.0, 0.0], "b": [6.6, 0.0], "espesor": 0.15, "portante": false},
    {"a": [0.0, 0.0], "b": [0.0, 5.0], "espesor": 0.25, "portante": true},
    {"a": [0.0, 5.0], "b": [6.6, 5.0], "espesor": 0.25, "portante": true},
    {"a": [6.6, 0.0], "b": [6.6, 5.0], "espesor": 0.25, "portante": true},
    {"a": [0.0, 3.025], "b": [3.85, 3.025], "espesor": 0.15, "portante": true},
    {"a": [4.95, 3.025], "b": [6.6, 3.025], "espesor": 0.15, "portante": true},
    {"a": [2.375, 3.10], "b": [2.375, 4.75], "espesor": 0.15, "portante": false},
    {"a": [3.775, 0.15], "b": [3.775, 2.95], "espesor": 0.15, "portante": false},
    {"a": [5.025, 3.10], "b": [5.025, 4.75], "espesor": 0.15, "portante": false}
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
