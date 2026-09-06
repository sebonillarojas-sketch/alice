import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("los endpoints de Feyd ya no existen", () => {
  const server = read("../src/server.js");
  assert.ok(!server.includes("/api/arquitecto/disenar"));
  assert.ok(!server.includes("/api/arquitecto/corregir"));
});

test("el frontend ya no llama a Feyd", () => {
  const feyd = read("../../files/alice/src/modules/planos/feyd.js");
  assert.ok(!feyd.includes("disenarConFeyd"));
  assert.ok(!feyd.includes("corregirConFeyd"));
});

test("la capa de materializacion sigue intacta", () => {
  const feyd = read("../../files/alice/src/modules/planos/feyd.js");
  for (const fn of ["preserveLockedRooms", "splitAcceptedFloor", "materializeUnitInteriors",
                    "materializeWithOneRevision", "validateGeneratedInterior", "resolveArchitectureProgram",
                    "planALayout", "roomsALayout", "layoutARooms", "isRoomEditable", "reanclarItems"]) {
    assert.ok(feyd.includes(`export function ${fn}`) || feyd.includes(`export const ${fn}`) ||
              feyd.includes(`export async function ${fn}`), `falta ${fn}`);
  }
});

test("el editor ya no tiene el generador huerfano", () => {
  const ed = read("../../files/alice/src/modules/planos/EditorPlanos.jsx");
  assert.ok(!ed.includes("generarTipoConFeyd"));
});

test("la herramienta de delegacion a Feyd ya no esta en tools.js", () => {
  const tools = read("../src/tools.js");
  assert.ok(!tools.includes("disenar_plano"));
  assert.ok(!tools.includes("./arquitecto.js"));
});
