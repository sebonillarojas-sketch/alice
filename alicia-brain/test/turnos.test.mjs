import { test } from "node:test";
import assert from "node:assert/strict";
import { crearRegistroTurnos } from "../src/turnos.js";

test("el browser contesta y la promesa resuelve con su resultado", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { callId, promesa } = r.pedir(turnId, { timeoutMs: 1000 });
  assert.equal(r.resolver({ turnId, callId, userId: "sb", result: "Cabida abierta" }), "ok");
  assert.equal(await promesa, "Cabida abierta");
  assert.equal(r.pendientes(turnId), 0);
});

test("si el browser no contesta, la espera corta sola y NO tira", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { promesa } = r.pedir(turnId, { timeoutMs: 20 });
  const res = await promesa;
  // Resuelve con un texto, no rechaza: este string va como tool_result y el loop
  // sigue. Un reject acá mataría el turno entero por un click que no llegó.
  assert.match(res, /no respondió/i);
  assert.equal(r.pendientes(turnId), 0);
});

test("un turno ajeno no se puede contestar", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { callId, promesa } = r.pedir(turnId, { timeoutMs: 50 });
  assert.equal(r.resolver({ turnId, callId, userId: "vd", result: "mío" }), "no_autorizado");
  // y la espera sigue viva: el intruso no la consumió
  assert.equal(r.pendientes(turnId), 1);
  await promesa;   // se limpia sola por timeout
});

test("contestar dos veces el mismo call_id: la segunda no encuentra nada", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { callId, promesa } = r.pedir(turnId, { timeoutMs: 100 });
  assert.equal(r.resolver({ turnId, callId, userId: "sb", result: "uno" }), "ok");
  assert.equal(r.resolver({ turnId, callId, userId: "sb", result: "dos" }), "call_desconocido");
  assert.equal(await promesa, "uno");
});

test("un turnId que no existe se distingue de un call_id que no existe", () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  assert.equal(r.resolver({ turnId: "xxx", callId: "c1", userId: "sb", result: "x" }), "turno_desconocido");
  assert.equal(r.resolver({ turnId, callId: "noexiste", userId: "sb", result: "x" }), "call_desconocido");
});

test("cerrar el turno resuelve lo que quedó esperando y lo saca del registro", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  const { promesa } = r.pedir(turnId, { timeoutMs: 10000 });
  r.cerrar(turnId);
  assert.match(await promesa, /se cerró/i);
  // después de cerrar, el turno ya no existe ni para contestarlo
  assert.equal(r.resolver({ turnId, callId: "c1", userId: "sb", result: "x" }), "turno_desconocido");
});

test("pedir sobre un turno cerrado resuelve al toque, sin dejar un timer colgado", async () => {
  const r = crearRegistroTurnos();
  const turnId = r.abrir("sb");
  r.cerrar(turnId);
  const { promesa } = r.pedir(turnId, { timeoutMs: 10000 });
  assert.match(await promesa, /se cerró/i);
});

test("dos turnos en paralelo no se pisan los call_id", async () => {
  const r = crearRegistroTurnos();
  const a = r.abrir("sb");
  const b = r.abrir("vd");
  const pa = r.pedir(a, { timeoutMs: 100 });
  const pb = r.pedir(b, { timeoutMs: 100 });
  r.resolver({ turnId: b, callId: pb.callId, userId: "vd", result: "de b" });
  r.resolver({ turnId: a, callId: pa.callId, userId: "sb", result: "de a" });
  assert.equal(await pa.promesa, "de a");
  assert.equal(await pb.promesa, "de b");
});
