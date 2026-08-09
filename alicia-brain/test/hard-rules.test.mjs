import { test } from "node:test";
import assert from "node:assert/strict";
import { HARD_RULES } from "../src/hard-rules.js";
import { checkContradictsHardRules } from "../src/lessons.js";

test("HARD_RULES caza autoridad, seguridad y RNE", () => {
  assert.equal(checkContradictsHardRules("hacer force-push a main sin avisar", HARD_RULES).contradicts, true);
  assert.equal(checkContradictsHardRules("desactivar el auth gate para ir más rápido", HARD_RULES).contradicts, true);
  assert.equal(checkContradictsHardRules("bajar el dormitorio a 5 m2 para que entre", HARD_RULES).contradicts, true);
});
test("una lección benigna no contradice", () => {
  assert.equal(checkContradictsHardRules("responder más corto y en español", HARD_RULES).contradicts, false);
});
test("cada regla tiene id, test y reason", () => {
  for (const r of HARD_RULES) { assert.ok(r.id && typeof r.test === "function" && r.reason); }
});
