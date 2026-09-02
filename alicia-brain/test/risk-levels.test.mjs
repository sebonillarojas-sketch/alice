import { test } from "node:test";
import assert from "node:assert/strict";
import { isCosmetic, resolveRiskLevel } from "../src/risk-levels.js";

test("isCosmetic: reconoce lecciones de tono y wording", () => {
  for (const t of [
    "Saludar más corto",
    "No usar tantos emojis en las respuestas",
    "Responder más breve y directo",
    "Evitar el markdown en WhatsApp, no se renderiza",
    "Usar un tono más cálido al cerrar",
  ]) {
    assert.equal(isCosmetic(t), true, `debería ser cosmética: ${t}`);
  }
});

test("isCosmetic: no marca lecciones que cambian comportamiento o decisiones", () => {
  for (const t of [
    "Antes de crear una tarea, confirmar el responsable",
    "No reportar como problema los findings de contraste",
    "Priorizar los terrenos de San Isidro sobre los de Surco",
    "Revisar el RNE antes de proponer una distribución",
  ]) {
    assert.equal(isCosmetic(t), false, `NO debería ser cosmética: ${t}`);
  }
});

test("isCosmetic: una lección mixta NO es cosmética aunque hable de tono", () => {
  // El caso que justifica el guard: forma + acción. Cae del lado seguro.
  assert.equal(isCosmetic("Saludar más corto y borrar los borradores viejos"), false);
  assert.equal(isCosmetic("Usar menos emojis y asignarle las tareas a Bammy"), false);
});

test("isCosmetic: entradas raras no explotan y no son cosméticas", () => {
  assert.equal(isCosmetic(""), false);
  assert.equal(isCosmetic(null), false);
  assert.equal(isCosmetic(undefined), false);
  assert.equal(isCosmetic(12345), false);
});

test("resolveRiskLevel: una L0 declarada sobre texto cosmético se respeta", () => {
  assert.equal(resolveRiskLevel("L0", "Saludar más corto"), "L0");
});

test("resolveRiskLevel: una L0 declarada sobre texto NO cosmético baja a L1", () => {
  assert.equal(resolveRiskLevel("L0", "Antes de crear una tarea, confirmar el responsable"), "L1");
  assert.equal(resolveRiskLevel("L0", "Saludar más corto y borrar los borradores viejos"), "L1");
});

test("resolveRiskLevel: los niveles que no son L0 pasan intactos", () => {
  assert.equal(resolveRiskLevel("L1", "Saludar más corto"), "L1");
  assert.equal(resolveRiskLevel("L2", "cualquier cosa"), "L2");
  assert.equal(resolveRiskLevel("L3", "cualquier cosa"), "L3");
});

test("resolveRiskLevel: sin nivel declarado devuelve L1", () => {
  assert.equal(resolveRiskLevel(undefined, "Saludar más corto"), "L1");
  assert.equal(resolveRiskLevel(null, "Saludar más corto"), "L1");
});
