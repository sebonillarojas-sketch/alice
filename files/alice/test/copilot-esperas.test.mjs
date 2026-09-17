// files/alice/test/copilot-esperas.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearEsperas } from "../src/copilot/esperas.js";

const esperaMs = (ms) => new Promise((r) => setTimeout(r, ms));

test("resuelve true cuando el módulo se registra después de empezar a esperar", async () => {
  const { esperar, despertar } = crearEsperas();
  const promesa = esperar("cabida", 1000, false);
  despertar("cabida");
  assert.equal(await promesa, true);
});

test("resuelve false cuando vence el timeout", async () => {
  const { esperar } = crearEsperas();
  const promesa = esperar("cabida", 15, false);
  // Nadie llama a despertar: tiene que vencer solo.
  assert.equal(await promesa, false);
});

test("dos esperas concurrentes del mismo módulo no se pisan: las dos resuelven", async () => {
  const { esperar, despertar } = crearEsperas();
  const p1 = esperar("cabida", 1000, false);
  const p2 = esperar("cabida", 1000, false);
  despertar("cabida");
  assert.deepEqual(await Promise.all([p1, p2]), [true, true]);
});

test("un timer viejo que dispara tarde no toca una cola nueva del mismo moduleId", async () => {
  const { esperar, despertar } = crearEsperas();
  // Primer episodio: vence solo, se limpia de la cola sin ayuda de despertar.
  const viejo = esperar("cabida", 5, false);
  assert.equal(await viejo, false);
  // Segundo episodio, mismo moduleId, cola nueva. Si el timer del primero
  // (que ya disparó y se debería haber auto-eliminado) tocara esta cola nueva
  // por moduleId en vez de por identidad de su propia entrada, este segundo
  // episodio quedaría corrupto o resuelto mal.
  const nuevo = esperar("cabida", 200, false);
  despertar("cabida");
  assert.equal(await nuevo, true);
});

test("si el módulo ya está registrado, resuelve true sin esperar", async () => {
  const { esperar } = crearEsperas();
  // timeout corto y sin ningún despertar: si `yaEsta` no cortara camino, esto
  // dependería del timeout venciendo en false. Con yaEsta=true resuelve ya.
  const promesa = esperar("cabida", 5, true);
  assert.equal(await promesa, true);
});
