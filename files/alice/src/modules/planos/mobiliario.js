// catálogo de mobiliario estándar — dimensiones reales en metros (w = ancho, d = fondo)
// medidas tomadas de los estándares antropométricos de dimensions.com
// cuando lleguen los assets BAM, cada entrada puede recibir su propio símbolo (campo `svg`).

export const CATALOGO = [
  // dormitorio
  { id: "cama-king", nombre: "cama king", cat: "dormitorio", w: 1.93, d: 2.03 },
  { id: "cama-queen", nombre: "cama queen", cat: "dormitorio", w: 1.53, d: 2.03 },
  { id: "cama-2plz", nombre: "cama 2 plazas", cat: "dormitorio", w: 1.35, d: 1.90 },
  { id: "cama-15plz", nombre: "cama 1½ plazas", cat: "dormitorio", w: 1.05, d: 1.90 },
  { id: "velador", nombre: "velador", cat: "dormitorio", w: 0.45, d: 0.40 },
  { id: "closet", nombre: "clóset", cat: "dormitorio", w: 1.80, d: 0.60 },
  { id: "comoda", nombre: "cómoda", cat: "dormitorio", w: 1.00, d: 0.45 },
  { id: "escritorio", nombre: "escritorio", cat: "dormitorio", w: 1.20, d: 0.60 },
  // sala
  { id: "sofa-3c", nombre: "sofá 3 cuerpos", cat: "sala", w: 2.13, d: 0.90 },
  { id: "sofa-2c", nombre: "sofá 2 cuerpos", cat: "sala", w: 1.60, d: 0.90 },
  { id: "sillon", nombre: "sillón", cat: "sala", w: 0.85, d: 0.85 },
  { id: "mesa-centro", nombre: "mesa de centro", cat: "sala", w: 1.10, d: 0.60 },
  { id: "rack-tv", nombre: "rack tv", cat: "sala", w: 1.60, d: 0.45 },
  // comedor
  { id: "comedor-4", nombre: "comedor 4 pers.", cat: "comedor", w: 1.20, d: 0.80, sillas: 4 },
  { id: "comedor-6", nombre: "comedor 6 pers.", cat: "comedor", w: 1.80, d: 0.90, sillas: 6 },
  // cocina
  { id: "counter", nombre: "mueble de cocina", cat: "cocina", w: 1.80, d: 0.60 },
  { id: "refri", nombre: "refrigeradora", cat: "cocina", w: 0.75, d: 0.75 },
  { id: "lavadora", nombre: "lavadora", cat: "cocina", w: 0.60, d: 0.60 },
  // baño
  { id: "inodoro", nombre: "inodoro", cat: "baño", w: 0.40, d: 0.68 },
  { id: "lavamanos", nombre: "lavamanos", cat: "baño", w: 0.55, d: 0.45 },
  { id: "ducha", nombre: "ducha", cat: "baño", w: 0.90, d: 0.90 },
  { id: "tina", nombre: "tina", cat: "baño", w: 1.70, d: 0.75 },
  // aberturas (d ≈ espesor de muro; se dibujan sobre el muro)
  { id: "puerta-90", nombre: "puerta 0.90", cat: "abertura", w: 0.90, d: 0.14 },
  { id: "puerta-80", nombre: "puerta 0.80", cat: "abertura", w: 0.80, d: 0.14 },
  { id: "puerta-70", nombre: "puerta 0.70", cat: "abertura", w: 0.70, d: 0.14 },
  { id: "ventana-120", nombre: "ventana 1.20", cat: "abertura", w: 1.20, d: 0.14 },
  { id: "ventana-180", nombre: "ventana 1.80", cat: "abertura", w: 1.80, d: 0.14 },
  { id: "vano-100", nombre: "vano 1.00", cat: "abertura", w: 1.00, d: 0.14 },
  { id: "vano-150", nombre: "vano 1.50", cat: "abertura", w: 1.50, d: 0.14 },
];

export const porId = Object.fromEntries(CATALOGO.map((c) => [c.id, c]));
export const CATS = [...new Set(CATALOGO.map((c) => c.cat))];
