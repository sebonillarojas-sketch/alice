import { test } from "node:test";
import assert from "node:assert/strict";
import { armarHandoff, totalCombinaciones } from "../src/mica/handoff.js";

test("el handoff nombra el proyecto y conecta con José", () => {
  const { texto } = armarHandoff({ proyecto: "OLVR-01" });
  assert.match(texto, /OLVR-01/);
  assert.match(texto, /José/);
});

test("el handoff no promete planos ni precios de boca de Mica — los ofrece José", () => {
  const { texto } = armarHandoff({ proyecto: "OLVR-01" });
  // Todo lo que se ofrece va atado a José ("te puede compartir/ver/mostrar"),
  // nunca en primera persona ("te envío los planos").
  assert.doesNotMatch(texto, /\b(te env[íi]o|te mando|te paso los planos|adjunto)\b/i);
  assert.match(texto, /te puede (compartir|ver|mostrar|contar|resolver)/i);
});

test("no repite una combinación ya usada con el mismo prospecto", () => {
  const usadas = [];
  for (let i = 0; i < 12; i++) {
    const { combo } = armarHandoff({ proyecto: "OLVR-01", usadas });
    assert.equal(usadas.includes(combo), false, `repitió ${combo} en la vuelta ${i}`);
    usadas.push(combo);
  }
});

test("agotadas todas las combinaciones, vuelve a empezar en vez de romperse", () => {
  const usadas = Array.from({ length: totalCombinaciones() }, (_, i) => `fake-${i}`);
  // Se simula el agotamiento real: todas las combinaciones posibles ya usadas.
  const todas = new Set();
  for (let i = 0; i < totalCombinaciones(); i++) todas.add(armarHandoff({ proyecto: "X", usadas: [...todas] }).combo);
  const { texto } = armarHandoff({ proyecto: "X", usadas: [...todas] });
  assert.ok(texto.length > 0);
  assert.equal(usadas.length, totalCombinaciones());
});

test("el saludo abre con una de las aperturas del dueño del producto", () => {
  const aperturas = new Set();
  for (let i = 0; i < 40; i++) aperturas.add(armarHandoff({ proyecto: "X" }).texto.split(".")[0]);
  for (const a of aperturas) {
    assert.match(a, /^(Con gusto|Claro|Claro que sí|Por supuesto)$/);
  }
});

test("sin proyecto conocido, la frase sigue estando bien escrita — nada de 'de el proyecto'", () => {
  for (let i = 0; i < 30; i++) {
    const { texto } = armarHandoff({ proyecto: null });
    assert.doesNotMatch(texto, /\bde el\b/, texto);
    assert.doesNotMatch(texto, /\{P\}|null|undefined/, texto);
    assert.match(texto, /(del proyecto|el proyecto)/);
  }
});
