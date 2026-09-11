// Atlas de tipologías: plantas REALES del mercado limeño, leídas de las láminas que las
// inmobiliarias publican en Nexo, para que el motor recupere-y-adapte en vez de inventar.
//
// Es la pieza que el análisis de Finch3D mostró como decisiva: su calidad no viene de que
// su agente razone mejor sobre geometría, sino de que no tiene que razonar — parte de una
// biblioteca de plantas validadas y la deforma. Ver docs/investigacion/2026-09-10-finch3d-metodo.md
//
// Los ambientes son RECTÁNGULOS, no polígonos: es el nivel de aproximación que pidió el
// producto, es mucho más fiable de leer para un modelo de visión, y evita las plantas en L
// que ya rompieron el recorte una vez. Un espacio en L se expresa como dos ambientes
// contiguos ("sala" + "comedor"), que además es como las láminas los rotulan.

// Aristas del sobre, para fachadas y entrada.
export const ARISTAS = ["abajo", "derecha", "arriba", "izquierda"];

export const TIPOS_AMBIENTE = [
  "social", "intima", "servicio", "circulacion", "exterior",
];

// Qué ambiente pide luz natural. Coincide con el criterio de vanos.js.
export const PIDE_LUZ = new Set(["social", "intima"]);

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Valida una entrada del atlas. NO corrige: reporta. La lectura por visión es aproximada
 * por definición, así que lo que importa no es que sea exacta sino que sea COHERENTE —
 * que los ambientes quepan en el sobre, que sumen algo parecido al área declarada, y que
 * el programa que dice tener sea el que se puede contar en sus ambientes.
 *
 * @returns {{ ok: boolean, errores: string[], avisos: string[], metricas: object }}
 */
export function validarEntrada(entrada = {}) {
  const errores = [];
  const avisos = [];

  const ancho = num(entrada.sobre?.ancho);
  const fondo = num(entrada.sobre?.fondo);
  if (!(ancho > 0) || !(fondo > 0)) errores.push("sobre inválido: ancho y fondo tienen que ser > 0");

  const ambientes = Array.isArray(entrada.ambientes) ? entrada.ambientes : [];
  if (!ambientes.length) errores.push("sin ambientes");

  let suma = 0;
  for (const [i, a] of ambientes.entries()) {
    const x = num(a.x), y = num(a.y), w = num(a.w), h = num(a.h);
    const et = a.nombre || `ambiente ${i}`;
    if ([x, y, w, h].some((v) => v === null)) { errores.push(`${et}: x/y/w/h no numéricos`); continue; }
    if (!(w > 0) || !(h > 0)) { errores.push(`${et}: ancho o fondo no positivo`); continue; }
    if (!TIPOS_AMBIENTE.includes(a.tipo)) avisos.push(`${et}: tipo "${a.tipo}" fuera de la lista`);
    suma += w * h;
    // caber en el sobre, con 10 cm de gracia por el error de lectura
    if (ancho > 0 && fondo > 0) {
      if (x < -0.1 || y < -0.1 || x + w > ancho + 0.1 || y + h > fondo + 0.1) {
        errores.push(`${et}: se sale del sobre (${r2(x)},${r2(y)} ${r2(w)}×${r2(h)} en ${ancho}×${fondo})`);
      }
    }
  }

  // solapes: dos ambientes no pueden ocupar el mismo suelo
  for (let i = 0; i < ambientes.length; i++) {
    for (let j = i + 1; j < ambientes.length; j++) {
      const a = ambientes[i], b = ambientes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0.15 && oy > 0.15) {
        errores.push(`"${a.nombre}" y "${b.nombre}" se solapan ${r2(ox)}×${r2(oy)} m`);
      }
    }
  }

  // coherencia con el área declarada en la propia lámina
  const declarada = num(entrada.area?.declarada);
  let desvio = null;
  if (declarada > 0 && suma > 0) {
    desvio = (suma - declarada) / declarada;
    if (Math.abs(desvio) > 0.25) errores.push(`la suma de ambientes (${r2(suma)} m²) se aleja ${(desvio * 100).toFixed(0)}% del área declarada (${declarada} m²)`);
    else if (Math.abs(desvio) > 0.12) avisos.push(`suma de ambientes ${(desvio * 100).toFixed(0)}% respecto de la declarada`);
  }

  // el programa declarado tiene que poder contarse en los ambientes
  const dorms = ambientes.filter((a) => /dormitorio|habitaci/i.test(a.nombre || "")).length;
  const banos = ambientes.filter((a) => /ba[ñn]o|ss\.?hh/i.test(a.nombre || "")).length;
  if (num(entrada.programa?.dormitorios) !== null && dorms !== entrada.programa.dormitorios) {
    errores.push(`declara ${entrada.programa.dormitorios} dormitorios y hay ${dorms} en los ambientes`);
  }
  if (num(entrada.programa?.banos) !== null && banos !== entrada.programa.banos) {
    avisos.push(`declara ${entrada.programa.banos} baños y hay ${banos} en los ambientes`);
  }

  // fachadas y entrada
  const fachadas = Array.isArray(entrada.fachadas) ? entrada.fachadas : [];
  if (!fachadas.length) errores.push("sin fachadas: sin eso no se puede orientar ni poner ventanas");
  for (const f of fachadas) if (!ARISTAS.includes(f)) errores.push(`fachada "${f}" no es una arista válida`);
  if (!ARISTAS.includes(entrada.entrada?.arista)) errores.push("entrada sin arista válida");

  // un ambiente que pide luz y no toca ninguna fachada
  const sinLuz = [];
  for (const a of ambientes) {
    if (!PIDE_LUZ.has(a.tipo)) continue;
    const toca = fachadas.some((f) =>
      (f === "abajo" && a.y <= 0.1) || (f === "arriba" && a.y + a.h >= fondo - 0.1)
      || (f === "izquierda" && a.x <= 0.1) || (f === "derecha" && a.x + a.w >= ancho - 0.1));
    if (!toca) sinLuz.push(a.nombre);
  }
  if (sinLuz.length) avisos.push(`sin contacto con fachada: ${sinLuz.join(", ")}`);

  // Coherencia FÍSICA del sobre. Estos tres no los ve el chequeo de solapes ni el de
  // área declarada, y son los que delatan una lectura mal escalada:
  if (ancho > 0 && fondo > 0 && suma > 0) {
    const ocup = suma / (ancho * fondo);
    // Una planta real gasta 8-15% del sobre en muros y circulación. Ocupación ~1 significa
    // que se teseló el rectángulo sin descontar el espesor de los muros: no es una planta.
    if (ocup > 0.97) errores.push(`ocupación ${(ocup * 100).toFixed(0)}%: no queda suelo para muros ni circulación`);
    else if (ocup > 0.94) avisos.push(`ocupación ${(ocup * 100).toFixed(0)}%: muy poco margen para muros`);
    // Y por abajo: demasiado sin asignar suele ser ambientes que no se leyeron.
    if (ocup < 0.68) avisos.push(`ocupación ${(ocup * 100).toFixed(0)}%: falta más de un tercio del sobre, ¿quedaron ambientes sin leer?`);

    const esbeltez = Math.max(ancho, fondo) / Math.min(ancho, fondo);
    if (esbeltez > 3.2) avisos.push(`sobre muy alargado (${esbeltez.toFixed(1)}:1): revisar si la proporción se leyó bien`);
  }
  // Sin área en la lámina no hay contra qué escalar: las medidas salen de inferir por el
  // mobiliario y NO se pueden verificar. Es exactamente el caso que tiene que ir en "baja".
  if (!(declarada > 0)) {
    avisos.push("sin área declarada en la lámina: la escala es inferida y no se puede verificar");
    if (entrada.confianza === "alta") errores.push('sin área declarada no se puede sostener confianza "alta"');
  }

  if (!["alta", "media", "baja"].includes(entrada.confianza)) {
    errores.push('confianza tiene que ser "alta", "media" o "baja"');
  }

  return {
    ok: errores.length === 0,
    errores,
    avisos,
    metricas: {
      ambientes: ambientes.length,
      sumaAreas: r2(suma),
      areaSobre: ancho > 0 && fondo > 0 ? r2(ancho * fondo) : null,
      desvioArea: desvio === null ? null : r2(desvio),
      ocupacion: ancho > 0 && fondo > 0 ? r2(suma / (ancho * fondo)) : null,
      dormitorios: dorms,
      banos,
      sinLuz,
    },
  };
}

/**
 * Normaliza la ESCALA de una entrada para que el sobre valga lo que la lámina declara.
 *
 * Por qué hace falta: en la práctica peruana el área techada se mide a cara exterior de
 * muros, así que el envolvente debería valer aproximadamente lo declarado — los ambientes
 * adentro suman 85-90% y el resto se lo comen los muros interiores. La lectura por visión
 * tiende a inflar el sobre (medido +12% de mediana sobre el primer atlas, con un caso de
 * +46%), porque estimar el envolvente por proporciones sin cotas empuja hacia arriba.
 *
 * Y el área es el dato que más importa de todo el atlas: la biblioteca existe para decir
 * "un 2D de 57 m² que se vende", no "un 2D de 64 que dice 57". Un sobre inflado hace que
 * el motor de calce elija la tipología equivocada para una huella dada.
 *
 * Se escala TODO por igual —sobre y ambientes— así que la distribución no cambia: cambia
 * el tamaño absoluto, que es justo lo que estaba mal. Sin área declarada no se toca nada:
 * no hay contra qué escalar.
 *
 * @returns {{ entrada: object, factor: number, aplicado: boolean }}
 */
export function normalizarEscala(entrada = {}) {
  const declarada = num(entrada.area?.declarada);
  const ancho = num(entrada.sobre?.ancho), fondo = num(entrada.sobre?.fondo);
  if (!(declarada > 0) || !(ancho > 0) || !(fondo > 0)) {
    return { entrada, factor: 1, aplicado: false };
  }
  const factor = Math.sqrt(declarada / (ancho * fondo));   // lineal, no de área
  if (Math.abs(factor - 1) < 0.02) return { entrada, factor: 1, aplicado: false };
  const e = (v) => r2(v * factor);
  return {
    aplicado: true,
    factor: Math.round(factor * 1000) / 1000,
    entrada: {
      ...entrada,
      sobre: { ancho: e(ancho), fondo: e(fondo) },
      ambientes: (entrada.ambientes || []).map((a) => ({
        ...a, x: e(a.x), y: e(a.y), w: e(a.w), h: e(a.h),
      })),
      entrada: entrada.entrada ? { ...entrada.entrada, t: e(num(entrada.entrada.t) || 0) } : entrada.entrada,
      notas: [
        ...(entrada.notas || []),
        `escala normalizada ×${Math.round(factor * 1000) / 1000} para que el sobre valga el área declarada (${declarada} m²)`,
      ],
    },
  };
}
