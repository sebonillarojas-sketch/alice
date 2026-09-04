import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { CEO_ID, emailToUserId, puedeVer, resolveActingUser } from "../src/identity.js";
import { seedTeamEmails } from "../src/db.js";

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

test("puedeVer: cada quien puede con lo suyo", () => {
  assert.equal(puedeVer("jt", "jt"), true);
});

test("puedeVer: nadie puede con los datos de otro", () => {
  assert.equal(puedeVer("jt", "sb"), false);
  assert.equal(puedeVer("vd", "jm"), false);
});

test("puedeVer: el CEO puede con los de cualquiera", () => {
  assert.equal(puedeVer(CEO_ID, "jt"), true);
  assert.equal(puedeVer(CEO_ID, CEO_ID), true);
  assert.equal(puedeVer(CEO_ID, "desconocido"), true);
});

test("puedeVer: sin actor no se puede nada (ni con un target vacío)", () => {
  assert.equal(puedeVer(null, "jt"), false);
  assert.equal(puedeVer(undefined, undefined), false);
  assert.equal(puedeVer("", ""), false);
});

test("seedTeamEmails deja a las 7 personas resolubles por email", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  for (const id of ["sb","vd","jt","jm","aa","ac","jmg"]) {
    d.exec(`INSERT INTO profiles (user_id,name) VALUES ('${id}','x')`);
  }
  seedTeamEmails(d);
  assert.equal(emailToUserId(d, "sebastian@hygge.pe"), "sb");
  assert.equal(emailToUserId(d, "vane@hygge.pe"), "vd");
  assert.equal(emailToUserId(d, "jose@hygge.pe"), "jt");
  assert.equal(emailToUserId(d, "joel@hygge.pe"), "jm");
  assert.equal(emailToUserId(d, "ariel@bam.pe"), "aa");
  assert.equal(emailToUserId(d, "andre@hygge.pe"), "ac");
  assert.equal(emailToUserId(d, "galup@hygge.pe"), "jmg");
});

test("seedTeamEmails NO pisa un email ya cargado a mano", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name,email) VALUES ('jt','Jose','jose.torres@hygge.pe')`);
  seedTeamEmails(d);
  assert.equal(emailToUserId(d, "jose.torres@hygge.pe"), "jt");
  assert.equal(emailToUserId(d, "jose@hygge.pe"), null);
});

test("seedTeamEmails es idempotente", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, email TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name) VALUES ('jt','Jose')`);
  seedTeamEmails(d);
  seedTeamEmails(d);
  assert.equal(emailToUserId(d, "jose@hygge.pe"), "jt");
});

// Antes esto era un UPDATE y no podía crear la fila que falta: sin fila en
// profiles la persona no resolvía su identidad y se quedaba sin Alicia, y había
// que entrar a Railway a escribir el INSERT a mano.
test("seedTeamEmails crea el perfil que falta, con el user_id de nombre", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT);`);
  seedTeamEmails(d);
  assert.equal(d.prepare("SELECT COUNT(*) c FROM profiles").get().c, 7);
  assert.equal(emailToUserId(d, "jose@hygge.pe"), "jt");
  assert.equal(d.prepare("SELECT name FROM profiles WHERE user_id='jt'").get().name, "jt");
});

test("seedTeamEmails no pisa el perfil que ya existe al crear los que faltan", () => {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT);`);
  d.exec(`INSERT INTO profiles (user_id,name,email) VALUES ('jt','Jose Torres','jose.torres@hygge.pe')`);
  seedTeamEmails(d);
  const jt = d.prepare("SELECT name, email FROM profiles WHERE user_id='jt'").get();
  assert.equal(jt.name, "Jose Torres");
  assert.equal(jt.email, "jose.torres@hygge.pe");
  assert.equal(emailToUserId(d, "vane@hygge.pe"), "vd");
});
