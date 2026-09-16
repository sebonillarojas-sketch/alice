import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirTurno, construirSystem } from "../src/mica/motor.js";

const p = (texto) => ({ rol: "prospecto", texto });
const CAT = [{ id: "OLVR-01", tipologias: [{ nombre: "flat", dormitorios: 2 }] }];

test("con un saludo, Mica conversa", () => {
  assert.equal(decidirTurno({ mensajes: [p("Hola, vi el proyecto")] }).tipo, "conversar");
});

test("cuando piden planos o precios, el turno es handoff", () => {
  const d = decidirTurno({ mensajes: [p("me pasas los planos y precios?")] });
  assert.equal(d.tipo, "handoff");
});

test("después del handoff Mica no vuelve a derivar — mantiene el hilo tibio", () => {
  const d = decidirTurno({ mensajes: [p("y el precio?")], estado: { etapa: "handoff" } });
  assert.equal(d.tipo, "mantener");
});

test("el turno viaja con la temperatura y su evidencia", () => {
  const d = decidirTurno({ mensajes: [p("busco algo de 80 m2")] });
  assert.equal(d.temperatura, "tibio");
  assert.equal(d.evidencia, "busco algo de 80 m2");
});

test("el system prompt lleva la regla dura, palabra por palabra", () => {
  const s = construirSystem({ catalogo: CAT });
  assert.match(s, /nunca env[íi]a planos ni dice un precio/i);
});

test("el system prompt solo conoce los proyectos del catálogo", () => {
  const s = construirSystem({ catalogo: CAT });
  assert.match(s, /OLVR-01/);
  assert.doesNotMatch(s, /San Antonio/);
});

test("sin catálogo, el system le prohíbe nombrar proyectos en vez de inventarlos", () => {
  const s = construirSystem({ catalogo: [] });
  assert.match(s, /no (tienes|tenés) cat[áa]logo/i);
});
