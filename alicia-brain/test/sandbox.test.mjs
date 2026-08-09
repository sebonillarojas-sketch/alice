import { test } from "node:test";
import assert from "node:assert/strict";
import { isSandbox } from "../src/sandbox.js";
test("isSandbox refleja SANDBOX=1", () => {
  const prev = process.env.SANDBOX;
  process.env.SANDBOX = "1"; assert.equal(isSandbox(), true);
  process.env.SANDBOX = "0"; assert.equal(isSandbox(), false);
  delete process.env.SANDBOX; assert.equal(isSandbox(), false);
  if (prev !== undefined) process.env.SANDBOX = prev;
});
