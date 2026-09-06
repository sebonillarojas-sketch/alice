import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema, proposeLesson } from "../src/lessons.js";
import { mergeEquivalentLessons } from "../src/lesson-dedup.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  ensureLessonsSchema(d);
  return d;
}
const add = (db, scope, lesson) => proposeLesson(db, { scope, source: "reflection", trigger: "auto-reflexión", lesson }).id;
const row = (db, id) => db.prepare("SELECT status, evidence_count, trigger FROM lessons WHERE id = ?").get(id);
const proposedCount = (db) => db.prepare("SELECT COUNT(*) c FROM lessons WHERE status = 'proposed'").get().c;

// Cliente falso: devuelve los grupos que se le pidan, en el formato del prompt.
const fakeClient = (text) => ({ messages: { create: async () => ({ content: [{ type: "text", text }] }) } });
const boomClient = () => ({ messages: { create: async () => { throw new Error("API caída"); } } });

test("funde por normalización sin llamar al modelo", async () => {
  const db = db0();
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  const a = add(db, "global", "**Cheshire lleva 20 días sin actividad**");
  const b = add(db, "global", "Cheshire lleva 34 días sin actividad.");
  const r = await mergeEquivalentLessons(db, { client });
  assert.equal(called, false, "no debería consultar al modelo: la normalización ya las igualó");
  assert.equal(row(db, a).evidence_count, 2);
  assert.equal(row(db, a).status, "proposed");
  assert.equal(row(db, b).status, "retired");
  assert.equal(r.merged, 1);
});

test("funde por juicio del modelo: gana la más vieja y suma la evidencia", async () => {
  const db = db0();
  const a = add(db, "agent:cheshire", "Antes de mostrar el error de clave incorrecta, verificá el fetch a Supabase");
  const b = add(db, "agent:cheshire", "Revisá los headers de las requests a Supabase antes del próximo ciclo");
  const c = add(db, "agent:cheshire", "Manejá explícitamente el 406 y el 400 del login");
  const r = await mergeEquivalentLessons(db, { client: fakeClient('{"groups":[[0,1,2]]}') });
  assert.equal(row(db, a).evidence_count, 3);
  assert.equal(row(db, a).status, "proposed");
  assert.equal(row(db, b).status, "retired");
  assert.equal(row(db, c).status, "retired");
  assert.equal(proposedCount(db), 1);
  assert.equal(r.merged, 2, "dos filas absorbidas");
});

test("la absorbida deja anotado en qué lección se fundió", async () => {
  const db = db0();
  const a = add(db, "agent:knave", "Chequear los headers de seguridad");
  const b = add(db, "agent:knave", "Verificar que estén los headers de seguridad");
  await mergeEquivalentLessons(db, { client: fakeClient('{"groups":[[0,1]]}') });
  assert.match(row(db, b).trigger, new RegExp(`#${a}`));
});

test("no consulta al modelo si el scope tiene una sola lección", async () => {
  const db = db0();
  let called = false;
  add(db, "agent:bammy", "Poner la terraza al frente");
  const client = { messages: { create: async () => { called = true; return {}; } } };
  await mergeEquivalentLessons(db, { client });
  assert.equal(called, false);
});

test("si el modelo falla no se funde nada y no explota", async () => {
  const db = db0();
  const a = add(db, "agent:cheshire", "Una cosa");
  const b = add(db, "agent:cheshire", "Otra cosa distinta");
  const r = await mergeEquivalentLessons(db, { client: boomClient() });
  assert.equal(row(db, a).status, "proposed");
  assert.equal(row(db, b).status, "proposed");
  assert.equal(r.merged, 0);
  assert.equal(r.errors, 1);
});

test("un scope que falla no se lleva puesto al resto", async () => {
  const db = db0();
  const a = add(db, "agent:cheshire", "Una cosa");
  add(db, "agent:cheshire", "Otra cosa");
  const c = add(db, "agent:knave", "Chequear headers");
  const d = add(db, "agent:knave", "Verificar headers");
  let n = 0;
  const client = { messages: { create: async () => {
    n++;
    if (n === 1) throw new Error("falla el primero");
    return { content: [{ type: "text", text: '{"groups":[[0,1]]}' }] };
  } } };
  const r = await mergeEquivalentLessons(db, { client });
  assert.equal(row(db, a).status, "proposed");
  assert.equal(row(db, d).status, "retired", "el segundo scope sí se fundió");
  assert.equal(row(db, c).evidence_count, 2);
  assert.equal(r.errors, 1);
  assert.equal(r.merged, 1);
});

test("ignora grupos con índices inventados", async () => {
  const db = db0();
  const a = add(db, "agent:knave", "Una");
  const b = add(db, "agent:knave", "Otra");
  const r = await mergeEquivalentLessons(db, { client: fakeClient('{"groups":[[0,99]]}') });
  assert.equal(row(db, a).status, "proposed");
  assert.equal(row(db, b).status, "proposed");
  assert.equal(r.merged, 0);
});

test("solo mira las proposed: no toca validated ni applied", async () => {
  const db = db0();
  const a = add(db, "agent:knave", "Chequear headers");
  const b = add(db, "agent:knave", "Verificar headers");
  db.prepare("UPDATE lessons SET status = 'applied' WHERE id = ?").run(b);
  let called = false;
  await mergeEquivalentLessons(db, { client: { messages: { create: async () => { called = true; return {}; } } } });
  assert.equal(called, false, "queda una sola proposed, no hay a quién comparar");
  assert.equal(row(db, a).status, "proposed");
  assert.equal(row(db, b).status, "applied");
});
