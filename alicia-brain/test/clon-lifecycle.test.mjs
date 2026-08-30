import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCloneEnv } from "../scripts/clon-nocturno.js";
test("buildCloneEnv pela secrets y setea sandbox/port", () => {
  const env = buildCloneEnv({ TWILIO_ACCOUNT_SID: "x", SUPABASE_SECRET_KEY: "y", ANTHROPIC_API_KEY: "z", PATH: "/usr/bin" });
  assert.equal(env.SANDBOX, "1");
  assert.equal(env.PORT, "3099");
  assert.ok(/clone/.test(env.SQLITE_PATH));
  assert.equal(env.GATE_DEV_OPEN, "1");  // gate abierto para que Jabberwocky fuzzee /api/chat
  assert.equal(env.TWILIO_ACCOUNT_SID, undefined);
  assert.equal(env.SUPABASE_SECRET_KEY, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.PATH, "/usr/bin"); // lo no-secreto se conserva
});
