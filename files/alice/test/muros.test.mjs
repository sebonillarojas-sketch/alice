import test from "node:test";
import assert from "node:assert/strict";
import { construirMuros } from "../src/modules/planos/muros.js";
import { perimeter } from "../src/modules/planos/geometry.js";

const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

const findAll = (muros, lados) => {
  const key = [...lados].sort().join(",");
  return muros.filter((m) => [...m.lados].sort().join(",") === key);
};
const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// suma de perímetros SOLO de ambientes reales (no void): un void no tiene muros
// propios, por eso construirMuros tampoco lo cuenta — ver comentario en muros.js.
const perimetroAmbientes = (rooms) => sum(rooms.filter((r) => r.tipo !== "void").map((r) => perimeter(r.pts)));

test("dos ambientes que comparten una arista completa producen un solo muro", () => {
  const rooms = [
    { id: "A", tipo: "unidad", unitRef: "u1", pts: rect(0, 0, 4, 4) },
    { id: "B", tipo: "unidad", unitRef: "u1", pts: rect(4, 0, 8, 4) },
  ];
  const { muros } = construirMuros(rooms, {});
  const compartidos = findAll(muros, ["A", "B"]);
  assert.equal(compartidos.length, 1, "debe fundir en un único muro, no dos");
  assert.equal(compartidos[0].clase, "interior");
  assert.equal(compartidos[0].largo, 4);
});

test("solape parcial: un corredor de 9 m contra tres unidades de 3 m produce tres tramos compartidos", () => {
  const rooms = [
    { id: "corredor", tipo: "pasillo", pts: rect(0, 0, 9, 1.5) },
    { id: "u1", tipo: "unidad", unitRef: "u1", pts: rect(0, 1.5, 3, 4.5) },
    { id: "u2", tipo: "unidad", unitRef: "u2", pts: rect(3, 1.5, 6, 4.5) },
    { id: "u3", tipo: "unidad", unitRef: "u3", pts: rect(6, 1.5, 9, 4.5) },
  ];
  const { muros } = construirMuros(rooms, {});
  const c1 = findAll(muros, ["corredor", "u1"]);
  const c2 = findAll(muros, ["corredor", "u2"]);
  const c3 = findAll(muros, ["corredor", "u3"]);
  assert.equal(c1.length, 1); assert.equal(c1[0].largo, 3); assert.equal(c1[0].clase, "a_corredor");
  assert.equal(c2.length, 1); assert.equal(c2[0].largo, 3); assert.equal(c2[0].clase, "a_corredor");
  assert.equal(c3.length, 1); assert.equal(c3[0].largo, 3); assert.equal(c3[0].clase, "a_corredor");
  // el corredor NO debe quedar partido en un único muro de 9m contra "nadie":
  // partir por todos los extremos del grupo es justo lo que produce estos 3 tramos.
  assert.equal(sum([c1[0].largo, c2[0].largo, c3[0].largo]), 9);
});

test("un toque de esquina de 0.10 m no produce muro compartido, y las aristas reales se vuelven a unir", () => {
  const rooms = [
    { id: "A", tipo: "social", pts: rect(0, 0, 2, 2) },
    { id: "B", tipo: "social", pts: [{ x: 2, y: 1.9 }, { x: 4, y: 1.9 }, { x: 4, y: 3.9 }, { x: 2, y: 3.9 }] },
  ];
  const { muros, avisos } = construirMuros(rooms, {});
  assert.equal(findAll(muros, ["A", "B"]).length, 0, "no debe existir un muro compartido A-B");
  assert.ok(avisos.some((a) => a.includes("toque de esquina")), "debe avisar la decisión");
  // A y B deben conservar su arista real completa (2 m) sobre la línea x=2, sin
  // quedar picada en dos pedacitos de 1.9 y 0.1 por culpa del toque de esquina.
  const enLineaX2 = (m) => Math.abs(m.a.x - 2) < 1e-9 && Math.abs(m.b.x - 2) < 1e-9;
  const bordeA = findAll(muros, ["A"]).find(enLineaX2);
  const bordeB = findAll(muros, ["B"]).find(enLineaX2);
  assert.ok(bordeA, "el borde derecho de A debe existir sobre x=2");
  assert.equal(bordeA.largo, 2, "el borde de A debe re-unirse en un solo tramo de 2m");
  assert.ok(bordeB, "el borde izquierdo de B debe existir sobre x=2");
  assert.equal(bordeB.largo, 2, "el borde de B debe re-unirse en un solo tramo de 2m");
});

test("tramos elementales consecutivos con los mismos lados y clase se vuelven a unir", () => {
  // B tiene un vértice redundante (colineal) a mitad de su lado compartido con A:
  // sin la re-unión del §5.5, esto pica el muro en dos.
  const rooms = [
    { id: "A", tipo: "unidad", unitRef: "u1", pts: rect(0, 0, 10, 5) },
    {
      id: "B", tipo: "unidad", unitRef: "u1",
      pts: [{ x: 0, y: 5 }, { x: 6, y: 5 }, { x: 10, y: 5 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    },
  ];
  const { muros } = construirMuros(rooms, {});
  const compartidos = findAll(muros, ["A", "B"]);
  assert.equal(compartidos.length, 1, "el vértice redundante no debe partir el muro fundido");
  assert.equal(compartidos[0].largo, 10);
  assert.equal(compartidos[0].clase, "interior");
});

test("tres ambientes superpuestos producen un aviso, no una excepción", () => {
  const rooms = [
    { id: "A", tipo: "unidad", unitRef: "uA", pts: rect(0, 0, 5, 3) },
    { id: "B", tipo: "unidad", unitRef: "uB", pts: rect(0, 3, 5, 6) },
    // C se superpone inválidamente sobre el mismo eje y=3, entre x=1 y x=4
    { id: "C", tipo: "unidad", unitRef: "uC", pts: [{ x: 1, y: 2.9 }, { x: 4, y: 2.9 }, { x: 4, y: 3 }, { x: 1, y: 3 }] },
  ];
  assert.doesNotThrow(() => construirMuros(rooms, {}));
  const { muros, avisos } = construirMuros(rooms, {});
  assert.ok(avisos.some((a) => a.includes("ambientes superpuestos") && a.includes("A") && a.includes("B") && a.includes("C")));
  // se descarta C y se funde A-B en un solo muro de 5m (entre_unidades, unitRef distinto)
  const ab = findAll(muros, ["A", "B"]);
  assert.equal(ab.length, 1);
  assert.equal(ab[0].largo, 5);
  assert.equal(ab[0].clase, "entre_unidades");
});

test("clase fachada_patio: un ambiente contra un void da luz por ahí", () => {
  const rooms = [
    { id: "R", tipo: "unidad", unitRef: "uR", pts: rect(0, 0, 5, 3) },
    { id: "patio", tipo: "void", name: "patio de luz", pts: rect(5, 0, 7, 3) },
  ];
  const { muros } = construirMuros(rooms, {});
  const m = findAll(muros, ["R"]).filter((w) => w.clase === "fachada_patio");
  assert.equal(m.length, 1);
  assert.equal(m[0].largo, 3);
});

test("interior_ciego: un borde de un solo ambiente que no toca huella ni patio es un hallazgo", () => {
  const rooms = [{ id: "R", tipo: "social", pts: rect(0, 0, 4, 4) }];
  const { muros, avisos } = construirMuros(rooms, {});
  assert.ok(muros.every((m) => m.clase === "interior_ciego"));
  assert.ok(avisos.some((a) => a.includes("interior_ciego")));
});

test("lote esquina: la calle lateral (frontIdx+1) también es fachada, no medianera", () => {
  const footprint = rect(0, 0, 31, 14.5);
  const room = { id: "E", tipo: "unidad", unitRef: "uE", pts: rect(25, 0, 31, 5) };
  const medianera = construirMuros([room], { footprint, frontIdx: 0, lotType: "medianera" });
  const esquina = construirMuros([room], { footprint, frontIdx: 0, lotType: "esquina" });
  const ladoDerechoM = medianera.muros.find((m) => Math.abs(m.a.x - 31) < 1e-6 && Math.abs(m.b.x - 31) < 1e-6);
  const ladoDerechoE = esquina.muros.find((m) => Math.abs(m.a.x - 31) < 1e-6 && Math.abs(m.b.x - 31) < 1e-6);
  assert.equal(ladoDerechoM.clase, "medianera");
  assert.equal(ladoDerechoE.clase, "fachada");
});

test("la suma de largos de muro no crece al fundir (nunca supera la suma de perímetros)", () => {
  const casos = [
    [
      { id: "A", tipo: "unidad", unitRef: "u1", pts: rect(0, 0, 4, 4) },
      { id: "B", tipo: "unidad", unitRef: "u1", pts: rect(4, 0, 8, 4) },
    ],
    [
      { id: "corredor", tipo: "pasillo", pts: rect(0, 0, 9, 1.5) },
      { id: "u1", tipo: "unidad", unitRef: "u1", pts: rect(0, 1.5, 3, 4.5) },
      { id: "u2", tipo: "unidad", unitRef: "u2", pts: rect(3, 1.5, 6, 4.5) },
      { id: "u3", tipo: "unidad", unitRef: "u3", pts: rect(6, 1.5, 9, 4.5) },
    ],
    [
      { id: "A", tipo: "social", pts: rect(0, 0, 2, 2) },
      { id: "B", tipo: "social", pts: [{ x: 2, y: 1.9 }, { x: 4, y: 1.9 }, { x: 4, y: 3.9 }, { x: 2, y: 3.9 }] },
    ],
    [
      { id: "A", tipo: "unidad", unitRef: "uA", pts: rect(0, 0, 5, 3) },
      { id: "B", tipo: "unidad", unitRef: "uB", pts: rect(0, 3, 5, 6) },
      { id: "C", tipo: "unidad", unitRef: "uC", pts: [{ x: 1, y: 2.9 }, { x: 4, y: 2.9 }, { x: 4, y: 3 }, { x: 1, y: 3 }] },
    ],
  ];
  for (const rooms of casos) {
    const { muros } = construirMuros(rooms, {});
    const largoMuros = sum(muros.map((m) => m.largo));
    const largoPerimetros = perimetroAmbientes(rooms);
    assert.ok(largoMuros <= largoPerimetros + 1e-6, `${largoMuros} debería ser <= ${largoPerimetros}`);
  }
});

test("ambiente sin polígono válido se descarta con aviso, sin romper la corrida", () => {
  const rooms = [
    { id: "A", tipo: "unidad", unitRef: "u1", pts: rect(0, 0, 4, 4) },
    { id: "roto", tipo: "unidad", pts: [{ x: 0, y: 0 }] },
  ];
  const { muros, avisos } = construirMuros(rooms, {});
  assert.ok(avisos.some((a) => a.includes("roto")));
  assert.ok(muros.length > 0);
});

test("geometría real: huella 31x14.5, dos bandas con corredor — clasificación de arquitecto", () => {
  const footprint = rect(0, 0, 31, 14.5);
  const frontIdx = 0;
  const rooms = [
    { id: "corredor", tipo: "pasillo", pts: rect(0, 6.5, 31, 8.0) },
    { id: "u1", tipo: "unidad", unitRef: "u1", pts: rect(0, 0, 10, 6.5) },
    { id: "u2", tipo: "unidad", unitRef: "u2", pts: rect(10, 0, 21, 6.5) },
    { id: "u3", tipo: "unidad", unitRef: "u3", pts: rect(21, 0, 31, 6.5) },
    { id: "u4", tipo: "unidad", unitRef: "u4", pts: rect(0, 8.0, 10, 14.5) },
    { id: "u5", tipo: "unidad", unitRef: "u5", pts: rect(10, 8.0, 21, 14.5) },
    { id: "u6", tipo: "unidad", unitRef: "u6", pts: rect(21, 8.0, 31, 14.5) },
  ];
  const { muros, avisos } = construirMuros(rooms, { footprint, frontIdx, lotType: "medianera" });

  const porClase = (c) => muros.filter((m) => m.clase === c);
  const fachada = porClase("fachada");
  const medianera = porClase("medianera");
  const aCorredor = porClase("a_corredor");
  const entreUnidades = porClase("entre_unidades");

  // fachada al frente (y=0, las 3 unidades) y al fondo (y=14.5, retiro posterior
  // obligatorio: da a un área libre propia, no a un vecino — admite vanos).
  assert.equal(fachada.length, 6);
  assert.equal(sum(fachada.map((m) => m.largo)), 31 * 2);

  // medianeras a los lados (x=0 y x=31): cada unidad de borde + el tapón del
  // corredor, ninguna se abre jamás.
  assert.equal(medianera.length, 6);
  assert.equal(sum(medianera.map((m) => m.largo)), (6.5 + 1.5 + 6.5) * 2);

  // a_corredor en el pasillo, partido por unidad a cada lado (6 tramos: 3+3)
  assert.equal(aCorredor.length, 6);
  assert.equal(sum(aCorredor.map((m) => m.largo)), 31 * 2);

  // entre_unidades separa unidades vecinas dentro de cada banda (nunca se abre)
  assert.equal(entreUnidades.length, 4);
  assert.equal(sum(entreUnidades.map((m) => m.largo)), 6.5 * 4);

  // sin hallazgos raros: cada muro de esta planta cae en una de las 4 clases de arriba
  assert.equal(muros.length, fachada.length + medianera.length + aCorredor.length + entreUnidades.length);
  assert.equal(avisos.length, 0, `no debería haber avisos en una planta limpia: ${avisos.join(" | ")}`);

  // --- tabla para el reporte ---
  console.log("\n[muros.test.mjs] tabla de muros — geometría real 31x14.5:");
  console.log("clase".padEnd(14), "largo".padEnd(8), "lados");
  for (const m of [...muros].sort((a, b) => a.clase.localeCompare(b.clase) || a.largo - b.largo)) {
    console.log(m.clase.padEnd(14), String(m.largo).padEnd(8), m.lados.join(" | "));
  }
});
