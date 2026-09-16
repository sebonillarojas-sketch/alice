// Ciclo de vida de los hallazgos de la flota 🪰, contra una base SQLite real.
//
// Esta es la regresión del apagón del 16/09/2026: el hallazgo del scraper existía
// en la base y aun así nadie se enteró, porque la guardia de infra lo cerraba de
// paso. Lo pura-lógica lo cubre fleet.test.mjs; acá se prueba lo que solo se ve
// con la base delante: quién cierra qué, y que nadie cierre lo ajeno.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Antes de importar db.js: el módulo lee SQLITE_PATH al abrir la conexión.
const DIR = mkdtempSync(join(tmpdir(), "fleet-"));
process.env.SQLITE_PATH = join(DIR, "fleet.db");

const { query } = await import("../src/db.js");
const { ensureMarketSchema } = await import("../src/market.js");
const { recordScraperRun, checkFleetFreshness } = await import("../src/scrapers/fleet.js");

// El UPDATE textual de la guardia de infra (whiterabbit.js) cuando sus checks pasan.
const guardiaDeInfraCierraLoSuyo = () => query(
  `UPDATE agent_findings SET status = 'auto-fixed', resolved_by = 'white-rabbit', updated_at = datetime('now')
   WHERE agent = 'white-rabbit' AND category = 'infra-publica' AND status IN ('open','escalated')`
);

const abiertos = (agent) => query(
  `SELECT severity, category, detail FROM agent_findings WHERE agent = ? AND status IN ('open','escalated')`,
  [agent]
).rows;

before(() => { ensureMarketSchema(); });
after(() => { rmSync(DIR, { recursive: true, force: true }); });

test("el hallazgo del scraper sobrevive a la guardia de infra", () => {
  recordScraperRun("buzzfly2", {
    result: "error",
    summary: "Urbania: sin datos",
    findings: [{ severity: "major", category: "scraper", detail: "Urbania: 0 registros (¿challenge/proxy?)" }],
  });
  assert.equal(abiertos("buzzfly2").length, 1);

  guardiaDeInfraCierraLoSuyo();   // acá era donde desaparecía
  assert.equal(abiertos("buzzfly2").length, 1);
});

test("el scraper cierra sus propios hallazgos cuando vuelve a traer datos", () => {
  assert.equal(abiertos("buzzfly2").length, 1);
  recordScraperRun("buzzfly2", { result: "ok", summary: "Urbania: 40 listings" });
  assert.equal(abiertos("buzzfly2").length, 0);
});

test("un scraper no toca los hallazgos de otro", () => {
  recordScraperRun("buzzfly1", {
    result: "error",
    summary: "SBS: sin datos",
    findings: [{ severity: "major", category: "scraper", detail: "SBS: no se hallaron las grillas" }],
  });
  recordScraperRun("buzzfly3", { result: "ok", summary: "Nexo: 233 proyectos" });
  assert.equal(abiertos("buzzfly1").length, 1, "el OK de Nexo no puede tapar el fallo de SBS");
});

test("frescura: abre un hallazgo por scraper mudo y no lo repite cada hora", () => {
  const primera = checkFleetFreshness();
  assert.ok(primera.stale.length >= 1);
  const segunda = checkFleetFreshness();
  assert.equal(segunda.nuevos, 0, "el mismo grito cada hora es ruido, no alerta");
});

test("frescura: cuando los datos vuelven, el hallazgo se cierra solo", () => {
  // Wynwood vuelve a tener listings frescos aunque la corrida no la haya registrado
  // él (la bestia escribe en las mismas tablas) — el hallazgo no puede quedar colgado.
  assert.ok(abiertos("buzzfly4").some(f => f.category === "datos-viejos"));
  query(
    `INSERT INTO rental_listings (source, external_code, title, nightly_rate, scraped_at)
     VALUES ('wynwood_house', 'WH-1', 'Depa Miraflores', 120, datetime('now'))`
  );
  checkFleetFreshness();
  assert.equal(abiertos("buzzfly4").filter(f => f.category === "datos-viejos").length, 0);
});
