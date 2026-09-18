// El seed de perfiles corre en CADA deploy: railway.json del brain arranca con
// `node scripts/setup-db.js && node src/server.js`. Con `INSERT OR REPLACE` eso
// revierte los perfiles a los valores sembrados en julio y deja en NULL las
// columnas que el seed no nombra (phone, email, growth_notes). Un seed existe
// para arrancar una DB vacía, no para imponer valores en cada arranque.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SETUP = fileURLToPath(new URL("../scripts/setup-db.js", import.meta.url));

// Un "deploy": corre el script contra una DB temporal.
function deploy(dbPath) {
  execFileSync(process.execPath, [SETUP], {
    env: { ...process.env, SQLITE_PATH: dbPath },
    stdio: "ignore",
  });
}

function conTempDb(fn) {
  const dir = mkdtempSync(join(tmpdir(), "alice-seed-"));
  try { fn(join(dir, "alicia.db")); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

test("primer deploy: el seed siembra al equipo en una DB vacía", () => {
  conTempDb((dbPath) => {
    deploy(dbPath);
    const db = new DatabaseSync(dbPath);
    const vd = db.prepare("SELECT name, role FROM profiles WHERE user_id = 'vd'").get();
    assert.equal(vd.name, "Vanessa Dongo");
    assert.ok(vd.role, "el perfil sembrado trae rol");
  });
});

test("segundo deploy: el seed no pisa lo que se editó desde el panel", () => {
  conTempDb((dbPath) => {
    deploy(dbPath);

    // Lo que hace el equipo entre un deploy y el siguiente: editar la ficha en
    // el panel y cargar el email (columna que agrega la migración de db.js).
    const db = new DatabaseSync(dbPath);
    db.exec("ALTER TABLE profiles ADD COLUMN email TEXT");
    db.prepare(
      `UPDATE profiles SET role = ?, growth_notes = ?, phone = ?, email = ?
       WHERE user_id = 'vd'`
    ).run("Gerente de Marca", "Tomó la marca en agosto", "+51999888777", "vanessa@hygge.pe");
    db.close();

    deploy(dbPath);

    const vd = new DatabaseSync(dbPath)
      .prepare("SELECT role, growth_notes, phone, email FROM profiles WHERE user_id = 'vd'")
      .get();
    assert.equal(vd.role, "Gerente de Marca", "el rol editado sobrevive al deploy");
    assert.equal(vd.growth_notes, "Tomó la marca en agosto", "las notas de coaching sobreviven");
    assert.equal(vd.phone, "+51999888777", "el teléfono sobrevive");
    assert.equal(vd.email, "vanessa@hygge.pe", "el email cargado a mano sobrevive");
  });
});
