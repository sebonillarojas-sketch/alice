import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readState, writeState, tick } from "../scripts/bestia-runner.js";

test("readState de archivo inexistente → {}", () => {
  assert.deepEqual(readState(join(tmpdir(), "no-existe-xyz.json")), {});
});

test("writeState + readState roundtrip", () => {
  const dir = mkdtempSync(join(tmpdir(), "bestia-"));
  const p = join(dir, "state.json");
  writeState(p, { knave: 42 });
  assert.deepEqual(readState(p), { knave: 42 });
  rmSync(dir, { recursive: true, force: true });
});

test("tick dispara jobs vencidos y persiste su timestamp", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bestia-"));
  const p = join(dir, "state.json");
  const spawned = [];
  let pulled = false;
  await tick({
    now: 1_000_000_000,
    statePath: p,
    pull: async () => { pulled = true; },
    spawn: async (job) => { spawned.push(job.id); },
  });
  assert.ok(pulled, "debe hacer pull");
  assert.ok(spawned.includes("cheshire") && spawned.includes("knave"));
  const st = readState(p);
  assert.ok(st.cheshire === 1_000_000_000);
  rmSync(dir, { recursive: true, force: true });
});
