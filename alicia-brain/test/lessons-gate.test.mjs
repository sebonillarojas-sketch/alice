import { test } from "node:test";
import assert from "node:assert/strict";
import { checkContradictsHardRules, evaluateGate } from "../src/lessons.js";

const RULES = [{ id: "no-autoridad", test: t => /borrar.*sin confirmar|force.?push/i.test(t), reason: "viola límites de autoridad" }];

test("contradice regla dura → contradicts true", () => {
  const r = checkContradictsHardRules("hacer force-push a main", RULES);
  assert.equal(r.contradicts, true);
  assert.match(r.reason, /autoridad/);
});
test("no contradice → false", () => {
  assert.equal(checkContradictsHardRules("saludar más corto", RULES).contradicts, false);
});
test("gate: contradice → reject", () => {
  assert.equal(evaluateGate({ contradicts: true, evidence_count: 9, risk_level: "L0" }, {}).decision, "reject");
});
test("gate: L0 con evidencia → auto_apply", () => {
  assert.equal(evaluateGate({ contradicts: false, evidence_count: 3, risk_level: "L0" }, { minEvidence: 3 }).decision, "auto_apply");
});
test("gate: poca evidencia → needs_human", () => {
  assert.equal(evaluateGate({ contradicts: false, evidence_count: 1, risk_level: "L0" }, { minEvidence: 3 }).decision, "needs_human");
});
test("gate: L2 con evidencia → needs_human", () => {
  assert.equal(evaluateGate({ contradicts: false, evidence_count: 5, risk_level: "L2" }, { minEvidence: 3 }).decision, "needs_human");
});
