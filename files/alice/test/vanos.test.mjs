import test from "node:test";
import assert from "node:assert/strict";
import { construirMuros } from "../src/modules/planos/muros.js";
import { construirVanos } from "../src/modules/planos/vanos.js";

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const room = (id, tipo, x0, y0, x1, y1, extra = {}) => ({ id, tipo, name: extra.name || tipo, pts: rect(x0, y0, x1, y1), ...extra });

const HOLGURA = 0.15;

// invariante del criterio 5: recolecta [vano, muro] de cada corrida para chequearlos
// TODOS al final, no solo el primero que aparezca.
const universo = [];
function correr(rooms, contexto = {}) {
  const { muros, avisos: avisosMuros } = construirMuros(rooms, contexto);
  const resultado = construirVanos(muros, rooms, contexto);
  for (const v of resultado.vanos) {
    const muro = muros.find((m) => m.id === v.muroId);
    universo.push({ vano: v, muro });
  }
  return { muros, avisosMuros, ...resultado };
}

// grafo de puertas: desde un roomId, qué otros room ids quedan alcanzables recorriendo
// solo los vanos tipo "puerta" (para que los tests verifiquen alcanzabilidad real, no
// solo que el módulo "dice" haber construido un árbol).
function alcanzables(vanos, desde) {
  const adj = new Map();
  for (const v of vanos) {
    if (v.tipo !== "puerta") continue;
    const [a, b] = v.entre;
    if (b == null) continue;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  const visitado = new Set([desde]);
  const cola = [desde];
  while (cola.length) {
    const cur = cola.shift();
    for (const vecino of adj.get(cur) || []) {
      if (!visitado.has(vecino)) { visitado.add(vecino); cola.push(vecino); }
    }
  }
  return visitado;
}

// ---------------------------------------------------------------------------
// 1. cuatro ambientes en fila quedan todos alcanzables desde la entrada
// ---------------------------------------------------------------------------
test("cuatro ambientes en fila quedan todos alcanzables desde la entrada", () => {
  const rooms = [
    room("corredor", "pasillo", 0, 4, 2.5, 5.5),
    room("hall", "pasillo", 0, 0, 2.5, 4, { unitRef: "u1", name: "hall" }),
    room("sala", "social", 2.5, 0, 5, 4, { unitRef: "u1", name: "sala-comedor" }),
    room("dorm1", "dormitorio", 5, 0, 7.5, 4, { unitRef: "u1" }),
    room("dorm2", "dormitorio", 7.5, 0, 10, 4, { unitRef: "u1" }),
  ];
  const { hallazgos, vanos } = correr(rooms);

  assert.deepEqual(hallazgos.filter((h) => h.codigo === "ambiente_inaccesible" || h.codigo === "unidad_sin_acceso" || h.codigo === "sin_muro_para_puerta"), []);

  const puertaEntrada = vanos.find((v) => v.tipo === "puerta" && v.entre.includes("hall"));
  assert.ok(puertaEntrada, "debe haber una puerta de entrada al hall desde el corredor");

  const rejoin = alcanzables(vanos, "hall");
  for (const id of ["hall", "sala", "dorm1", "dorm2"]) {
    assert.ok(rejoin.has(id), `"${id}" debe quedar alcanzable desde el hall`);
  }
});

// ---------------------------------------------------------------------------
// 2. un ambiente sin adyacencia produce ambiente_inaccesible, no un plano mudo
// ---------------------------------------------------------------------------
test("un ambiente sin adyacencia produce ambiente_inaccesible", () => {
  const rooms = [
    room("corredor", "pasillo", 0, 4, 2.5, 5.5),
    room("hall", "pasillo", 0, 0, 2.5, 4, { unitRef: "u1" }),
    room("sala", "social", 2.5, 0, 5, 4, { unitRef: "u1", name: "sala-comedor" }),
    // "depósito" no toca ningún otro ambiente de la unidad: queda flotando lejos.
    room("deposito", "dormitorio", 100, 100, 102, 102, { unitRef: "u1", name: "depósito" }),
  ];
  const { hallazgos } = correr(rooms);
  const h = hallazgos.find((x) => x.codigo === "ambiente_inaccesible" && x.roomId === "deposito");
  assert.ok(h, `debe reportar ambiente_inaccesible para "deposito": ${JSON.stringify(hallazgos)}`);
});

// ---------------------------------------------------------------------------
// 3. baño nunca recibe ventana; ninguna ventana cae sobre medianera/entre_unidades
//    (se verifica sobre la planta típica real, sección más abajo, y de nuevo acá
//    con un caso mínimo de dos unidades espalda con espalda).
// ---------------------------------------------------------------------------
test("un baño nunca recibe ventana, y ninguna ventana cae sobre medianera o entre_unidades", () => {
  const footprint = rect(0, 0, 12, 7);
  const rooms = [
    room("corredor", "pasillo", 0, 3.5, 12, 5),
    room("u1-sala", "social", 0, 0, 6, 3.5, { unitRef: "u1", name: "sala-comedor" }),
    room("u1-bano", "baño", 6, 0, 8, 3.5, { unitRef: "u1", name: "baño" }),
    room("u1-hall", "pasillo", 0, 5, 8, 7, { unitRef: "u1", name: "hall" }),
    room("u2-sala", "social", 8, 5, 12, 7, { unitRef: "u2", name: "sala-comedor" }),
  ];
  const { muros, vanos } = correr(rooms, { footprint, frontIdx: 0, lotType: "medianera" });

  const ventanas = vanos.filter((v) => v.tipo === "ventana");
  assert.ok(ventanas.every((v) => v.entre[0] !== "u1-bano"), "un baño nunca recibe ventana");
  for (const v of ventanas) {
    const m = muros.find((mm) => mm.id === v.muroId);
    assert.ok(m.clase !== "medianera" && m.clase !== "entre_unidades", `ventana sobre clase inválida: ${m.clase}`);
  }
});

// ---------------------------------------------------------------------------
// 4. un muro más corto que ancho+0.30 no recibe la puerta: o va al siguiente
//    muro, o hay hallazgo.
// ---------------------------------------------------------------------------
test("un muro interior demasiado corto para el ancho de puerta no recibe vano: hallazgo, no silencio", () => {
  const rooms = [
    room("corredor", "pasillo", 0, 4, 2, 5.5),
    room("hall", "pasillo", 0, 0, 2, 4, { unitRef: "u1" }),
    // dorm toca el hall en un tramo de sólo 0.5 m: 0.5 < 0.80 + 0.30, no cabe la
    // puerta de dormitorio y no hay ningún otro muro compartido entre ambos.
    room("dorm", "dormitorio", 2, 0, 4, 0.5, { unitRef: "u1" }),
  ];
  const { hallazgos, vanos } = correr(rooms);
  const puertaDorm = vanos.find((v) => v.tipo === "puerta" && v.entre.includes("dorm"));
  assert.equal(puertaDorm, undefined, "no debe colocarse una puerta que no cabe");
  const h = hallazgos.find((x) => x.codigo === "sin_muro_para_puerta" && x.roomId === "dorm");
  assert.ok(h, `debe reportar sin_muro_para_puerta: ${JSON.stringify(hallazgos)}`);
});

test("si el muro elegido no admite el ancho, se prueba el siguiente muro compartido y sí se coloca la puerta", () => {
  // hall y dorm comparten DOS tramos de muro interior (una L): el primero (0.5 m) no
  // admite la puerta de dormitorio (0.80 + 0.30), el segundo (2 m) sí.
  const rooms = [
    room("corredor", "pasillo", 0, 5, 4, 6.5),
    room("hall", "pasillo", 0, 0, 2, 5, { unitRef: "u1" }),
    {
      id: "dorm", tipo: "dormitorio", name: "dormitorio", unitRef: "u1",
      pts: [
        { x: 2, y: 0 }, { x: 2.5, y: 0 }, { x: 2.5, y: 0.5 }, { x: 4, y: 0.5 },
        { x: 4, y: 5 }, { x: 2, y: 5 },
      ],
    },
  ];
  const { hallazgos, vanos } = correr(rooms);
  const puertaDorm = vanos.find((v) => v.tipo === "puerta" && v.entre.includes("dorm"));
  assert.ok(puertaDorm, "debe colocar la puerta en el segundo muro compartido");
  assert.equal(hallazgos.filter((h) => h.codigo === "sin_muro_para_puerta").length, 0);
});

// ---------------------------------------------------------------------------
// 6. un dormitorio interior sin fachada produce ambiente_sin_luz
// ---------------------------------------------------------------------------
test("un dormitorio interior sin fachada produce ambiente_sin_luz", () => {
  const rooms = [
    room("corredor", "pasillo", 0, 4, 2.5, 5.5),
    room("hall", "pasillo", 0, 0, 2.5, 4, { unitRef: "u1" }),
    room("dorm", "dormitorio", 2.5, 0, 5, 4, { unitRef: "u1" }),
  ];
  // sin footprint/contexto: el borde exterior del dormitorio no matchea huella ni
  // patio, así que ningún muro suyo puede clasificar fachada — el caso de un
  // dormitorio genuinamente encerrado.
  const { hallazgos } = correr(rooms);
  const h = hallazgos.find((x) => x.codigo === "ambiente_sin_luz" && x.roomId === "dorm");
  assert.ok(h, `debe reportar ambiente_sin_luz: ${JSON.stringify(hallazgos)}`);
});

// ---------------------------------------------------------------------------
// 7. núcleo: puerta corredor→núcleo, hall→escalera, hall→ascensor; nunca
//    escalera→ascensor.
// ---------------------------------------------------------------------------
test("el núcleo recibe puerta desde el corredor y hall→escalera/hall→ascensor, pero no escalera→ascensor", () => {
  const rooms = [
    room("corredor", "pasillo", 0, 4, 6, 5.5),
    room("escalera", "core", 0, 0, 4, 2, { name: "escalera" }),
    room("ascensor", "core", 4, 0, 6, 2, { name: "ascensor" }),
    room("hallnucleo", "core", 0, 2, 6, 4, { name: "hall núcleo" }),
  ];
  const { muros, hallazgos, vanos } = correr(rooms);
  const puertas = vanos.filter((v) => v.tipo === "puerta");

  const corredorAHall = puertas.find((v) => v.entre.includes("corredor") && v.entre.includes("hallnucleo"));
  assert.ok(corredorAHall, "debe haber puerta corredor→hall núcleo");

  const hallAEscalera = puertas.find((v) => v.entre.includes("hallnucleo") && v.entre.includes("escalera"));
  assert.ok(hallAEscalera, "debe haber puerta hall→escalera");

  const hallAAscensor = puertas.find((v) => v.entre.includes("hallnucleo") && v.entre.includes("ascensor"));
  assert.ok(hallAAscensor, "debe haber puerta hall→ascensor");

  const escaleraAscensor = puertas.find((v) => v.entre.includes("escalera") && v.entre.includes("ascensor"));
  assert.equal(escaleraAscensor, undefined, "escalera contra ascensor NUNCA lleva puerta");

  assert.equal(hallazgos.filter((h) => h.roomId === "escalera" || h.roomId === "ascensor").length, 0);

  const muroEscAsc = muros.find((m) => [...m.lados].sort().join(",") === "ascensor,escalera");
  assert.equal(muroEscAsc.clase, "nucleo");
});

// ---------------------------------------------------------------------------
// 8. ningún vano cuelga de un muro sin_muro (dos tramos del mismo corredor)
// ---------------------------------------------------------------------------
test("ningún vano cuelga de un muro sin_muro", () => {
  const rooms = [
    room("corredor1", "pasillo", 0, 4, 4, 5.5),
    room("corredor2", "pasillo", 4, 4, 8, 5.5), // mismo espacio, partido en dos polígonos
    room("hall", "pasillo", 0, 0, 4, 4, { unitRef: "u1" }),
    room("sala", "social", 4, 0, 8, 4, { unitRef: "u1", name: "sala-comedor" }),
  ];
  const { muros, vanos } = correr(rooms);
  const sinMuro = muros.filter((m) => m.clase === "sin_muro").map((m) => m.id);
  assert.ok(sinMuro.length > 0, "la fixture debe producir al menos un muro sin_muro para que el test tenga sentido");
  assert.ok(vanos.every((v) => !sinMuro.includes(v.muroId)), "ningún vano puede colgar de un muro sin_muro");
});

// ---------------------------------------------------------------------------
// Planta típica real: dos unidades espalda con espalda + núcleo + corredor.
// Esta es la corrida que va en el reporte con la tabla completa de vanos.
// ---------------------------------------------------------------------------
function unidad(prefix, ox, unitRef) {
  return [
    room(`${prefix}-sala`, "social", ox + 0, 0, ox + 6, 3.5, { unitRef, name: "sala-comedor" }),
    room(`${prefix}-dormppal`, "dormitorio", ox + 6, 0, ox + 10, 3.5, { unitRef, name: "dormitorio principal" }),
    room(`${prefix}-dorm2`, "dormitorio", ox + 0, 3.5, ox + 5, 5.5, { unitRef, name: "dormitorio 2" }),
    room(`${prefix}-bano`, "baño", ox + 5, 3.5, ox + 7, 5.5, { unitRef, name: "baño" }),
    room(`${prefix}-cocina`, "cocina", ox + 7, 3.5, ox + 10, 5.5, { unitRef, name: "cocina" }),
    room(`${prefix}-hall`, "pasillo", ox + 0, 5.5, ox + 10, 7, { unitRef, name: "hall" }),
  ];
}

function plantaTipica() {
  const footprint = rect(0, 0, 20, 14.5);
  const rooms = [
    ...unidad("u1", 0, "u1"),
    ...unidad("u2", 10, "u2"),
    room("corredor", "pasillo", 0, 7, 20, 8.5),
    room("hallnucleo", "core", 8, 8.5, 12, 9.7, { name: "hall núcleo" }),
    room("escalera", "core", 8, 9.7, 10.4, 13.9, { name: "escalera" }),
    room("ascensor", "core", 10.4, 9.7, 12, 11.5, { name: "ascensor" }),
  ];
  return { rooms, contexto: { footprint, frontIdx: 0, lotType: "medianera" } };
}

test("planta típica real: dos unidades + núcleo + corredor — tabla de vanos para el reporte", () => {
  const { rooms, contexto } = plantaTipica();
  const { muros, avisosMuros, hallazgos, avisos, vanos } = correr(rooms, contexto);

  // conectividad por construcción: cada unidad, completa, alcanzable desde su entrada.
  for (const unitRef of ["u1", "u2"]) {
    const idsUnidad = rooms.filter((r) => r.unitRef === unitRef).map((r) => r.id);
    const entrada = vanos.find((v) => v.tipo === "puerta" && idsUnidad.includes(v.entre[1]) && `${v.entre[1]}`.endsWith("hall"));
    const rejoin = alcanzables(vanos, `${unitRef}-hall`);
    for (const id of idsUnidad) assert.ok(rejoin.has(id), `"${id}" debe ser alcanzable desde "${unitRef}-hall"`);
  }

  // núcleo: corredor→hall, hall→escalera, hall→ascensor, nunca escalera→ascensor.
  const puertas = vanos.filter((v) => v.tipo === "puerta");
  assert.ok(puertas.find((v) => v.entre.includes("corredor") && v.entre.includes("hallnucleo")));
  assert.ok(puertas.find((v) => v.entre.includes("hallnucleo") && v.entre.includes("escalera")));
  assert.ok(puertas.find((v) => v.entre.includes("hallnucleo") && v.entre.includes("ascensor")));
  assert.equal(puertas.find((v) => v.entre.includes("escalera") && v.entre.includes("ascensor")), undefined);

  console.log("\n[vanos.test.mjs] planta típica real — tabla de vanos:");
  console.log("tipo".padEnd(8), "ancho".padEnd(7), "entre");
  for (const v of [...vanos].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.entre[0].localeCompare(b.entre[0]))) {
    console.log(v.tipo.padEnd(8), String(v.ancho).padEnd(7), `${v.entre[0]} ${v.entre[1] ? "↔ " + v.entre[1] : "(fachada)"}`);
  }
  console.log(`\n[vanos.test.mjs] hallazgos (${hallazgos.length}):`);
  for (const h of hallazgos) console.log(` - ${h.codigo}: ${h.mensaje}`);
  console.log(`\n[vanos.test.mjs] avisos de vanos (${avisos.length}):`);
  for (const a of avisos) console.log(` - ${a}`);
});

// ---------------------------------------------------------------------------
// 5. invariante universal: TODO vano cae dentro de su muro con 0.15 m de
// holgura a cada lado — sobre TODOS los vanos de TODOS los casos de arriba.
// ---------------------------------------------------------------------------
test("todo vano de todos los casos queda dentro de su muro con 0.15 m de holgura", () => {
  assert.ok(universo.length > 0, "debe haber al menos un vano acumulado para que el test tenga sentido");
  for (const { vano, muro } of universo) {
    assert.ok(muro, `el vano ${vano.id} referencia un muro inexistente (${vano.muroId})`);
    assert.ok(vano.t - vano.ancho / 2 >= HOLGURA - 1e-6, `${vano.id}: t-ancho/2 = ${vano.t - vano.ancho / 2} < 0.15`);
    assert.ok(vano.t + vano.ancho / 2 <= muro.largo - HOLGURA + 1e-6, `${vano.id}: t+ancho/2 = ${vano.t + vano.ancho / 2} > largo-0.15 (${muro.largo - HOLGURA})`);
  }
});
