// El camino que corre en el editor: una planta aceptada de Cabida entra, y el atlas
// resuelve los interiores que puede. Lo que no cubre queda marcado con su motivo para
// que lo atienda Tweedledum.
import test from "node:test";
import assert from "node:assert/strict";
import { materializeFloorProposal } from "../src/modules/cabida/floorProposal.js";
import { splitAcceptedFloor } from "../src/modules/planos/materialize.js";
import { resolverConAtlas, sobreDeUnidad, DEFORMACION_MAX } from "../src/modules/planos/atlas/resolver.js";
import { construirMuros } from "../src/modules/planos/muros.js";
import { construirVanos } from "../src/modules/planos/vanos.js";

const HUELLA = [{ x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 14.5 }, { x: 0, y: 14.5 }];
const piso = (units) => {
  const prop = materializeFloorProposal({
    parti: { crujias: 2, corredorProfundidad: 1.6, core: { ancho: 5, longitud: 5, distanciaAlFrente: 0 }, units },
    footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: "cv", summary: {}, assumptions: [], tradeoffs: [],
  });
  return splitAcceptedFloor(prop.floor);
};
const MERCADO = [
  { id: "A", banda: 1, orden: 1, ancho: 6.5, dormitorios: 2, banos: 2 },
  { id: "B", banda: 1, orden: 2, ancho: 6.5, dormitorios: 2, banos: 2 },
  { id: "C", banda: 1, orden: 3, ancho: 6, dormitorios: 1, banos: 1 },
  { id: "D", banda: 2, orden: 1, ancho: 7, dormitorios: 3, banos: 2 },
];

test("el atlas resuelve los interiores de un piso de tamaños de mercado", () => {
  const { units } = piso(MERCADO);
  const { rooms, resultados } = resolverConAtlas({ units, footprint: HUELLA });
  assert.ok(rooms.length > 0, "tiene que producir ambientes");
  const ok = resultados.filter((r) => r.ok);
  assert.ok(ok.length >= 3, `debería resolver casi todas, resolvió ${ok.length}/${resultados.length}`);
  for (const r of ok) {
    assert.ok(r.deformacion <= DEFORMACION_MAX, `${r.unitRef} entregada con deformación ${r.deformacion}`);
    assert.ok(r.tipologia, `${r.unitRef} sin decir de qué tipología salió`);
  }
});

test("cada ambiente queda dentro del sobre de su unidad", () => {
  const { units } = piso(MERCADO);
  const { rooms } = resolverConAtlas({ units, footprint: HUELLA });
  const porRef = new Map(units.map((u) => [u.unitRef, sobreDeUnidad(u, HUELLA)]));
  for (const r of rooms) {
    const s = porRef.get(r.unitRef); if (!s) continue;
    for (const p of r.pts) {
      assert.ok(p.x >= s.x0 - 0.06 && p.x <= s.x0 + s.ancho + 0.06
             && p.y >= s.y0 - 0.06 && p.y <= s.y0 + s.fondo + 0.06,
        `"${r.name}" de ${r.unitRef} se sale de su sobre`);
    }
  }
});

test("un sobre que no corresponde a su programa NO se entrega deformado", () => {
  // un 1D con casi 100 m² de envolvente: ningún 1D real del mercado entra sin estirarse
  const { units } = piso([{ id: "X", banda: 1, orden: 1, ancho: 15.5, dormitorios: 1, banos: 1 }]);
  const { resultados } = resolverConAtlas({ units, footprint: HUELLA });
  const r = resultados[0];
  assert.equal(r.ok, false, "tiene que rebotar, no entregar una planta estirada al doble");
  assert.match(r.motivo, /deformarlo|calza/, `motivo poco claro: ${r.motivo}`);
});

test("lo que resuelve el atlas sirve para derivar muros y puertas", () => {
  // es la prueba de la costura: sin cerrarJuntas los ambientes no se tocan, no hay muro
  // compartido, y ninguna puerta se puede abrir.
  const { units, lockedRooms } = piso(MERCADO);
  const { rooms } = resolverConAtlas({ units, footprint: HUELLA });
  const todos = [...lockedRooms, ...rooms];
  const { muros } = construirMuros(todos, { footprint: HUELLA, frontIdx: 0, lotType: "medianero" });
  const { vanos } = construirVanos(muros, todos, { footprint: HUELLA, frontIdx: 0 });
  assert.ok(muros.some((m) => m.clase === "interior"),
    "tiene que haber muros interiores: si no, los ambientes no se están tocando");
  assert.ok(vanos.filter((v) => v.tipo !== "ventana").length >= units.length,
    "al menos una puerta por unidad");
});
