import test from "node:test";
import assert from "node:assert/strict";
import { selectPending, coalesce, taskIdFromDeepLink, COALESCE_THRESHOLD } from "../src/lib/notifications.js";

const fila = (id, over = {}) => ({
  id, kind: "task_assigned", title: `T${id}`, body: "",
  deep_link: `#/task/${id}`, urgency: "now", delivered_at: null,
  created_at: `2026-08-30T10:0${id}:00Z`, ...over,
});

test("selectPending descarta las ya entregadas por delivered_at", () => {
  const rows = [fila("1"), fila("2", { delivered_at: "2026-08-30T10:05:00Z" })];
  assert.deepEqual(selectPending(rows, []).map(r => r.id), ["1"]);
});

test("selectPending descarta las ya mostradas en esta sesión", () => {
  const rows = [fila("1"), fila("2")];
  assert.deepEqual(selectPending(rows, ["1"]).map(r => r.id), ["2"]);
});

test("selectPending ignora las urgency=digest", () => {
  const rows = [fila("1", { urgency: "digest" }), fila("2")];
  assert.deepEqual(selectPending(rows, []).map(r => r.id), ["2"]);
});

test("selectPending ordena de más vieja a más nueva", () => {
  const rows = [fila("3"), fila("1"), fila("2")];
  assert.deepEqual(selectPending(rows, []).map(r => r.id), ["1", "2", "3"]);
});

test("coalesce sin pendientes devuelve null", () => {
  assert.equal(coalesce([]), null);
});

test("coalesce hasta el umbral devuelve un banner por notificación", () => {
  const p = [fila("1"), fila("2"), fila("3")];
  const out = coalesce(p);
  assert.equal(out.length, 3);
  assert.equal(out[0].title, "T1");
  assert.deepEqual(out[0].ids, ["1"]);
  assert.equal(out[0].deepLink, "#/task/1");
});

test("coalesce sobre el umbral devuelve un solo banner resumen", () => {
  const p = [fila("1"), fila("2"), fila("3"), fila("4")];
  const out = coalesce(p);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "4 novedades");
  assert.deepEqual(out[0].ids, ["1", "2", "3", "4"]);
  assert.equal(out[0].deepLink, "#/space/notifications");
});

test("el umbral es 3", () => {
  assert.equal(COALESCE_THRESHOLD, 3);
});

test("taskIdFromDeepLink extrae el id o devuelve null", () => {
  assert.equal(taskIdFromDeepLink("#/task/999"), 999);
  assert.equal(taskIdFromDeepLink("#/space/notifications"), null);
  assert.equal(taskIdFromDeepLink(""), null);
  assert.equal(taskIdFromDeepLink(undefined), null);
});
