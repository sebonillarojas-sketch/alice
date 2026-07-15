// reglas de proyecto de vivienda — dimensiones y holguras estándar (metros).
// funtes: estándares antropométricos de proyecto (Neufert) + RNE Perú (A.010/A.020).
// son datos dimensionales (mínimos, holguras, ratios) usados para dimensionar el generador.

// holguras y anchos de circulación
export const HOLGURA = {
  corredorMin: 0.90,        // pasillo interior de vivienda (RNE ≥ 0.90)
  corredorSocial: 1.00,
  puertaPrincipal: 0.90,
  puertaAmbiente: 0.80,
  puertaBano: 0.70,
  paseCama: 0.70,           // circulación a un lado de la cama
  paseComensal: 0.75,       // detrás de silla de comedor para pasar
  frenteMueble: 0.75,       // espacio libre frente a un mueble para usarlo
  cocinaEntreFrentes: 1.20, // entre dos frentes de cocina enfrentados
  encimeraFondo: 0.60,
};

// alturas
export const ALTURA = { libreMin: 2.40, banoMin: 2.10, socialRec: 2.50 };

// iluminación/ventilación (RNE): vano de iluminación ≥ 1/8 del área; ventilación ≥ 1/12.
export const VANO = { iluminacion: 1 / 8, ventilacion: 1 / 12 };

// ── programa por ambiente ──────────────────────────────────
// zona: social | intima | servicio · luz: requiere fachada · humedo: va en muro de instalaciones
// aMin/wMin en m² y m. prop = proporción máx lado largo/corto recomendada.
export const AMBIENTE = {
  sala:        { nombre: "sala",         zona: "social",   luz: true,  humedo: false, aMin: 11, wMin: 3.0, prop: 2.2 },
  comedor:     { nombre: "comedor",      zona: "social",   luz: true,  humedo: false, aMin: 8,  wMin: 2.7, prop: 2.2 },
  "sala-comedor": { nombre: "sala-comedor", zona: "social", luz: true, humedo: false, aMin: 18, wMin: 3.2, prop: 2.6 },
  cocina:      { nombre: "cocina",       zona: "servicio", luz: false, humedo: true,  aMin: 5.5, wMin: 1.5, prop: 3.0 },
  lavanderia:  { nombre: "lavandería",   zona: "servicio", luz: false, humedo: true,  aMin: 2.5, wMin: 1.2, prop: 3.0 },
  dormPrincipal: { nombre: "dormitorio ppal", zona: "intima", luz: true, humedo: false, aMin: 11, wMin: 2.9, prop: 1.8 },
  dormitorio:  { nombre: "dormitorio",   zona: "intima",   luz: true,  humedo: false, aMin: 8.5, wMin: 2.6, prop: 1.8 },
  dormSimple:  { nombre: "dormitorio",   zona: "intima",   luz: true,  humedo: false, aMin: 7,   wMin: 2.4, prop: 1.9 },
  estudio:     { nombre: "estudio",      zona: "intima",   luz: true,  humedo: false, aMin: 6,   wMin: 2.2, prop: 2.0 },
  banoCompleto:{ nombre: "baño",         zona: "servicio", luz: false, humedo: true,  aMin: 3.0, wMin: 1.5, prop: 2.2 },
  banoVisita:  { nombre: "baño visita",  zona: "servicio", luz: false, humedo: true,  aMin: 1.6, wMin: 0.9, prop: 2.4 },
  hall:        { nombre: "hall",         zona: "servicio", luz: false, humedo: false, aMin: 1.5, wMin: 0.9, prop: 6.0 },
};

// programa por tipología (qué ambientes y cuántos)
export function programa(dormitorios, banos) {
  const nd = Math.max(1, Math.min(3, dormitorios));
  const nb = Math.max(1, Math.min(3, banos));
  const items = [{ key: "sala-comedor" }, { key: "cocina" }];
  items.push({ key: "dormPrincipal" });
  for (let i = 1; i < nd; i++) items.push({ key: i === nd - 1 ? "dormitorio" : "dormitorio" });
  // baños: 1 completo; si 2+, el segundo es completo (íntima) y puede haber visita
  items.push({ key: "banoCompleto" });
  if (nb >= 2) items.push({ key: "banoCompleto" });
  if (nb >= 3) items.push({ key: "banoVisita" });
  if (nd >= 2) items.push({ key: "lavanderia" });
  return items.map((it) => ({ ...it, ...AMBIENTE[it.key] }));
}

// dimensiones de aparatos húmedos (para amueblar con holguras reales)
export const SANITARIO = {
  inodoro: { w: 0.40, d: 0.68, frente: 0.60 },   // + 0.60 libre al frente
  lavamanos: { w: 0.55, d: 0.45, frente: 0.55 },
  ducha: { w: 0.90, d: 0.90 },
  tina: { w: 1.70, d: 0.75 },
};

// tipología de dormitorio → cama recomendada por área/ancho
export function camaPara(key, wDisponible) {
  if (key === "dormPrincipal") return wDisponible >= 3.1 ? "cama-queen" : "cama-2plz";
  return wDisponible >= 2.9 ? "cama-2plz" : "cama-15plz";
}
