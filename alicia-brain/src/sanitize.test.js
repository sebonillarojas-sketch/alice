import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { sanitizeDb } from "./sanitize.js";

function seed() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE oauth_tokens (user_id TEXT, token TEXT);
    CREATE TABLE profiles (user_id TEXT, phone TEXT, email TEXT);
    CREATE TABLE messages (id INTEGER, content TEXT);`);
  db.prepare("INSERT INTO app_settings VALUES (?,?)").run("google_token", "ya29.SECRET");
  db.prepare("INSERT INTO app_settings VALUES (?,?)").run("ui_theme", "dark");
  db.prepare("INSERT INTO oauth_tokens VALUES (?,?)").run("sb", "real-refresh-token");
  db.prepare("INSERT INTO profiles VALUES (?,?,?)").run("sb", "+51999888777", "sebastian@hygge.pe");
  db.prepare("INSERT INTO messages VALUES (?,?)").run(1, "info sensible del negocio");
  return db;
}
test("borra secrets de app_settings pero deja lo no-sensible", () => {
  const db = seed(); sanitizeDb(db);
  assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='google_token'").get().value, null);
  assert.equal(db.prepare("SELECT value FROM app_settings WHERE key='ui_theme'").get().value, "dark");
});
test("vacía oauth_tokens y redacta profiles + messages", () => {
  const db = seed(); const r = sanitizeDb(db);
  assert.equal(db.prepare("SELECT count(*) c FROM oauth_tokens").get().c, 0);
  assert.equal(db.prepare("SELECT phone FROM profiles WHERE user_id='sb'").get().phone, "+000000000");
  assert.notEqual(db.prepare("SELECT email FROM profiles WHERE user_id='sb'").get().email, "sebastian@hygge.pe");
  assert.equal(db.prepare("SELECT content FROM messages WHERE id=1").get().content, "[redactado]");
  assert.ok(r.appSettings >= 1);
});
test("no explota si falta una tabla/columna", () => {
  const db = new Database(":memory:"); db.exec("CREATE TABLE app_settings (key TEXT, value TEXT);");
  assert.doesNotThrow(() => sanitizeDb(db));
});
