import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { resolvePhone } from "../src/tools.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, phone TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name,phone) VALUES ('jt','Jose','+51999111222'),('vd','Vanessa',NULL)`);
  return d;
}
test("resolvePhone devuelve el teléfono de la persona", () => {
  assert.equal(resolvePhone(db0(), "jt"), "+51999111222");
});
test("resolvePhone sin teléfono → null", () => {
  assert.equal(resolvePhone(db0(), "vd"), null);
});
