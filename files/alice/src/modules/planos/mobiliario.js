// catálogo de mobiliario BAM — UN símbolo paramétrico por cosa, adaptable en w×d.
// dimensiones reales en metros (w = ancho, d = fondo). El NSE ajusta presets
// (hornillas, refri, tamaño de cama) — no agrega símbolos nuevos.

export const CATALOGO = [
  // dormitorio — una cama paramétrica (presets por plaza), escritorio
  { id: "cama-king", nombre: "cama king", cat: "dormitorio", w: 1.93, d: 2.03 },
  { id: "cama-queen", nombre: "cama queen", cat: "dormitorio", w: 1.53, d: 2.03 },
  { id: "cama-2plz", nombre: "cama 2 plazas", cat: "dormitorio", w: 1.35, d: 1.90 },
  { id: "cama-15plz", nombre: "cama 1½ plazas", cat: "dormitorio", w: 1.05, d: 1.90 },
  { id: "velador", nombre: "velador", cat: "dormitorio", w: 0.45, d: 0.40 },
  { id: "closet", nombre: "clóset", cat: "dormitorio", w: 1.80, d: 0.60 },
  { id: "escritorio", nombre: "escritorio", cat: "dormitorio", w: 1.20, d: 0.60 },
  // sala — sofás/sillón/silla variables
  { id: "sofa-3c", nombre: "sofá 3 cuerpos", cat: "sala", w: 2.13, d: 0.90 },
  { id: "sofa-2c", nombre: "sofá 2 cuerpos", cat: "sala", w: 1.60, d: 0.90 },
  { id: "sillon", nombre: "sillón", cat: "sala", w: 0.85, d: 0.85 },
  { id: "silla", nombre: "silla", cat: "sala", w: 0.45, d: 0.48 },
  { id: "mesa-centro", nombre: "mesa de centro", cat: "sala", w: 1.10, d: 0.60 },
  { id: "rack-tv", nombre: "rack tv", cat: "sala", w: 1.60, d: 0.45 },
  // comedor
  { id: "comedor-4", nombre: "comedor 4 pers.", cat: "comedor", w: 1.20, d: 0.80, sillas: 4 },
  { id: "comedor-6", nombre: "comedor 6 pers.", cat: "comedor", w: 1.80, d: 0.90, sillas: 6 },
  // cocina — UN layout paramétrico: counter + lavadero + hornillas + refri.
  // w = largo total del counter. extras por item: hornillas (2|4), refriW (m), abierta (bool)
  { id: "cocina", nombre: "cocina", cat: "cocina", w: 2.40, d: 0.60, hornillas: 4, refriW: 0.75 },
  // lavandería — lavadora + poza en un símbolo
  { id: "lavanderia", nombre: "lavandería", cat: "cocina", w: 1.20, d: 0.60 },
  // baño — UN inodoro, UNA ducha adaptable, UN lavatorio
  { id: "inodoro", nombre: "inodoro", cat: "baño", w: 0.40, d: 0.68 },
  { id: "lavamanos", nombre: "lavatorio", cat: "baño", w: 0.55, d: 0.45 },
  { id: "ducha", nombre: "ducha", cat: "baño", w: 0.90, d: 0.90 },
  // exterior
  { id: "mesa-ext", nombre: "mesa exterior", cat: "exterior", w: 0.90, d: 0.90 },
  { id: "silla-ext", nombre: "silla exterior", cat: "exterior", w: 0.45, d: 0.45 },
  { id: "tumbona", nombre: "tumbona", cat: "exterior", w: 0.60, d: 1.90 },
  // vegetación (se dibuja en morado BAM)
  { id: "jardinera", nombre: "jardinera", cat: "vegetación", w: 1.50, d: 0.50 },
  { id: "maceta", nombre: "maceta", cat: "vegetación", w: 0.45, d: 0.45 },
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

// presets de cocina/cama por nivel socioeconómico del proyecto
export const NSE = {
  A: { cocina: { w: 3.2, hornillas: 4, refriW: 0.90, abierta: true }, camaPpal: "cama-king" },
  B: { cocina: { w: 2.6, hornillas: 4, refriW: 0.75, abierta: true }, camaPpal: "cama-queen" },
  C: { cocina: { w: 2.2, hornillas: 4, refriW: 0.70, abierta: false }, camaPpal: "cama-2plz" },
  D: { cocina: { w: 1.8, hornillas: 2, refriW: 0.60, abierta: false }, camaPpal: "cama-2plz" },
};
