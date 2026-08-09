import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePhone } from "../src/tools.js";

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
