import { test } from "node:test";
import assert from "node:assert/strict";
import { armarToolsDelTurno } from "../src/server.js";

// `armarToolsDelTurno` es la función pura que decide qué `tools` viajan en el
// cuerpo del request. Se testea directo (sin levantar `processAliciaMessage`
// ni el server real) porque es la única garantía automatizada de que un canal
// sin `clientTools` arma exactamente el mismo array que armaba antes de la
// Tarea 3 — el resto del loop (el dispatch de `esClientTool` y el mensaje de
// aviso sin `ejecutarClientTool`) sólo se puede ejercitar disparando el modelo
// de verdad, y eso lo cubre el humo de la Tarea 10.

const cachedTools = [
  { name: "tool_a", input_schema: { type: "object", properties: {} } },
  { name: "tool_b", input_schema: { type: "object", properties: {} }, cache_control: { type: "ephemeral" } },
];

test("sin clientTools (undefined, null o vacío) devuelve LA MISMA referencia que cachedTools", () => {
  // strictEqual y no deepEqual a propósito: la garantía de byte-identidad de
  // WhatsApp/embodied//api/chat depende de que sea el MISMO array, no una copia.
  assert.strictEqual(armarToolsDelTurno(cachedTools, undefined), cachedTools);
  assert.strictEqual(armarToolsDelTurno(cachedTools, null), cachedTools);
  assert.strictEqual(armarToolsDelTurno(cachedTools, []), cachedTools);
});

test("el cache_control se queda en la última tool estable, y ninguna client tool lo lleva", () => {
  const clientTools = [
    { name: "erp_navigate", input_schema: { type: "object", properties: {} } },
    { name: "erp_action", input_schema: { type: "object", properties: {} } },
  ];
  const resultado = armarToolsDelTurno(cachedTools, clientTools);

  const conBreakpoint = resultado.filter(t => t.cache_control);
  assert.equal(conBreakpoint.length, 1);
  assert.equal(conBreakpoint[0].name, "tool_b");
  for (const t of clientTools) {
    assert.equal("cache_control" in resultado.find(r => r.name === t.name), false, `${t.name} no debería tener cache_control`);
  }
});

test("las client tools quedan estrictamente después del elemento con cache_control", () => {
  const clientTools = [{ name: "erp_navigate", input_schema: { type: "object", properties: {} } }];
  const resultado = armarToolsDelTurno(cachedTools, clientTools);

  const idxBreakpoint = resultado.findIndex(t => t.cache_control);
  const idxClientTool = resultado.findIndex(t => t.name === "erp_navigate");
  assert.ok(idxBreakpoint >= 0);
  assert.ok(idxClientTool > idxBreakpoint, "la client tool debe ir después del breakpoint de caché");
});
