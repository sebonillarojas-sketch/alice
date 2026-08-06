// Regresión de los parsers de scraping contra capturas REALES (recortadas).
// Corre con: node --test test/scrapers.test.mjs
//
// Estas capturas se tomaron el 24-25/07/2026. Si SBS/Urbania cambian su HTML y
// estos tests rompen, es la señal temprana de que hay que reajustar los parsers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseSBS } from "../src/scrapers/sbs.js";
import { extractDetailUrls, parseDetail } from "../src/scrapers/urbania.js";

const DIR = dirname(fileURLToPath(import.meta.url));
const fix = (f) => readFileSync(join(DIR, "fixtures", f), "utf8");

test("SBS: extrae tasas hipotecarias por banco (PEN/USD) de la captura real", () => {
  const rows = parseSBS(fix("sbs.hipotecario.html"));
  const by = Object.fromEntries(rows.map((r) => [r.bank, r]));

  // Valores confirmados en la captura del 24/07/2026.
  assert.equal(by["BBVA"].rate_pen, 7.67);
  assert.equal(by["BBVA"].rate_usd, 6.92);
  assert.equal(by["BCP"].rate_pen, 7.85);       // "Crédito" → alias BCP
  assert.equal(by["BCP"].rate_usd, 6.80);
  assert.equal(by["Scotiabank"].rate_pen, 7.75);
  assert.equal(by["Scotiabank"].rate_usd, 6.46);
  assert.equal(by["Interbank"].rate_pen, 7.68);
  assert.equal(by["Promedio SBS"].rate_pen, 7.82);
  assert.equal(by["Promedio SBS"].rate_usd, 6.80);

  // Un banco que no ofrece hipotecario no debe aparecer (todo "-").
  assert.ok(!by["Falabella"], "Falabella no ofrece hipotecario → no debería estar");
  // Forma correcta para saveBankRates.
  for (const r of rows) {
    assert.equal(r.product, "hipotecario");
    assert.equal(r.source, "sbs");
    assert.ok(r.rate_pen != null || r.rate_usd != null);
  }
});

test("Urbania: extrae URLs de detalle de la página de búsqueda", () => {
  const urls = extractDetailUrls(fix("urbania.search.html"));
  assert.ok(urls.length >= 20, `esperaba ≥20 URLs, hubo ${urls.length}`);
  assert.ok(urls.every((u) => u.includes("/inmueble/")));
  assert.ok(urls.every((u) => !u.includes("&amp;") && !u.includes("?")), "URLs sin entidades ni query");
});

test("Urbania: parsea un detalle real a registro normalizado", () => {
  const rec = parseDetail(fix("urbania.detail.html"), "https://urbania.pe/inmueble/proyecto/x-386000", 3.75);
  assert.equal(rec.source, "urbania");
  assert.equal(rec.district, "San Miguel");
  assert.equal(rec.currency, "PEN");
  assert.equal(rec.list_price_pen, 386000);
  assert.equal(rec.min_area_m2, 73);
  assert.equal(rec.dorms_min, 2);
  assert.ok(Math.abs(rec.lat - -12.079194) < 1e-5);
  assert.ok(Math.abs(rec.lng - -77.107261) < 1e-4);
  // PEN → USD con TC 3.75 y $/m² derivado.
  assert.equal(rec.list_price_usd, Math.round(386000 / 3.75));
  assert.equal(rec.list_price_m2_usd, Math.round(386000 / 3.75 / 73));
});
