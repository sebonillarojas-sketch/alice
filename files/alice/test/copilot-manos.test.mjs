// files/alice/test/copilot-manos.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { crearBus } from "../src/copilot/acciones.js";
import { crearManos, RUTAS } from "../src/copilot/manos.js";

const registroFalso = (montados = {}) => {
  const vivos = new Map(Object.entries(montados));
  return {
    vivos,
    modulos: () => [...vivos.keys()],
    describir: (id) => vivos.get(id) ?? null,
    esperarRegistro: async (id) => vivos.has(id),
  };
};

test("erp_list_modules lista TODAS las rutas, no sólo las montadas", async () => {
  // Alicia tiene que poder descubrir un módulo para poder navegarlo. Si sólo
  // listara lo montado, en el chat (donde no hay nada montado) la lista sería
  // vacía y no podría ir a ningún lado.
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_list_modules", {});
  assert.match(salida, /cabida/);
  assert.match(salida, /velocity/);
  assert.equal(salida.split("\n").length >= Object.keys(RUTAS).length, true);
});

test("erp_list_modules marca cuál está abierto ahora", async () => {
  const registro = registroFalso({ cabida: { module: "cabida", title: "Cabida · PU01" } });
  const manos = crearManos({ bus: crearBus(), registro, navigate: () => {} });
  const salida = await manos.ejecutar("erp_list_modules", {});
  assert.match(salida, /cabida.*abierto/i);
});

test("erp_read devuelve state y derived del módulo montado", async () => {
  const registro = registroFalso({
    cabida: { module: "cabida", title: "Cabida · PU01", state: { pisos: 8 }, derived: { margen: 1240000 } },
  });
  const manos = crearManos({ bus: crearBus(), registro, navigate: () => {} });
  const salida = await manos.ejecutar("erp_read", { module: "cabida" });
  assert.match(salida, /"pisos":\s*8/);
  assert.match(salida, /1240000/);
});

test("erp_read de un módulo que no está abierto lo dice y sugiere navegar", async () => {
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_read", { module: "cabida" });
  assert.match(salida, /no está abierto/i);
  assert.match(salida, /erp_navigate/);
});

test("erp_navigate llama a navigate con el space de la ruta y devuelve el módulo ya leído", async () => {
  const registro = registroFalso();
  const llamadas = [];
  const manos = crearManos({
    bus: crearBus(),
    registro,
    navigate: (space, view) => {
      llamadas.push([space, view]);
      // simula el montaje que dispara el render
      registro.vivos.set("cabida", { module: "cabida", title: "Cabida", state: { pisos: 8 }, derived: {} });
    },
  });
  const salida = await manos.ejecutar("erp_navigate", { module: "cabida" });
  assert.deepEqual(llamadas, [["app-cabida", undefined]]);
  assert.match(salida, /"pisos":\s*8/);
});

test("erp_navigate a un módulo que no existe no navega a ningún lado", async () => {
  let navegado = false;
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => { navegado = true; } });
  const salida = await manos.ejecutar("erp_navigate", { module: "inventado" });
  assert.equal(navegado, false);
  assert.match(salida, /no existe/i);
  assert.match(salida, /cabida/);   // ofrece la lista
});

test("erp_navigate que navega pero el módulo no monta lo dice sin mentir", async () => {
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_navigate", { module: "cabida" });
  assert.match(salida, /abrí|abrió/i);
  assert.match(salida, /no pude leer/i);
});

test("erp_navigate pasa el entityId a los módulos que lo aceptan", async () => {
  const llamadas = [];
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: (s, v) => llamadas.push([s, v]) });
  await manos.ejecutar("erp_navigate", { module: "proyecto", entityId: "pu01" });
  assert.deepEqual(llamadas, [["pu01", undefined]]);
});

test("erp_action pasa por el bus", async () => {
  const bus = crearBus();
  let visto = null;
  bus.registrar("cabida.setParams", (args) => { visto = args; return "recalculado"; });
  const manos = crearManos({ bus, registro: registroFalso(), navigate: () => {} });
  assert.equal(await manos.ejecutar("erp_action", { action: "cabida.setParams", args: { pisos: 9 } }), "recalculado");
  assert.deepEqual(visto, { pisos: 9 });
});

test("erp_action de algo no registrado devuelve el error como texto, no lo tira", async () => {
  // Va a terminar como tool_result: si tirara, el turno moriría por una acción
  // mal elegida en vez de dejar que el modelo se corrija.
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  const salida = await manos.ejecutar("erp_action", { action: "cabida.volar", args: {} });
  assert.match(salida, /no está disponible/i);
});

test("una tool desconocida no rompe las manos", async () => {
  const manos = crearManos({ bus: crearBus(), registro: registroFalso(), navigate: () => {} });
  assert.match(await manos.ejecutar("erp_teletransportar", {}), /no existe|desconocida/i);
});
