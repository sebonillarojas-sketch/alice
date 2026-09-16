// La flota de scrapers 🪰 — regresión del incidente del 16/09/2026:
// Urbania y SBS estuvieron caídos tres días y ninguna alerta salió, porque los
// scrapers reportaban bajo 'white-rabbit' y la guardia de infra les cerraba los
// hallazgos cada 30 min. Estos tests cubren la parte pura del arreglo: quién está
// viejo, quién está mudo, y que cada scraper tenga nombre propio.

import { test } from "node:test";
import assert from "node:assert/strict";
import { FLEET, AGENT_BY_SOURCE, staleFindings, tsMs, masReciente } from "../src/scrapers/fleet.js";

const H = 3_600_000;
const NOW = Date.parse("2026-09-16T18:00:00Z");
// Todos frescos: base para mover una sola pieza por test.
const frescos = () => Object.fromEntries(Object.keys(FLEET).map(a => [a, NOW - 1 * H]));

test("cada scraper tiene identidad propia — ninguno comparte nombre", () => {
  const agentes = Object.keys(FLEET);
  assert.equal(agentes.length, 5);
  assert.deepEqual(agentes, ["buzzfly1", "buzzfly2", "buzzfly3", "buzzfly4", "buzzfly5"]);
  assert.equal(new Set(Object.values(FLEET).map(f => f.source)).size, 5);
  assert.equal(AGENT_BY_SOURCE.urbania, "buzzfly2");
  assert.equal(AGENT_BY_SOURCE.bestia, "buzzfly5");
  // Nadie escribe ya bajo el conejo: ese solapamiento fue la causa del apagón.
  assert.ok(!agentes.includes("white-rabbit"));
});

test("flota al día → ningún hallazgo", () => {
  assert.deepEqual(staleFindings(frescos(), NOW), []);
});

test("scraper atrasado pasado su tolerancia → hallazgo major", () => {
  const last = frescos();
  last.buzzfly3 = NOW - 7 * H;              // Nexo corre cada hora, tolera 6
  const f = staleFindings(last, NOW);
  assert.equal(f.length, 1);
  assert.equal(f[0].agent, "buzzfly3");
  assert.equal(f[0].severity, "major");
  assert.equal(f[0].category, "datos-viejos");
  assert.match(f[0].detail, /7h/);
});

test("justo en el límite todavía no alarma (una corrida perdida no es incendio)", () => {
  const last = frescos();
  last.buzzfly3 = NOW - 6 * H;
  assert.deepEqual(staleFindings(last, NOW), []);
});

test("silencio largo escala a critical — el caso de la bestia", () => {
  const last = frescos();
  last.buzzfly5 = NOW - 7 * 24 * H;         // los 7 días reales sin pushear
  const f = staleFindings(last, NOW);
  assert.equal(f.length, 1);
  assert.equal(f[0].agent, "buzzfly5");
  assert.equal(f[0].severity, "critical");
});

test("sin una sola corrida OK → critical y lo dice en criollo", () => {
  const last = frescos();
  last.buzzfly2 = null;
  const f = staleFindings(last, NOW);
  assert.equal(f[0].severity, "critical");
  assert.match(f[0].detail, /mudo/);
});

test("un scraper roto no tapa a los otros: cada uno reporta por su cuenta", () => {
  const last = frescos();
  last.buzzfly1 = null;                     // SBS mudo
  last.buzzfly2 = NOW - 40 * H;             // Urbania atrasado
  const f = staleFindings(last, NOW);
  assert.equal(f.length, 2);
  assert.deepEqual(f.map(x => x.agent).sort(), ["buzzfly1", "buzzfly2"]);
  assert.equal(new Set(f.map(x => x.agent)).size, 2);
});

test("tsMs lee el formato de SQLite como UTC (no como hora local)", () => {
  assert.equal(tsMs("2026-09-16 11:00:09"), Date.parse("2026-09-16T11:00:09Z"));
  assert.equal(tsMs(null), null);
  assert.equal(tsMs("basura"), null);
});

test("frescura: la huella del dato vale tanto como la corrida registrada", () => {
  // Un scraper recién bautizado no tiene corridas con su nombre nuevo, pero sus datos
  // sí están frescos: medir solo el papeleo lo declararía muerto sin motivo.
  assert.equal(masReciente(null, NOW - 2 * H), NOW - 2 * H);
  assert.equal(masReciente(NOW - 2 * H, null), NOW - 2 * H);
  assert.equal(masReciente(NOW - 9 * H, NOW - 2 * H), NOW - 2 * H);
  assert.equal(masReciente(null, null), null);
});

test("cada fuente con tabla propia sabe dónde mirar su huella", () => {
  for (const [agent, cfg] of Object.entries(FLEET)) {
    if (agent === "buzzfly5") { assert.equal(cfg.datos, null); continue; }  // pushea a tablas ajenas
    assert.match(cfg.datos.sql, /^SELECT MAX\(scraped_at\) AS ts FROM \w+ WHERE source = '/);
    assert.ok(cfg.datos.sql.includes(`'${cfg.source}'`), `${agent} debe filtrar por su propia fuente`);
  }
});
