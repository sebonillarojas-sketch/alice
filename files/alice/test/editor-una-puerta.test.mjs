// El Editor de Planos edita la propuesta que Cabida ya resolvió — no genera desde cero.
// Este test falla si vuelve a aparecer una puerta de generación (pasos/bibliotecas viejas).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ed = readFileSync(new URL("../src/modules/planos/EditorPlanos.jsx", import.meta.url), "utf8");

test("el editor no vuelve a traer una puerta de generacion propia", () => {
  for (const name of ["DistribModal", "TipoModal", "TipologiasNexoPanel", "ConfigTipologiaPanel"]) {
    assert.ok(!ed.includes(name), `reapareció ${name} en EditorPlanos.jsx`);
  }
});
