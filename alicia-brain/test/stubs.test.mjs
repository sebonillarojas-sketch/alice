import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSkippedReport as bander } from "../scripts/bandersnatch.js";
import { buildSkippedReport as jabber } from "../scripts/jabberwocky.js";

test("bandersnatch stub: reporte en espera, sin findings", () => {
  const r = bander();
  assert.equal(r.agent, "bandersnatch");
  assert.equal(r.result, "ok");
  assert.match(r.summary, /clon nocturno/i);
  assert.deepEqual(r.findings, []);
});

test("jabberwocky stub: reporte en espera, sin findings", () => {
  const r = jabber();
  assert.equal(r.agent, "jabberwocky");
  assert.equal(r.result, "ok");
  assert.match(r.summary, /clon nocturno/i);
});
