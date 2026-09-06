import test from "node:test";
import assert from "node:assert/strict";
import { discardFloorProposalRecord } from "../src/modules/cabida/floorProposal.js";

const baseProject = (overrides = {}) => ({
  id: "proy1",
  cabida: {
    floorProposals: [
      { id: "floor_proy1_v1", version: 1, summary: "v1" },
      { id: "floor_proy1_v2", version: 2, summary: "v2" },
    ],
    activeFloorProposalId: "floor_proy1_v2",
  },
  plano: { rooms: [], floorProposal: { id: "floor_proy1_v2", summary: "v2" }, floorProposalMaterializedId: "floor_proy1_v2" },
  ...overrides,
});

test("descartar la propuesta sembrada en el plano también limpia plano.floorProposal", () => {
  const project = baseProject();
  const out = discardFloorProposalRecord(project, "floor_proy1_v2", "no me gusta la circulación");

  const discarded = out.cabida.floorProposals.find((p) => p.id === "floor_proy1_v2");
  assert.equal(discarded.descartada, true);
  assert.equal(discarded.motivoDescarte, "no me gusta la circulación");
  assert.equal(out.cabida.activeFloorProposalId, null);

  assert.equal(out.plano.floorProposal, undefined, "plano.floorProposal debe limpiarse: es la propuesta descartada");
  assert.equal(out.plano.floorProposalMaterializedId, undefined);
  assert.deepEqual(out.plano.rooms, [], "el resto del plano no debe tocarse");

  // no debe mutar el project original
  assert.equal(project.plano.floorProposal.id, "floor_proy1_v2");
});

test("descartar una propuesta que no es la sembrada en el plano no toca plano.floorProposal", () => {
  const project = baseProject();
  const out = discardFloorProposalRecord(project, "floor_proy1_v1", "vieja, ya no aplica");

  const discarded = out.cabida.floorProposals.find((p) => p.id === "floor_proy1_v1");
  assert.equal(discarded.descartada, true);
  // la activa (v2) no era la descartada (v1): sigue activa
  assert.equal(out.cabida.activeFloorProposalId, "floor_proy1_v2");

  // v2 sigue sembrada en el plano, intacta
  assert.equal(out.plano.floorProposal.id, "floor_proy1_v2");
  assert.equal(out.plano.floorProposalMaterializedId, "floor_proy1_v2");
});

test("descartar cuando el plano no tiene floorProposal sembrada no agrega nada", () => {
  const project = baseProject({ plano: { rooms: [] } });
  const out = discardFloorProposalRecord(project, "floor_proy1_v1", "");
  assert.equal(out.plano.floorProposal, undefined);
  assert.deepEqual(out.plano.rooms, []);
});
