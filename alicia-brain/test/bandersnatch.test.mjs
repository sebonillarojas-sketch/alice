import { test } from "node:test";
import assert from "node:assert/strict";
import { isCloneTarget, runChaos, buildSkippedReport } from "../scripts/bandersnatch.js";

test("isCloneTarget solo acepta el clon local", () => {
  assert.equal(isCloneTarget("http://localhost:3099"), true);
  assert.equal(isCloneTarget("https://aliceai.bam.pe"), false);
  assert.equal(isCloneTarget(""), false);
});

test("buildSkippedReport se mantiene por compat", () => {
  const payload = buildSkippedReport();
  assert.equal(payload.agent, "bandersnatch");
  assert.equal(payload.result, "ok");
});

test("runChaos revienta si el target no es el clon", async () => {
  await assert.rejects(
    () => runChaos("https://aliceai.bam.pe"),
    /SOLO corre contra el clon/
  );
});

test("runChaos ok cuando todas las cargas responden bien", async () => {
  const fetchImpl = async () => ({ ok: true });
  const report = await runChaos("http://localhost:3099", { fetchImpl });
  assert.equal(report.agent, "bandersnatch");
  assert.equal(report.result, "ok");
  assert.equal(report.findings.length, 0);
  assert.equal(report.actions_taken.length, 4);
});

test("runChaos reporta issues cuando el brain degrada bajo carga", async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    // Falla la mitad de las requests para simular degradación.
    return call % 2 === 0 ? { ok: false } : { ok: true };
  };
  const report = await runChaos("http://localhost:3099", { fetchImpl });
  assert.equal(report.result, "issues");
  assert.ok(report.findings.length > 0);
  assert.equal(report.findings[0].category, "chaos-degradacion");
});
