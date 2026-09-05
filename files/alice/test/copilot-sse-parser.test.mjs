import { test } from "node:test";
import assert from "node:assert/strict";
import { crearParserSSE } from "../src/copilot/sseParser.js";

function recolectar() {
  const vistos = [];
  return { vistos, parser: crearParserSSE((e) => vistos.push(e)) };
}

test("parsea un frame completo", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: text_delta\ndata: {"text":"hola"}\n\n');
  assert.deepEqual(vistos, [{ event: "text_delta", data: { text: "hola" } }]);
});

test("parsea varios frames en un solo chunk", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\n');
  assert.equal(vistos.length, 2);
  assert.equal(vistos[1].data.n, 2);
});

test("un frame partido entre dos chunks se reensambla", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: text_delta\nda');
  assert.equal(vistos.length, 0, "no debe emitir un frame incompleto");
  parser.alimentar('ta: {"text":"hola"}\n\n');
  assert.deepEqual(vistos, [{ event: "text_delta", data: { text: "hola" } }]);
});

test("un frame partido en el medio del JSON se reensambla", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: done\ndata: {"text":"la cabi');
  parser.alimentar('da da 42 dptos"}\n\n');
  assert.equal(vistos[0].data.text, "la cabida da 42 dptos");
});

test("ignora los comentarios de latido", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar(': ping\n\nevent: done\ndata: {}\n\n');
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0].event, "done");
});

test("un data mal formado no rompe el stream: se saltea y sigue", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: roto\ndata: {no soy json\n\nevent: done\ndata: {}\n\n');
  assert.deepEqual(vistos.map(v => v.event), ["done"]);
});

test("un frame sin event se ignora", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('data: {"text":"huérfano"}\n\nevent: done\ndata: {}\n\n');
  assert.deepEqual(vistos.map(v => v.event), ["done"]);
});

test("los acentos y emojis sobreviven", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event: text_delta\ndata: {"text":"cabida · 42 dptos 🏗"}\n\n');
  assert.equal(vistos[0].data.text, "cabida · 42 dptos 🏗");
});

test("event: y data: sin espacio después del colon funcionan (spec SSE)", () => {
  const { vistos, parser } = recolectar();
  parser.alimentar('event:done\ndata:{"a":1}\n\n');
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0].event, "done");
  assert.equal(vistos[0].data.a, 1);
});

test("un data: partido dentro de un string JSON no se concatena", () => {
  const { vistos, parser } = recolectar();
  // Spec SSE: si `data:` se repite, los valores se unen con \n. Concatenarlos a
  // secas parece equivalente y casi siempre lo es — el caso que los separa es el
  // corte DENTRO de un string JSON, porque ahí el \n queda dentro de las comillas:
  //   unión con \n  ⇒ {"t":"hola\nmundo"} ⇒ salto crudo en un string ⇒ JSON inválido ⇒ 0 eventos
  //   concatenación ⇒ {"t":"holamundo"}   ⇒ JSON válido               ⇒ 1 evento
  // El test anterior usaba un corte entre campos, donde las dos formas dan el mismo
  // objeto: pasaba con cualquiera de las dos y no cubría nada.
  parser.alimentar('event: t\ndata: {"t":"hola\ndata: mundo"}\n\n');
  assert.equal(vistos.length, 0);
});
