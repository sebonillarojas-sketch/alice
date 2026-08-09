import { test } from "node:test";
import assert from "node:assert/strict";
import { isCloneTarget, fuzzInputs, runFuzz, buildSkippedReport } from "../scripts/jabberwocky.js";

test("isCloneTarget solo el clon", () => {
  assert.equal(isCloneTarget("http://localhost:3099"), true);
  assert.equal(isCloneTarget("https://aliceai.bam.pe"), false);
  assert.equal(isCloneTarget(""), false);
});

test("fuzzInputs trae inputs adversariales variados", () => {
  const f = fuzzInputs();
  assert.ok(f.length >= 5);
  assert.ok(f.some(x => x.length > 5000)); // input larguísimo
  assert.ok(f.some(x => /ignora|instruc/i.test(x))); // prompt injection
});

test("buildSkippedReport se mantiene por compat", () => {
  const payload = buildSkippedReport();
  assert.equal(payload.agent, "jabberwocky");
  assert.equal(payload.result, "ok");
});

test("runFuzz revienta si el target no es el clon", async () => {
  await assert.rejects(
    () => runFuzz("https://aliceai.bam.pe"),
    /SOLO corre contra el clon/
  );
});

test("runFuzz ok cuando todos los inputs responden < 500", async () => {
  const fetchImpl = async () => ({ status: 200 });
  const report = await runFuzz("http://localhost:3099", { fetchImpl });
  assert.equal(report.agent, "jabberwocky");
  assert.equal(report.result, "ok");
  assert.equal(report.findings.length, 0);
  assert.equal(report.actions_taken.length, fuzzInputs().length);
});

test("runFuzz reporta issues cuando algún input causa HTTP 5xx", async () => {
  let call = 0;
  const fetchImpl = async () => {
    call++;
    return call === 1 ? { status: 500 } : { status: 200 };
  };
  const report = await runFuzz("http://localhost:3099", { fetchImpl });
  assert.equal(report.result, "issues");
  assert.ok(report.findings.length > 0);
  assert.equal(report.findings[0].category, "fuzz-500");
});

test("runFuzz reporta finding minor cuando un input rompe la request", async () => {
  const fetchImpl = async () => { throw new Error("network kaboom"); };
  const report = await runFuzz("http://localhost:3099", { fetchImpl });
  assert.equal(report.result, "issues");
  assert.ok(report.findings.some(f => f.category === "fuzz-error"));
});
