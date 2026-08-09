import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeMarket, isFresh, formatMarketSummary } from "../src/radar.js";

const snap = {
  source: "nexo",
  scraped_at: "2026-08-06 12:00:00",
  projects: [
    { name: "Torre A", district: "San Isidro", dorms_min: 1, dorms_max: 3, list_price_m2_usd: 2500 },
    { name: "Edif B", district: "San Isidro", dorms_min: 2, dorms_max: 2, list_price_m2_usd: 2700 },
    { name: "Casa C", district: "Miraflores", dorms_min: 3, dorms_max: 4, list_price_m2_usd: 3100 },
    { name: "Depa D", district: "Surco", dorms_min: 1, dorms_max: 1, list_price_m2_usd: null },
  ],
};

test("summarizeMarket: filtra por distrito (case-insensitive)", () => {
  const s = summarizeMarket(snap, { district: "san isidro" });
  assert.equal(s.empty, false);
  assert.equal(s.count, 2);
  assert.deepEqual(s.price_m2_usd, { min: 2500, max: 2700, avg: 2600 });
});

test("summarizeMarket: filtra por tipología (dorms dentro del rango)", () => {
  const s = summarizeMarket(snap, { dorms: 3 });
  // Torre A (1-3) y Casa C (3-4) incluyen 3; Edif B (2-2) y Depa D (1-1) no.
  assert.equal(s.count, 2);
  const names = s.projects.map(p => p.name).sort();
  assert.deepEqual(names, ["Casa C", "Torre A"]);
});

test("summarizeMarket: sin match → empty con scraped_at", () => {
  const s = summarizeMarket(snap, { district: "Barranco" });
  assert.equal(s.empty, true);
  assert.equal(s.scraped_at, "2026-08-06 12:00:00");
});

test("summarizeMarket: snapshot vacío/nulo → empty", () => {
  assert.equal(summarizeMarket(null, {}).empty, true);
  assert.equal(summarizeMarket({ projects: [] }, {}).empty, true);
});

test("isFresh: reciente true, viejo false, ausente false", () => {
  const now = Date.parse("2026-08-06T12:10:00Z");
  assert.equal(isFresh("2026-08-06 12:05:00", { now }), true);   // hace 5 min
  assert.equal(isFresh("2026-08-06 11:40:00", { now }), false);  // hace 30 min
  assert.equal(isFresh(null, { now }), false);
});

test("formatMarketSummary: vacío ofrece refrescar; con data incluye distrito y precios", () => {
  const vacio = formatMarketSummary(summarizeMarket(snap, { district: "Barranco" }));
  assert.match(vacio, /refresque|refrescar/i);
  assert.match(vacio, /Barranco/);
  const lleno = formatMarketSummary(summarizeMarket(snap, { district: "San Isidro" }));
  assert.match(lleno, /San Isidro/);
  assert.match(lleno, /2500/);
  assert.match(lleno, /2 proyecto/);
});
