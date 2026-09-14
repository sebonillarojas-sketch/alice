// El prompt de Tweedledee dice que la validación determinística es autoridad sobre lo que
// enumera. Si no le pasamos los hallazgos del grafo, el crítico gasta sus seis hallazgos
// repitiendo que un dormitorio no tiene fachada — justo lo que el motor detecta solo.
import test from "node:test";
import assert from "node:assert/strict";
import { serializeHallazgos, unirValidacion } from "../src/modules/planos/architecture.js";

test("los hallazgos del grafo se traducen al formato de la validación", () => {
  const f = serializeHallazgos([
    { codigo: "ambiente_inaccesible", roomId: "u1:dorm", mensaje: "no se llega" },
    { codigo: "sin_muro_para_puerta", roomId: "u1:baño", mensaje: "muro corto" },
  ]);
  assert.equal(f[0].severity, "critical", "un ambiente al que no se llega es crítico");
  assert.equal(f[1].severity, "minor", "un muro corto para la puerta es menor");
  assert.equal(f[0].code, "ambiente_inaccesible");
  assert.equal(f[0].targetId, "u1:dorm");
});

test("unir no duplica lo que la validación ya reportaba", () => {
  const v = { ok: false, total: 1, findings: [{ code: "unreachable_room", targetId: "u1:dorm", severity: "major" }], messages: [] };
  const u = unirValidacion(v, [
    { codigo: "unreachable_room", roomId: "u1:dorm", mensaje: "repetido" },
    { codigo: "ambiente_sin_luz", roomId: "u1:sala", mensaje: "nuevo" },
  ]);
  assert.equal(u.total, 2, "el repetido no entra dos veces");
  assert.ok(u.findings.some((f) => f.code === "ambiente_sin_luz"));
});

test("una planta con hallazgos del grafo NO se declara ok", () => {
  const u = unirValidacion({ ok: true, total: 0, findings: [], messages: [] },
    [{ codigo: "ambiente_sin_luz", roomId: "u1:dorm", mensaje: "" }]);
  assert.equal(u.ok, false, "decirle al crítico que está todo bien cuando no lo está es lo peor que se puede hacer");
});

test("sin hallazgos la validación pasa intacta", () => {
  const v = { ok: true, total: 0, findings: [], messages: ["todo bien"] };
  const u = unirValidacion(v, []);
  assert.equal(u.ok, true);
  assert.deepEqual(u.messages, ["todo bien"], "no se le agrega ruido");
});

test("el ciclo del editor le pasa los hallazgos al crítico", async () => {
  const { readFileSync } = await import("node:fs");
  const ed = readFileSync(new URL("../src/modules/planos/EditorPlanos.jsx", import.meta.url), "utf8");
  assert.match(ed, /unirValidacion\([\s\S]{0,260}resolvedFloor\.hallazgos/,
    "el crítico tiene que recibir lo que el motor ya midió");
});
