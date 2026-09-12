// El calce geométrico elige la tipología que MIDE parecido. No la que funciona: puede poner
// los dormitorios contra la medianera, dejar un cuarto sin puerta posible, o hacer que se
// entre por el dormitorio. Por eso se arma la planta de cada candidato y se cuenta lo que
// objeta el propio motor.
import test from "node:test";
import assert from "node:assert/strict";
import { materializeFloorProposal } from "../src/modules/cabida/floorProposal.js";
import { splitAcceptedFloor } from "../src/modules/planos/materialize.js";
import { resolverConAtlas, CANDIDATOS } from "../src/modules/planos/atlas/resolver.js";
import { construirMuros } from "../src/modules/planos/muros.js";
import { construirVanos } from "../src/modules/planos/vanos.js";

const H = [{ x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 14.5 }, { x: 0, y: 14.5 }];
const UNITS = [
  { id: "A", banda: 1, orden: 1, ancho: 6.5, dormitorios: 2, banos: 2 },
  { id: "B", banda: 1, orden: 2, ancho: 6.5, dormitorios: 2, banos: 2 },
  { id: "C", banda: 1, orden: 3, ancho: 6, dormitorios: 1, banos: 1 },
  { id: "D", banda: 2, orden: 1, ancho: 7, dormitorios: 3, banos: 2 },
];
const piso = () => {
  const prop = materializeFloorProposal({
    parti: { crujias: 2, corredorProfundidad: 1.6, core: { ancho: 5, longitud: 5, distanciaAlFrente: 0 }, units: UNITS },
    footprint: H, frontIdx: 0, sourceCabidaVersionId: "cv", summary: {}, assumptions: [], tradeoffs: [],
  });
  return splitAcceptedFloor(prop.floor);
};
const hallazgosDelPiso = (lockedRooms, rooms) => {
  const todos = [...lockedRooms, ...rooms];
  const ctx = { footprint: H, frontIdx: 0, lotType: "medianero" };
  const { muros } = construirMuros(todos, ctx);
  return construirVanos(muros, todos, ctx).hallazgos;
};

test("elegir por hallazgos produce una planta mejor que elegir por calce", () => {
  const { units, lockedRooms } = piso();
  const conCorreccion = resolverConAtlas({ units, footprint: H, lockedRooms });
  // sin lockedRooms el resolvedor no puede evaluar candidatos y cae al primero por calce
  const sinCorreccion = resolverConAtlas({ units, footprint: H });
  const a = hallazgosDelPiso(lockedRooms, conCorreccion.rooms).length;
  const b = hallazgosDelPiso(lockedRooms, sinCorreccion.rooms).length;
  assert.ok(a <= b, `corregir empeoró la planta: ${a} hallazgos contra ${b}`);
});

test("los hallazgos graves de circulación se resuelven solos", () => {
  const { units, lockedRooms } = piso();
  const { rooms } = resolverConAtlas({ units, footprint: H, lockedRooms });
  const h = hallazgosDelPiso(lockedRooms, rooms);
  for (const codigo of ["ambiente_inaccesible", "unidad_sin_acceso", "entrada_por_dormitorio"]) {
    assert.deepEqual(h.filter((x) => x.codigo === codigo), [],
      `quedó "${codigo}" habiendo ${CANDIDATOS} candidatos para probar`);
  }
});

test("cada unidad reporta cuántos candidatos probó y con cuántos hallazgos quedó", () => {
  const { units, lockedRooms } = piso();
  const { resultados } = resolverConAtlas({ units, footprint: H, lockedRooms });
  for (const r of resultados.filter((x) => x.ok)) {
    assert.ok(Number.isInteger(r.hallazgos), `${r.unitRef} no dice con cuántos hallazgos quedó`);
    assert.ok(r.candidatosProbados >= 1, `${r.unitRef} no dice cuántos candidatos probó`);
  }
});

test("la corrección no cuesta una llamada de agente ni tarda", () => {
  const { units, lockedRooms } = piso();
  const t0 = Date.now();
  resolverConAtlas({ units, footprint: H, lockedRooms });
  assert.ok(Date.now() - t0 < 3000, "evaluar candidatos tiene que ser barato: es geometría pura");
});
