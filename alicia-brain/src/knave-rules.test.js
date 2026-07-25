import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluarHeaders, evaluarRateLimit, resultDe } from "./knave-rules.js";

test("detecta headers de seguridad faltantes", () => {
  const f = evaluarHeaders({ url: "https://x", status: 200, headers: {} });
  const cats = f.map(x => x.detail);
  assert.ok(f.some(x => /HSTS/.test(x.detail)));
  assert.ok(f.some(x => /nosniff/.test(x.detail)));
  assert.ok(f.some(x => /Content-Security-Policy/.test(x.detail)));
});
test("una respuesta bien configurada no genera findings de headers", () => {
  const f = evaluarHeaders({ url: "https://x", headers: {
    "strict-transport-security": "max-age=63072000",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  }});
  assert.equal(f.length, 0);
});
test("x-powered-by y Server con versión son findings", () => {
  const f = evaluarHeaders({ url: "https://x", headers: {
    "strict-transport-security": "max-age=1", "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
    "x-powered-by": "Express", "server": "nginx/1.25.1",
  }});
  assert.ok(f.some(x => /x-powered-by/.test(x.detail)));
  assert.ok(f.some(x => /revela versión/.test(x.detail)));
});
test("CORS '*' con credentials es major", () => {
  const f = evaluarHeaders({ url: "https://x", headers: {
    "strict-transport-security": "max-age=1", "x-content-type-options": "nosniff",
    "content-security-policy": "frame-ancestors 'none'",
    "access-control-allow-origin": "*", "access-control-allow-credentials": "true",
  }});
  assert.ok(f.some(x => x.severity === "major" && /CORS/.test(x.detail)));
});
test("rate-limit: sin 429 en N intentos → major", () => {
  assert.equal(evaluarRateLimit([200, 401, 401, 401, 401]).severity, "major");
  assert.equal(evaluarRateLimit([401, 401, 429]), null);
  assert.equal(evaluarRateLimit([]), null);
});
test("resultDe: major/critical → issues", () => {
  assert.equal(resultDe([{ severity: "minor" }]), "ok");
  assert.equal(resultDe([{ severity: "major" }]), "issues");
  assert.equal(resultDe([]), "ok");
});
