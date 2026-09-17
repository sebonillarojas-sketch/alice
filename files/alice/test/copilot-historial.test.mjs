// files/alice/test/copilot-historial.test.mjs
//
// historial.js salió de AliciaView para que lo compartan el space viejo y el
// CopilotoProvider. Lo que estos tests clavan es justamente lo que la mudanza
// puso en riesgo y el build no atrapa: la CLAVE (ya escrita en el navegador de
// todo el equipo y en el humo) y el recorte a los últimos 100.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chatKey, loadChat, saveChat } from "../src/copilot/historial.js";

// Node no trae localStorage: el mínimo que usan estas dos funciones.
function montarLocalStorage() {
  const datos = new Map();
  globalThis.localStorage = {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  };
  return datos;
}

test("la clave del hilo es la que ya está escrita en los navegadores del equipo", () => {
  // Cambiar este string le tira el hilo a la basura a todo el mundo y rompe el
  // humo de la burbuja, que siembra `alicia_chat_sb_v1` a mano.
  assert.equal(chatKey("u1"), "alicia_chat_u1_v1");
  assert.equal(chatKey("sb"), "alicia_chat_sb_v1");
});

test("saveChat guarda sólo los últimos 100 mensajes, bajo la clave del uid", () => {
  const datos = montarLocalStorage();
  const largo = Array.from({ length: 130 }, (_, i) => ({ role: "user", content: `m${i}` }));

  saveChat("u1", largo);

  const crudo = datos.get("alicia_chat_u1_v1");
  assert.ok(crudo, "tiene que escribir bajo alicia_chat_u1_v1");
  const guardado = JSON.parse(crudo);
  assert.equal(guardado.length, 100);
  // Se quedan los ÚLTIMOS: el más viejo que sobrevive es el 30, el último el 129.
  assert.equal(guardado[0].content, "m30");
  assert.equal(guardado.at(-1).content, "m129");
  assert.deepEqual(loadChat("u1"), guardado);
});

test("loadChat devuelve [] si no hay nada guardado o si el caché está corrupto", () => {
  const datos = montarLocalStorage();
  assert.deepEqual(loadChat("nadie"), []);
  datos.set("alicia_chat_roto_v1", "{no es json");
  assert.deepEqual(loadChat("roto"), []);
});
