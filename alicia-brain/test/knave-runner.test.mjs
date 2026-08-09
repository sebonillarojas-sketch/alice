import { test } from "node:test";
import assert from "node:assert/strict";
import { runKnave } from "../scripts/knave.js";

// fetch falso: headers pobres + CORS abierto + ruta protegida que NO rechaza
function fakeFetch(url, opts = {}) {
  const h = new Map();
  if (String(url).includes("/health")) {
    // sin headers de seguridad
  }
  const isPreflight = (opts.method || "GET") === "OPTIONS";
  const headers = {
    get: (k) => {
      const kk = k.toLowerCase();
      if (isPreflight && kk === "access-control-allow-origin") return "*";
      return null;
    },
    forEach: () => {},
  };
  // ruta protegida simulada devuelve 200 (mal)
  const status = String(url).includes("/api/tasks") ? 200 : 200;
  return Promise.resolve({ ok: true, status, headers });
}

test("runKnave detecta CORS abierto y auth flojo, y arma reporte 'issues'", async () => {
  let sent = null;
  const res = await runKnave({
    fetchImpl: fakeFetch,
    reporter: (payload) => { sent = payload; return Promise.resolve({ ok: true }); },
    targets: { base: "https://x", protectedPath: "/api/tasks" },
  });
  assert.equal(res.result, "issues");
  assert.ok(res.findings.some(f => f.category === "cors" && f.severity === "critical"));
  assert.ok(res.findings.some(f => f.category === "auth-gate"));
  assert.ok(res.findings.some(f => f.category === "security-headers"));
  assert.equal(sent.agent, "knave");
  assert.equal(sent.result, "issues");
});

test("runKnave reporta 'error' cuando un check tira (target inalcanzable)", async () => {
  let sent = null;
  const throwingFetch = () => Promise.reject(new Error("getaddrinfo ENOTFOUND x"));
  const res = await runKnave({
    fetchImpl: throwingFetch,
    reporter: (payload) => { sent = payload; return Promise.resolve({ ok: true }); },
    targets: { base: "https://x", protectedPath: "/api/tasks" },
  });
  assert.equal(res.result, "error");
  assert.ok(res.findings.some(f => f.category.endsWith("-error")));
  assert.equal(sent.result, "error");
});
