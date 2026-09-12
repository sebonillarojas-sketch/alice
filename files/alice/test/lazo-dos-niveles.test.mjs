// Spec §6.3: cuando el interior no cierra, con frecuencia el problema no es el interior
// sino el reparto. Un dormitorio sin fachada no se arregla eligiendo otra tipología —
// ninguna tiene ventanas donde no hay fachada — así que el hallazgo tiene que VOLVER a
// Cabida, que es donde se decide el ancho de las unidades y la posición del núcleo.
import test from "node:test";
import assert from "node:assert/strict";
import { separarPorNivel, diagnosticoDeVolumen, registrarDiagnosticoVolumen } from "../src/modules/cabida/floorProposal.js";

const H = [
  { codigo: "ambiente_sin_luz", roomId: "unit-1:dormitorio 2", mensaje: "" },
  { codigo: "ambiente_sin_luz", roomId: "unit-1:dormitorio 3", mensaje: "" },
  { codigo: "ambiente_sin_luz", roomId: "unit-1:sala", mensaje: "" },
  { codigo: "sin_muro_para_puerta", roomId: "unit-2:baño", mensaje: "" },
  { codigo: "unidad_sin_acceso", roomId: "unit-4", mensaje: "" },
];

test("separa lo que le toca a Cabida de lo que se queda en Planos", () => {
  const { volumen, interior } = separarPorNivel(H);
  assert.equal(volumen.length, 4);
  assert.deepEqual(interior.map((h) => h.codigo), ["sin_muro_para_puerta"],
    "un muro corto para una puerta SÍ se arregla en el interior: no sube");
});

test("agrupa por unidad y da una recomendación de reparto, no la lista cruda", () => {
  const d = diagnosticoDeVolumen(H);
  assert.equal(d.length, 2, "dos unidades con problemas de volumen");
  assert.equal(d[0].unidad, "unit-1", "ordenado por gravedad");
  assert.match(d[0].recomendacion, /profunda|ancho|patio/,
    "tiene que decir qué hacer en Cabida, no repetir el síntoma");
  assert.match(d.find((x) => x.unidad === "unit-4").recomendacion, /corredor|núcleo/);
});

test("un sobre que no corresponde a su programa se lee como problema de reparto", () => {
  const d = diagnosticoDeVolumen([
    { codigo: "calce_deformado", roomId: "unit-9", mensaje: "hay que deformarlo 1.95x" },
  ]);
  assert.match(d[0].recomendacion, /no corresponde a su programa|ancho/);
});

test("el diagnóstico queda guardado en la propuesta, no en el aire", () => {
  const project = { id: "p1", cabida: { floorProposals: [
    { id: "floor_p1_v1", version: 1 }, { id: "floor_p1_v2", version: 2 },
  ] } };
  const next = registrarDiagnosticoVolumen(project, "floor_p1_v2", H);
  const v2 = next.cabida.floorProposals.find((x) => x.id === "floor_p1_v2");
  const v1 = next.cabida.floorProposals.find((x) => x.id === "floor_p1_v1");
  assert.ok(v2.diagnosticoVolumen?.length, "la propuesta apuntada lo guarda");
  assert.ok(v2.diagnosticoAt, "con su fecha");
  assert.equal(v1.diagnosticoVolumen, undefined, "y las otras quedan intactas");
  assert.notEqual(next, project, "sin mutar el proyecto original");
});

test("sin hallazgos de volumen el diagnóstico queda vacío, no inventa objeciones", () => {
  const d = diagnosticoDeVolumen([{ codigo: "sin_muro_para_puerta", roomId: "unit-1:baño" }]);
  assert.deepEqual(d, []);
});
