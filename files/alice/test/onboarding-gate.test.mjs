import test from "node:test";
import assert from "node:assert/strict";
import { decideCalendarGate } from "../src/lib/onboardingGate.js";

test("decideCalendarGate: caché local ya en 1 → pasa sin preguntarle nada al brain", () => {
  const out = decideCalendarGate({ cachedGranted: true, brainStatus: undefined });
  assert.deepEqual(out, { pass: true, persist: false });
});

test("decideCalendarGate: brain confirma conectado → pasa y cachea", () => {
  const out = decideCalendarGate({ cachedGranted: false, brainStatus: { ok: true, connected: true } });
  assert.deepEqual(out, { pass: true, persist: true });
});

test("decideCalendarGate: brain confirma NO conectado → muestra el modal, no cachea", () => {
  const out = decideCalendarGate({ cachedGranted: false, brainStatus: { ok: true, connected: false } });
  assert.deepEqual(out, { pass: false, persist: false });
});

test("decideCalendarGate: brain caído (ok:false) → falla ABIERTA, no cachea", () => {
  const out = decideCalendarGate({ cachedGranted: false, brainStatus: { ok: false } });
  assert.deepEqual(out, { pass: true, persist: false });
});

test("decideCalendarGate: brain no respondió nada (null) → falla ABIERTA, no cachea", () => {
  const out = decideCalendarGate({ cachedGranted: false, brainStatus: null });
  assert.deepEqual(out, { pass: true, persist: false });
});

test("decideCalendarGate: brain tardó y nunca resolvió (undefined) → falla ABIERTA, no cachea", () => {
  const out = decideCalendarGate({ cachedGranted: false, brainStatus: undefined });
  assert.deepEqual(out, { pass: true, persist: false });
});

test("decideCalendarGate: nunca devuelve pass:false salvo confirmación explícita del brain", () => {
  // Cualquier forma "rara" de brainStatus que no sea {ok:true} explícito
  // tiene que fallar abierta, no cerrada — es la regla que evita repetir el bug.
  const rarezas = [null, undefined, {}, { ok: false, connected: true }, { connected: true }];
  for (const brainStatus of rarezas) {
    assert.equal(decideCalendarGate({ cachedGranted: false, brainStatus }).pass, true);
  }
});
