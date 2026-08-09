import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLessonsBlock } from "../src/lessons.js";

test("formatLessonsBlock arma un bloque con las lecciones", () => {
  const b = formatLessonsBlock(["responder más corto", "usar español"]);
  assert.match(b, /Lecciones aprendidas/i);
  assert.match(b, /responder más corto/);
  assert.match(b, /usar español/);
});
test("formatLessonsBlock vacío → string vacío", () => {
  assert.equal(formatLessonsBlock([]), "");
});
