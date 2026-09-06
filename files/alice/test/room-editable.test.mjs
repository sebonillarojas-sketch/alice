// Guard del crash "Cannot read properties of undefined (reading 'pts')" que tumbó el
// Editor de Planos entero al retirar los pasos. isRoomEditable devolvía true para un
// ambiente inexistente, así que el render entraba a dibujar los vértices del ambiente
// seleccionado cuando no había ninguno seleccionado.
import test from "node:test";
import assert from "node:assert/strict";
import { isRoomEditable, preserveLockedRooms } from "../src/modules/planos/materialize.js";

test("un ambiente inexistente no es editable", () => {
  assert.equal(isRoomEditable(undefined), false, "undefined no puede ser editable");
  assert.equal(isRoomEditable(null), false, "null no puede ser editable");
});

test("sigue distinguiendo editables de bloqueados", () => {
  assert.equal(isRoomEditable({ id: "u1" }), true, "sin locked es editable");
  assert.equal(isRoomEditable({ id: "u1", locked: false }), true);
  assert.equal(isRoomEditable({ id: "core", locked: true }), false);
});

test("preserveLockedRooms conserva los bloqueados y no cuela ambientes inexistentes", () => {
  const current = [{ id: "core", locked: true }, { id: "u1" }, undefined, null];
  const out = preserveLockedRooms(current, [{ id: "u1nuevo" }]);
  assert.deepEqual(out.map((r) => r.id), ["core", "u1nuevo"],
    "conserva el bloqueado, toma el reemplazo y descarta los nullish");
  assert.ok(out.every(Boolean), "ningún hueco en la lista de ambientes");
});
