// La máquina de slots del handoff. El momento más importante de la conversación
// NO se improvisa: se arma por combinación, con el proyecto como única variable.
// Lo corre el modelo local (cero tokens de Claude) y no puede alucinar un precio
// porque no tiene ninguno — ver spec 2026-09-15-mica-agente-comercial §7.

const APERTURA = ["Con gusto", "Claro", "Claro que sí", "Por supuesto"];
const CONECTOR = ["Te conecto con José", "Te paso con José", "Te contacto con José"];
// Con proyecto conocido y sin él. El fallback no se arma concatenando "de " + texto:
// así salía "a cargo de el proyecto", que es exactamente el detalle que delata a un bot.
const ROL = [
  { con: "está a cargo de {P}", sin: "está a cargo del proyecto" },
  { con: "lleva {P}", sin: "lleva el proyecto" },
];
// Todo lo que se ofrece va atado a José. Mica nunca lo ofrece en primera persona.
const OFRECE = [
  "compartir los planos y toda la información",
  "mostrar planos, precios y disponibilidad",
  "compartir el detalle de cada unidad",
  "compartir toda la información que necesites",
];
const CIERRE = [
  "En breve se pone en contacto contigo",
  "Te escribe en un momento",
  "Se comunica contigo enseguida",
];

const SLOTS = [APERTURA, CONECTOR, ROL, OFRECE, CIERRE];

export function totalCombinaciones() {
  return SLOTS.reduce((n, s) => n * s.length, 1);
}

function comboDeIndice(n) {
  const idx = [];
  for (const slot of SLOTS) { idx.push(n % slot.length); n = Math.floor(n / slot.length); }
  return idx;
}

export function armarHandoff({ proyecto, usadas = [], random = Math.random }) {
  const total = totalCombinaciones();
  const yaUsadas = new Set(usadas);
  // Si se agotaron todas, se empieza de nuevo en vez de romperse: es preferible
  // repetir una frase con el mismo prospecto a quedarse sin respuesta.
  const libres = [];
  for (let i = 0; i < total; i++) if (!yaUsadas.has(String(i))) libres.push(i);
  const pool = libres.length ? libres : Array.from({ length: total }, (_, i) => i);
  const elegido = pool[Math.floor(random() * pool.length)];

  const [a, c, r, o, z] = comboDeIndice(elegido);
  const rol = proyecto ? ROL[r].con.replace("{P}", proyecto) : ROL[r].sin;
  const texto =
    `${APERTURA[a]}. ${CONECTOR[c]}, él ${rol} ` +
    `y trabaja de cerca con el equipo de arquitectura. Te puede ${OFRECE[o]}. ${CIERRE[z]}.`;

  return { texto, combo: String(elegido) };
}
