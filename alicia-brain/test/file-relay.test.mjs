import { test } from "node:test";
import assert from "node:assert/strict";
import { stageFile, getStagedFile } from "../src/file-relay.js";

test("stage + get roundtrip", () => {
  const id = stageFile({ buffer: Buffer.from("hola"), mime: "application/pdf", filename: "x.pdf" });
  const f = getStagedFile(id);
  assert.equal(f.buffer.toString(), "hola");
  assert.equal(f.mime, "application/pdf");
  assert.equal(f.filename, "x.pdf");
});
test("id inexistente → null", () => {
  assert.equal(getStagedFile("nope"), null);
});
