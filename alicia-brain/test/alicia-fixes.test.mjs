import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePhone } from "../src/tools.js";
import { coalesceMessage, _pending, _flushNow, _reset } from "../src/coalesce.js";

// db falso: profiles vacío (como en prod, donde el número de sb vive en PHONE_sb, no en la tabla)
const emptyDb = { prepare: () => ({ get: () => undefined }) };
const dbWithRow = { prepare: () => ({ get: () => ({ phone: "+51999111222" }) }) };

test("resolvePhone: usa la tabla profiles si tiene el número", () => {
  assert.equal(resolvePhone(dbWithRow, "vd"), "+51999111222");
});

test("resolvePhone: cae al env PHONE_<id> cuando profiles no lo tiene", () => {
  process.env.PHONE_sb = "+51987654321";
  assert.equal(resolvePhone(emptyDb, "sb"), "+51987654321");
  delete process.env.PHONE_sb;
});

test("resolvePhone: null si no está ni en profiles ni en env", () => {
  assert.equal(resolvePhone(emptyDb, "nadie"), null);
});

// ── Coalescencia ──
test("coalesce: junta mensajes seguidos y llama al handler UNA vez con el texto completo", async () => {
  _reset();
  const calls = [];
  const h = async (joined, meta) => { calls.push({ joined, meta }); };
  coalesceMessage("sb", "Pásame los planos", h, { windowMs: 10000 });
  coalesceMessage("sb", "de Francisco del Castillo", h, { windowMs: 10000 });
  assert.deepEqual(_pending("sb"), ["Pásame los planos", "de Francisco del Castillo"]);
  await _flushNow("sb");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].joined, "Pásame los planos\nde Francisco del Castillo");
});

test("coalesce: wasAudio es true si algún fragmento del burst fue audio", async () => {
  _reset();
  let meta;
  const h = async (_joined, m) => { meta = m; };
  coalesceMessage("sb", "texto", h, { windowMs: 10000, wasAudio: false });
  coalesceMessage("sb", "otro", h, { windowMs: 10000, wasAudio: true });
  await _flushNow("sb");
  assert.equal(meta.wasAudio, true);
});

test("coalesce: tras el flush, un mensaje nuevo abre un burst limpio", async () => {
  _reset();
  const joins = [];
  const h = async (joined) => { joins.push(joined); };
  coalesceMessage("sb", "uno", h, { windowMs: 10000 });
  await _flushNow("sb");
  coalesceMessage("sb", "dos", h, { windowMs: 10000 });
  await _flushNow("sb");
  assert.deepEqual(joins, ["uno", "dos"]);
});
