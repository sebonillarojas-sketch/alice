import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ensureLessonsSchema } from "../src/lessons.js";
import { reflectAgent, runReflectionPass } from "../src/reflection.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  ensureLessonsSchema(d);
  d.exec(`CREATE TABLE agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, result TEXT, summary TEXT, report TEXT, created_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE agent_findings (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, severity TEXT, category TEXT, detail TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now')));
          CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, role TEXT, content TEXT, created_at TEXT DEFAULT (datetime('now')));`);
  return d;
}
const fakeClient = (text) => ({ messages: { create: async () => ({ content: [{ type: "text", text }] }) } });
const countLessons = (db) => db.prepare("SELECT COUNT(*) c FROM lessons").get().c;

test("reflectAgent: agente sin actividad → no propone y NO llama al LLM", async () => {
  const db = db0();
  let called = false;
  const client = { messages: { create: async () => { called = true; return {}; } } };
  const r = await reflectAgent(db, "cheshire", { client });
  assert.equal(r.proposed, false);
  assert.equal(called, false);
  assert.equal(countLessons(db), 0);
});

test("reflectAgent: con actividad y lección → propone scope agent:<x>, source reflection", async () => {
  const db = db0();
  db.prepare("INSERT INTO agent_runs (agent, result, summary) VALUES ('cheshire','issues','2 bugs de login')").run();
  const r = await reflectAgent(db, "cheshire", { client: fakeClient("Revisar el manejo de errores del login antes de cada release.") });
  assert.equal(r.proposed, true);
  const row = db.prepare("SELECT scope, source FROM lessons").get();
  assert.equal(row.scope, "agent:cheshire");
  assert.equal(row.source, "reflection");
});

test("reflectAgent: respuesta NONE → no propone", async () => {
  const db = db0();
  db.prepare("INSERT INTO agent_runs (agent, result, summary) VALUES ('knave','ok','sin gaps')").run();
  const r = await reflectAgent(db, "knave", { client: fakeClient("NONE") });
  assert.equal(r.proposed, false);
  assert.equal(countLessons(db), 0);
});

test("reflectAgent alicia: reflexiona sobre messages → scope agent:alicia", async () => {
  const db = db0();
  db.prepare("INSERT INTO messages (user_id, role, content) VALUES ('sb','user','no me mandes a dormir')").run();
  const r = await reflectAgent(db, "alicia", { client: fakeClient("No sugerir horarios de descanso salvo que lo pidan.") });
  assert.equal(r.proposed, true);
  assert.equal(db.prepare("SELECT scope FROM lessons").get().scope, "agent:alicia");
});

test("runReflectionPass: cuenta evaluated/proposed y un error no corta el resto", async () => {
  const db = db0();
  db.prepare("INSERT INTO agent_runs (agent, result, summary) VALUES ('cheshire','issues','x')").run();
  db.prepare("INSERT INTO agent_runs (agent, result, summary) VALUES ('knave','ok','y')").run();
  // client que propone para todos los que tienen contexto
  const counts = await runReflectionPass(db, { client: fakeClient("Mejorar X."), agents: ["cheshire", "knave", "bandersnatch"] });
  assert.equal(counts.evaluated, 3);       // los 3 evaluados
  assert.equal(counts.proposed, 2);        // cheshire + knave (bandersnatch sin actividad → no propone)
});
