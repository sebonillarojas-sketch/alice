// Tarea 3 (§9 del spec) — helpers puros de dibujo de muros/vanos derivados.
// EditorPlanos.jsx es JSX y no se puede levantar en node --test sin herramientas nuevas
// (no hay jsdom/RTL en el repo y no se agregan dependencias para esto), así que la parte
// de la Tarea 3 que puede fijarse con una prueba real vive en muroDibujo.js, un módulo
// puro que EditorPlanos.jsx importa y usa directamente (ver editor-muros-dibujo.test.mjs
// para la verificación de que el camino de producción lo usa).
import test from "node:test";
import assert from "node:assert/strict";
import { esMuroGrueso, grosorDeMuro, muroEsVisible, refDeVano, simboloDeVano } from "../src/modules/planos/muroDibujo.js";

test("jerarquía de línea: perimetral/estructural es grueso, tabique es delgado", () => {
  for (const clase of ["medianera", "fachada", "fachada_patio", "entre_unidades", "nucleo"]) {
    assert.equal(esMuroGrueso(clase), true, `${clase} debería ser grueso`);
  }
  for (const clase of ["interior", "a_corredor", "a_nucleo"]) {
    assert.equal(esMuroGrueso(clase), false, `${clase} debería ser delgado`);
  }
});

test("grosorDeMuro escala proporcional al espesor base configurado, no a un valor fijo", () => {
  assert.equal(grosorDeMuro("fachada", 0.20), 0.20);
  assert.equal(grosorDeMuro("interior", 0.20), 0.20 * 0.6);
  assert.ok(grosorDeMuro("fachada", 0.20) > grosorDeMuro("interior", 0.20), "el grueso debe distinguirse del delgado a la vista");
});

test('"sin_muro" no llega al dibujo — el resto de las clases sí, incluida interior_ciego', () => {
  assert.equal(muroEsVisible({ clase: "sin_muro" }), false);
  for (const clase of ["interior", "a_corredor", "a_nucleo", "medianera", "fachada", "fachada_patio", "entre_unidades", "nucleo", "interior_ciego"]) {
    assert.equal(muroEsVisible({ clase }), true, `${clase} sí debe dibujarse`);
  }
  assert.doesNotThrow(() => muroEsVisible(undefined), "no debe reventar si el muro falta");
});

test("refDeVano elige el símbolo existente correcto por tipo y ancho real del vano", () => {
  assert.equal(refDeVano({ tipo: "puerta", ancho: 0.80 }), "puerta-80");
  assert.equal(refDeVano({ tipo: "puerta", ancho: 0.90 }), "puerta-90");
  assert.equal(refDeVano({ tipo: "puerta", ancho: 1.00 }), "puerta-90"); // social: no hay puerta-100 en el catálogo
  assert.equal(refDeVano({ tipo: "ventana", ancho: 1.20 }), "ventana-120");
  assert.equal(refDeVano({ tipo: "ventana", ancho: 1.80 }), "ventana-180");
  assert.equal(refDeVano({ tipo: "otracosa", ancho: 1.00 }), "vano-100");
});

// La convención de ángulo (criterio de aceptación #4 del pliego): resolverVano devuelve
// atan2(dy,dx) en coordenadas del MUNDO. EditorPlanos.jsx NO invierte el eje Y en
// toScreen (ver el comentario de muroDibujo.js y editor-muros-dibujo.test.mjs, que lo
// verifica contra el código real), así que ese ángulo se pasa TAL CUAL como `rot`.
test("convención de ángulo: puerta sobre muro horizontal -> rot 0°", () => {
  const muro = { id: "m1", a: { x: 0, y: 2 }, b: { x: 4, y: 2 }, clase: "interior", largo: 4 };
  const vano = { id: "v1", muroId: "m1", t: 2, ancho: 0.8, tipo: "puerta", entre: ["a", "b"] };
  const s = simboloDeVano(vano, muro, 0.15);
  assert.equal(s.rot, 0);
  assert.equal(s.ref, "puerta-80");
  assert.ok(Math.abs(s.centro.x - 2) < 1e-9 && Math.abs(s.centro.y - 2) < 1e-9);
});

test("convención de ángulo: puerta sobre muro vertical -> rot 90°, no -90°", () => {
  const muro = { id: "m2", a: { x: 5, y: 0 }, b: { x: 5, y: 4 }, clase: "interior", largo: 4 };
  const vano = { id: "v2", muroId: "m2", t: 2, ancho: 0.8, tipo: "puerta", entre: ["a", "b"] };
  const s = simboloDeVano(vano, muro, 0.15);
  assert.equal(s.rot, 90);
});

test("convención de ángulo: muro vertical en sentido contrario -> rot -90°", () => {
  const muro = { id: "m3", a: { x: 5, y: 4 }, b: { x: 5, y: 0 }, clase: "interior", largo: 4 };
  const vano = { id: "v3", muroId: "m3", t: 2, ancho: 0.8, tipo: "puerta", entre: ["a", "b"] };
  const s = simboloDeVano(vano, muro, 0.15);
  assert.equal(s.rot, -90);
});

test("simboloDeVano usa el espesor por CLASE del muro, no un valor fijo global", () => {
  const muroGrueso = { id: "mg", a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, clase: "fachada", largo: 4 };
  const muroDelgado = { id: "md", a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, clase: "interior", largo: 4 };
  const vano = { id: "v4", muroId: "mg", t: 2, ancho: 1.2, tipo: "ventana", entre: ["r", null] };
  const sGrueso = simboloDeVano(vano, muroGrueso, 0.15);
  const sDelgado = simboloDeVano({ ...vano, muroId: "md" }, muroDelgado, 0.15);
  assert.ok(sGrueso.d > sDelgado.d, "el vano sobre un muro grueso debe dibujarse más profundo");
});

test("simboloDeVano no revienta si el vano o el muro faltan", () => {
  assert.equal(simboloDeVano(null, null, 0.15), null);
  assert.equal(simboloDeVano({ id: "x" }, null, 0.15), null);
});
