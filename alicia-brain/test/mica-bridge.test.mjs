import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { detectarComando, ensureModoSchema, enModoMica, activar, salir } from "../src/mica-bridge.js";

const nueva = () => { const db = new DatabaseSync(":memory:"); ensureModoSchema(db); return db; };

test("'ACTIVAR MICA' activa, escrito como lo escribe la gente", () => {
  for (const t of ["ACTIVAR MICA", "activar mica", "Activar Mica", "  activar mica  ", "activar mica!"]) {
    assert.equal(detectarComando(t), "activar", t);
  }
});

test("una frase que solo menciona a Mica no la activa", () => {
  assert.equal(detectarComando("che, y si activamos mica para el proyecto?"), null);
  assert.equal(detectarComando("mica"), null);
});

test("se sale con SALIR MICA o ACTIVAR ALICIA", () => {
  assert.equal(detectarComando("SALIR MICA"), "salir");
  assert.equal(detectarComando("activar alicia"), "salir");
});

test("por defecto nadie está en modo Mica — Alicia sigue atendiendo", () => {
  assert.equal(enModoMica(nueva(), "+51999"), false);
});

test("activar y salir cambian el modo de ese teléfono y de ningún otro", () => {
  const db = nueva();
  activar(db, "+51111");
  assert.equal(enModoMica(db, "+51111"), true);
  assert.equal(enModoMica(db, "+51222"), false, "activar uno no activa a todos");
  salir(db, "+51111");
  assert.equal(enModoMica(db, "+51111"), false);
});

test("activar dos veces no rompe", () => {
  const db = nueva();
  activar(db, "+51111"); activar(db, "+51111");
  assert.equal(enModoMica(db, "+51111"), true);
});
