import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSecurityHeaders, checkCorsOpen, checkAuthRejected } from "../src/knave-checks.js";

test("headers: faltan HSTS y CSP → 2 findings major", () => {
  const f = checkSecurityHeaders({ "x-frame-options": "DENY", "x-content-type-options": "nosniff" });
  const cats = f.map(x => x.detail);
  assert.equal(f.length, 2);
  assert.ok(f.every(x => x.severity === "major" && x.category === "security-headers"));
  assert.ok(cats.some(d => /strict-transport-security/i.test(d)));
  assert.ok(cats.some(d => /content-security-policy/i.test(d)));
});

test("headers: todos presentes → sin findings", () => {
  const f = checkSecurityHeaders({
    "strict-transport-security": "max-age=63072000",
    "content-security-policy": "default-src 'self'",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
  });
  assert.equal(f.length, 0);
});

test("cors: refleja '*' → finding critical", () => {
  const f = checkCorsOpen("*");
  assert.equal(f.severity, "critical");
  assert.equal(f.category, "cors");
});

test("cors: refleja el origin hostil → finding critical", () => {
  const f = checkCorsOpen("https://evil.example");
  assert.ok(f && f.severity === "critical");
});

test("cors: null/ausente → sin finding", () => {
  assert.equal(checkCorsOpen(null), null);
});

test("auth: ruta protegida devuelve 200 sin token → finding critical", () => {
  const f = checkAuthRejected(200);
  assert.ok(f && f.severity === "critical" && f.category === "auth-gate");
});

test("auth: 401 → sin finding", () => {
  assert.equal(checkAuthRejected(401), null);
});
