import { test } from "node:test";
import assert from "node:assert/strict";

// Con SANDBOX=1, ninguna salida externa debe ejecutarse. El clon nocturno
// corre con SANDBOX=1 → estos guards son el 2º candado (además del env pelado).
process.env.SANDBOX = "1";

const { sendWAWebText, sendWAWebAudio, sendWAWebDocument } = await import("../src/waweb.js");
const { getTasks, deleteTask } = await import("../src/supabase-tasks.js");

test("waweb: los senders devuelven false en sandbox (no tocan WhatsApp)", async () => {
  assert.equal(await sendWAWebText("+51999", "hola"), false);
  assert.equal(await sendWAWebAudio("+51999", Buffer.from("x")), false);
  assert.equal(await sendWAWebDocument("+51999", Buffer.from("x")), false);
});

test("supabase: getTasks devuelve [] y deleteTask true en sandbox (no toca Supabase)", async () => {
  assert.deepEqual(await getTasks({}), []);
  assert.equal(await deleteTask(123), true);
});
