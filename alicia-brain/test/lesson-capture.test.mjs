import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonFromCorrection, lessonFromFinding, lessonsFromTeaTable } from "../src/lesson-capture.js";

test("corrección con notas → lección L1 de bammy", () => {
  const a = lessonFromCorrection({ unidad: "2D", notas: "la cocina va al muro húmedo", veredicto: "a_corregir" });
  assert.equal(a.scope, "agent:bammy");
  assert.equal(a.source, "correction");
  assert.match(a.lesson, /muro húmedo/);
  assert.equal(a.risk_level, "L1");
});
test("corrección sin notas → null", () => {
  assert.equal(lessonFromCorrection({ unidad: "2D", notas: "" }), null);
});
test("finding wont-fix → lección de no-reportar", () => {
  const a = lessonFromFinding({ agent: "knave", category: "cors", detail: "CORS en /health", status: "wont-fix" });
  assert.equal(a.scope, "agent:knave");
  assert.match(a.lesson, /No reportar/);
});
test("finding resuelto normal → null", () => {
  assert.equal(lessonFromFinding({ agent: "knave", status: "resolved" }), null);
});
test("Tea Table extrae bullets de ## Lecciones", () => {
  const md = "# Estado\ntexto\n## Lecciones\n- reportar en español\n- consolidar checks\n## Otra\n- no";
  const out = lessonsFromTeaTable(md);
  assert.equal(out.length, 2);
  assert.equal(out[0].scope, "global");
  assert.match(out[0].lesson, /español/);
});
test("Tea Table sin sección → []", () => {
  assert.deepEqual(lessonsFromTeaTable("# Estado\nsin lecciones"), []);
});
