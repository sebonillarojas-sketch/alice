import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildRoster, formatTeamBriefing, runTeamBriefing } from "../src/team-briefing.js";

function db0() {
  const d = new DatabaseSync(":memory:");
  d.exec(`CREATE TABLE profiles (user_id TEXT PRIMARY KEY, name TEXT, role TEXT, phone TEXT);`);
  return d;
}

// ── buildRoster ───────────────────────────────────────────────────────────────

test("buildRoster: toma los ids de los PHONE_<id> del entorno, en minúsculas", () => {
  const db = db0();
  const roster = buildRoster(db, { PHONE_sb: "51900000001", PHONE_vd: "51900000002" });
  assert.deepEqual(roster.map(p => p.userId), ["sb", "vd"]);
  assert.equal(roster[0].phone, "51900000001");
});

test("buildRoster: el nombre sale de profiles; sin profile cae al id", () => {
  const db = db0();
  db.prepare("INSERT INTO profiles (user_id, name, phone) VALUES ('vd','Vanessa Díaz',NULL)").run();
  const roster = buildRoster(db, { PHONE_vd: "51900000002", PHONE_jt: "51900000003" });
  const byId = Object.fromEntries(roster.map(p => [p.userId, p]));
  assert.equal(byId.vd.name, "Vanessa");
  assert.equal(byId.jt.name, "jt");
});

test("buildRoster: profiles.phone gana sobre el env (resolvePhone)", () => {
  const db = db0();
  db.prepare("INSERT INTO profiles (user_id, name, phone) VALUES ('vd','Vanessa Díaz','51911111111')").run();
  const roster = buildRoster(db, { PHONE_vd: "51900000002" });
  assert.equal(roster[0].phone, "51911111111");
});

test("buildRoster: incluye a quien está en profiles con teléfono aunque no tenga env", () => {
  const db = db0();
  db.prepare("INSERT INTO profiles (user_id, name, phone) VALUES ('ml','María López','51922222222')").run();
  const roster = buildRoster(db, { PHONE_sb: "51900000001" });
  assert.deepEqual(roster.map(p => p.userId), ["ml", "sb"]);
});

test("buildRoster: saltea a quien no tiene teléfono en ningún lado", () => {
  const db = db0();
  db.prepare("INSERT INTO profiles (user_id, name, phone) VALUES ('xx','Sin Teléfono',NULL)").run();
  const roster = buildRoster(db, { PHONE_sb: "51900000001" });
  assert.deepEqual(roster.map(p => p.userId), ["sb"]);
});

test("buildRoster: no confunde otras variables que contienen PHONE", () => {
  const db = db0();
  const roster = buildRoster(db, { WA_PHONE_NUMBER_ID: "12345", PHONE_sb: "51900000001" });
  assert.deepEqual(roster.map(p => p.userId), ["sb"]);
});

test("buildRoster: no duplica a quien está en profiles y en el env", () => {
  const db = db0();
  db.prepare("INSERT INTO profiles (user_id, name, phone) VALUES ('sb','Sebastián Bonilla','51900000001')").run();
  const roster = buildRoster(db, { PHONE_sb: "51900000001" });
  assert.equal(roster.length, 1);
});

// ── formatTeamBriefing ────────────────────────────────────────────────────────

const base = { name: "Vanessa", tasksToday: [], overdue: [], meetings: [], emails: [], googleUrl: null };

test("formatTeamBriefing: saluda con buenos días, taza de café y solsito", () => {
  const msg = formatTeamBriefing(base);
  assert.match(msg.split("\n")[0], /^Buenos días, Vanessa ☕🌞$/);
});

test("formatTeamBriefing: una línea por bloque, no una lista por ítem", () => {
  const msg = formatTeamBriefing({
    ...base,
    tasksToday: [{ title: "Cerrar contrato" }, { title: "Revisar planos" }],
    overdue: [{ title: "Enviar cotización", due_date: "2026-08-10" }],
    meetings: [{ start: "2026-08-14T10:00:00-05:00", title: "Comité" }],
    emails: [{ from: "Juan Pérez <juan@x.pe>", subject: "Arriendo" }],
  });
  // Saludo + blanco + 4 bloques = 6 líneas, sin viñetas
  assert.equal(msg.split("\n").length, 6);
  assert.doesNotMatch(msg, /•/);
  assert.match(msg, /📋 Hoy \(2\): Cerrar contrato · Revisar planos/);
  assert.match(msg, /⚠️ Vencidas \(1\): Enviar cotización/);
  assert.match(msg, /📅 10:00 Comité/);
  assert.match(msg, /📧 1 sin leer: Juan Pérez/);
});

test("formatTeamBriefing: omite los bloques vacíos en vez de decir 'sin nada'", () => {
  const msg = formatTeamBriefing({ ...base, tasksToday: [{ title: "Cerrar contrato" }] });
  assert.doesNotMatch(msg, /Vencidas/);
  assert.doesNotMatch(msg, /📅/);
  assert.doesNotMatch(msg, /📧/);
});

test("formatTeamBriefing: día totalmente limpio lo dice en una línea", () => {
  const msg = formatTeamBriefing(base);
  assert.equal(msg.split("\n").length, 3);
  assert.match(msg, /Todo despejado/);
});

test("formatTeamBriefing: corta las listas largas en 5 y cuenta el resto", () => {
  const overdue = Array.from({ length: 9 }, (_, i) => ({ title: `Tarea ${i + 1}` }));
  const msg = formatTeamBriefing({ ...base, overdue });
  assert.match(msg, /⚠️ Vencidas \(9\): Tarea 1 · Tarea 2 · Tarea 3 · Tarea 4 · Tarea 5 …\+4/);
  assert.doesNotMatch(msg, /Tarea 6/);
});

test("formatTeamBriefing: en correos muestra sólo el remitente, sin asunto ni mail", () => {
  const msg = formatTeamBriefing({
    ...base,
    emails: [{ from: "Juan Pérez <juan@x.pe>", subject: "Propuesta de arriendo" }],
  });
  assert.match(msg, /📧 1 sin leer: Juan Pérez/);
  assert.doesNotMatch(msg, /juan@x\.pe/);
  assert.doesNotMatch(msg, /Propuesta de arriendo/);
});

test("formatTeamBriefing: sin Google conectado invita a conectarlo y omite agenda y correos", () => {
  const msg = formatTeamBriefing({ ...base, googleUrl: "https://aliceai.bam.pe/auth/google?user=vd" });
  assert.match(msg, /🔗 Conectá tu Google: https:\/\/aliceai\.bam\.pe\/auth\/google\?user=vd/);
  assert.doesNotMatch(msg, /📅/);
  assert.doesNotMatch(msg, /📧/);
});

test("formatTeamBriefing: con Google conectado no invita a conectarlo", () => {
  const msg = formatTeamBriefing({ ...base, meetings: [{ start: "2026-08-14T10:00:00-05:00", title: "Comité" }] });
  assert.doesNotMatch(msg, /auth\/google/);
});

// ── runTeamBriefing ───────────────────────────────────────────────────────────

function dbEquipo() {
  const d = db0();
  d.prepare("INSERT INTO profiles (user_id,name,phone) VALUES ('sb','Sebastián Bonilla','51900000001')").run();
  d.prepare("INSERT INTO profiles (user_id,name,phone) VALUES ('vd','Vanessa Díaz','51900000002')").run();
  return d;
}

const depsFalsas = (sent) => ({
  getTasks: async () => [],
  hasGoogle: async () => false,
  listEvents: async () => [],
  searchEmails: async () => [],
  send: async (phone, msg) => { sent.push({ phone, msg }); return true; },
});

test("runTeamBriefing: sin `only` le escribe a todo el roster", async () => {
  const sent = [];
  const r = await runTeamBriefing({ db: dbEquipo(), deps: depsFalsas(sent) });
  assert.equal(r.sent, 2);
  assert.deepEqual(sent.map(s => s.phone).sort(), ["51900000001", "51900000002"]);
});

test("runTeamBriefing: con `only` le escribe a esa persona y a nadie más", async () => {
  const sent = [];
  const r = await runTeamBriefing({ db: dbEquipo(), only: "sb", deps: depsFalsas(sent) });
  assert.equal(r.sent, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].phone, "51900000001");
  assert.match(sent[0].msg, /Buenos días, Sebastián/);
});

test("runTeamBriefing: cada quien recibe sólo sus propias tareas", async () => {
  const sent = [];
  const hoy = new Date().toISOString().split("T")[0];
  const deps = {
    ...depsFalsas(sent),
    getTasks: async () => ([
      { title: "Tarea de Vanessa", assignee_id: "vd", due_date: hoy },
      { title: "Tarea de Sebastián", assignee_id: "sb", due_date: hoy },
    ]),
  };
  await runTeamBriefing({ db: dbEquipo(), deps });
  const paraSb = sent.find(s => s.phone === "51900000001").msg;
  assert.match(paraSb, /Tarea de Sebastián/);
  assert.doesNotMatch(paraSb, /Tarea de Vanessa/);
});

test("runTeamBriefing: si a uno le falla el envío, sigue con el resto", async () => {
  const sent = [];
  const deps = {
    ...depsFalsas(sent),
    send: async (phone, msg) => {
      if (phone === "51900000001") throw new Error("Twilio caído");
      sent.push({ phone, msg });
      return true;
    },
  };
  const r = await runTeamBriefing({ db: dbEquipo(), deps });
  assert.equal(r.sent, 1);
  assert.equal(r.skipped, 1);
  assert.equal(sent[0].phone, "51900000002");
});
