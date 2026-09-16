import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENT_TOOLS, esClientTool, efectoDe, clientToolsPara } from "../src/client-tools.js";

test("toda client tool declara un efecto conocido", () => {
  for (const t of CLIENT_TOOLS) {
    assert.ok(["read", "navigate", "write"].includes(t.efecto), `${t.name} tiene efecto "${t.efecto}"`);
  }
});

test("erp_action es la única que escribe", () => {
  const escriben = CLIENT_TOOLS.filter(t => t.efecto === "write").map(t => t.name);
  assert.deepEqual(escriben, ["erp_action"]);
});

test("esClientTool distingue las del browser de las del servidor", () => {
  assert.equal(esClientTool("erp_navigate"), true);
  assert.equal(esClientTool("gmail_send"), false);
  assert.equal(efectoDe("erp_navigate"), "navigate");
  assert.equal(efectoDe("gmail_send"), undefined);
});

test("las tools que van a la API no llevan el campo efecto", () => {
  // `efecto` es nuestro, no del contrato de Anthropic: mandarlo es un campo
  // desconocido en la definición de tool.
  for (const t of clientToolsPara(null)) {
    assert.equal("efecto" in t, false, `${t.name} filtró el efecto`);
    assert.ok(t.name && t.description && t.input_schema);
  }
});

test("sin contexto NO se ofrece erp_action: no hay ninguna acción que exista", () => {
  const nombres = clientToolsPara(null).map(t => t.name);
  assert.deepEqual(nombres.sort(), ["erp_list_modules", "erp_navigate", "erp_read"]);
});

test("con un módulo activo que declara acciones, erp_action entra con el enum de ESAS acciones", () => {
  const ctx = {
    active: { module: "cabida", title: "Cabida · PU01", actions: ["cabida.setParams", "cabida.recalcular"] },
    others: [], dropped: 0,
  };
  const action = clientToolsPara(ctx).find(t => t.name === "erp_action");
  assert.ok(action, "erp_action tiene que estar");
  assert.deepEqual(action.input_schema.properties.action.enum, ["cabida.setParams", "cabida.recalcular"]);
});

test("un módulo activo SIN acciones no habilita erp_action", () => {
  const ctx = { active: { module: "obra", title: "Obra · DC01" }, others: [], dropped: 0 };
  assert.equal(clientToolsPara(ctx).some(t => t.name === "erp_action"), false);
});

test("las acciones de los módulos NO activos no entran al enum", () => {
  // `others` viaja recortado a {module,title,entity} — no tiene actions —, pero
  // aunque las trajera: ofrecer una acción de un módulo que no está en pantalla
  // es ofrecer algo que el bus no tiene registrado.
  const ctx = {
    active: { module: "cabida", actions: ["cabida.setParams"] },
    others: [{ module: "velocity", title: "Velocity", actions: ["velocity.simular"] }],
    dropped: 0,
  };
  const action = clientToolsPara(ctx).find(t => t.name === "erp_action");
  assert.deepEqual(action.input_schema.properties.action.enum, ["cabida.setParams"]);
});

test("un erpContext con basura no explota y degrada a las tres de siempre", () => {
  for (const basura of [undefined, {}, { active: "texto" }, { active: { actions: "no-es-array" } }]) {
    const nombres = clientToolsPara(basura).map(t => t.name);
    assert.equal(nombres.includes("erp_action"), false);
    assert.equal(nombres.length, 3);
  }
});
