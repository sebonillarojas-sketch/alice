import { test } from "node:test";
import assert from "node:assert/strict";
import { renderErpContext, ERP_CONTEXT_CAP } from "../src/erp-context.js";

const snap = {
  active: {
    module: "cabida",
    title: "Cabida · PU01",
    entity: { type: "proyecto", id: "PU01" },
    state: { terreno: 640, pisos: 8 },
    derived: { dptos: 42, margen: 1240000 },
    actions: ["cabida.setParams"],
  },
  others: [{ module: "growth", title: "Growth", entity: null }],
  dropped: 0,
};

test("sin snapshot devuelve cadena vacía", () => {
  assert.equal(renderErpContext(null), "");
  assert.equal(renderErpContext(undefined), "");
  assert.equal(renderErpContext({ active: null, others: [], dropped: 0 }), "");
});

test("ignora basura en vez de explotar", () => {
  assert.equal(renderErpContext("no soy un objeto"), "");
  assert.equal(renderErpContext(42), "");
});

test("renderiza el módulo activo con parámetros y calculados", () => {
  const t = renderErpContext(snap);
  assert.match(t, /Cabida · PU01/);
  assert.match(t, /"terreno":640/);
  assert.match(t, /"dptos":42/);
});

test("nombra la entidad para que Alicia sepa de qué proyecto se habla", () => {
  assert.match(renderErpContext(snap), /proyecto PU01/);
});

test("lista las acciones disponibles acá y ahora", () => {
  assert.match(renderErpContext(snap), /cabida\.setParams/);
});

test("lista los otros módulos abiertos, solo por título", () => {
  const t = renderErpContext(snap);
  assert.match(t, /Growth/);
  assert.doesNotMatch(t, /growth\.abrir/);
});

test("el servidor impone su propio tope y no confía en el cliente", () => {
  const gordo = { active: { module: "x", title: "T", state: { blob: "y".repeat(50000) } }, others: [], dropped: 0 };
  const t = renderErpContext(gordo);
  assert.ok(t.length <= ERP_CONTEXT_CAP + 20, `se pasó del tope: ${t.length}`);
  assert.match(t, /recortado/);
});

test("el tope del servidor deja margen sobre el del cliente (2000)", () => {
  assert.equal(ERP_CONTEXT_CAP, 2400);
});

test("basura anidada en 'others' (null en el array) no explota", () => {
  assert.doesNotThrow(() => renderErpContext({ active: null, others: [null], dropped: 0 }));
});

test("basura anidada en 'active.actions' (string en vez de array) no explota", () => {
  assert.doesNotThrow(() => renderErpContext({ active: { module: "x", title: "T", actions: "abrir" }, others: [], dropped: 0 }));
});
