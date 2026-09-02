import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CEO_ID, emailToUserId, resolveActingUser } from "../src/identity.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name,email) VALUES
    ('sb','Sebastián','sebastian@hygge.pe'),
    ('jt','Jose','jose@hygge.pe'),
    ('aa','Ariel',NULL)`);
  return d;
}

test("emailToUserId mapea el email al userId interno", () => {
  assert.equal(emailToUserId(db0(), "jose@hygge.pe"), "jt");
});

test("emailToUserId ignora mayúsculas y espacios", () => {
  assert.equal(emailToUserId(db0(), "  JOSE@Hygge.PE "), "jt");
});

test("emailToUserId devuelve null para un email desconocido", () => {
  assert.equal(emailToUserId(db0(), "intruso@gmail.com"), null);
});

test("emailToUserId devuelve null si no hay email", () => {
  assert.equal(emailToUserId(db0(), null), null);
  assert.equal(emailToUserId(db0(), ""), null);
});

test("sin userId pedido, actuás como vos mismo", () => {
  const r = resolveActingUser({ actorId: "jt" });
  assert.deepEqual(r, { ok: true, actorId: "jt", userId: "jt", impersonating: false });
});

test("pedir tu propio userId no cuenta como impersonación", () => {
  const r = resolveActingUser({ actorId: "jt", requestedUserId: "jt" });
  assert.equal(r.impersonating, false);
});

test("un colaborador NO puede impersonar al CEO", () => {
  const r = resolveActingUser({ actorId: "jt", requestedUserId: "sb" });
  assert.deepEqual(r, { ok: false, error: "impersonacion_no_permitida" });
});

test("un admin que no es CEO tampoco puede impersonar", () => {
  const r = resolveActingUser({ actorId: "vd", requestedUserId: "jt" });
  assert.equal(r.ok, false);
});

test("el CEO sí puede ver como otro (el 'ver como' del panel)", () => {
  const r = resolveActingUser({ actorId: CEO_ID, requestedUserId: "jt" });
  assert.deepEqual(r, { ok: true, actorId: "sb", userId: "jt", impersonating: true });
});

test("sin actorId no hay acceso", () => {
  assert.deepEqual(resolveActingUser({ actorId: null, requestedUserId: "sb" }),
    { ok: false, error: "no_auth" });
});
