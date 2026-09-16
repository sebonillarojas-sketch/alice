import { test } from "node:test";
import assert from "node:assert/strict";
import { clientToolsPara, esClientTool } from "../src/client-tools.js";

// Estos tests no levantan el server: verifican el CONTRATO que el loop usa para
// decidir. El comportamiento end-to-end del loop lo cubre humo-manos.mjs, que
// corre contra un browser de verdad.

test("una tool del servidor nunca se deriva al browser", () => {
  for (const n of ["gmail_send", "create_task", "radar_query", "use_skill"]) {
    assert.equal(esClientTool(n), false, `${n} se estaría derivando al browser`);
  }
});

test("sin contexto del ERP igual hay manos para navegar y descubrir", () => {
  const nombres = clientToolsPara(null).map(t => t.name);
  assert.ok(nombres.includes("erp_navigate"));
  assert.ok(nombres.includes("erp_list_modules"));
});

test("las client tools tienen la forma exacta que espera la API de tools", () => {
  for (const t of clientToolsPara({ active: { module: "cabida", actions: ["cabida.setParams"] }, others: [] })) {
    assert.deepEqual(Object.keys(t).sort(), ["description", "input_schema", "name"]);
    assert.equal(t.input_schema.type, "object");
    assert.equal(typeof t.input_schema.properties, "object");
  }
});
