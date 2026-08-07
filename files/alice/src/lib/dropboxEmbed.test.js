import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDropboxEmbed, isDropboxUrl } from "./dropboxEmbed.js";

test("imagen scl/fi con dl=0 → image, raw=1, sin dl, preserva rlkey", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/foto.png?rlkey=xyz&dl=0");
  assert.equal(r.kind, "image");
  assert.match(r.src, /raw=1/);
  assert.doesNotMatch(r.src, /dl=/);
  assert.match(r.src, /rlkey=xyz/);
  assert.match(r.openUrl, /dl=0/);
});

test("pdf /s/ → pdf con raw", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/s/abc/informe.pdf?dl=0");
  assert.equal(r.kind, "pdf");
  assert.match(r.src, /raw=1/);
});

test("xlsx → unsupported (src null) pero abrible", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/flujo.xlsx?rlkey=x&dl=0");
  assert.equal(r.kind, "unsupported");
  assert.equal(r.src, null);
  assert.match(r.openUrl, /flujo\.xlsx/);
});

test("carpeta /scl/fo/ → unsupported", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fo/abc/Proyecto?rlkey=x&dl=0");
  assert.equal(r.kind, "unsupported");
});

test("dl=1 (fuerza descarga) → normalizado a raw=1", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/foto.jpg?rlkey=x&dl=1");
  assert.equal(r.kind, "image");
  assert.match(r.src, /raw=1/);
  assert.doesNotMatch(r.src, /dl=1/);
});

test("ya-raw dl.dropboxusercontent.com → src intacto", () => {
  const url = "https://dl.dropboxusercontent.com/scl/fi/abc/foto.png?rlkey=x";
  const r = resolveDropboxEmbed(url);
  assert.equal(r.kind, "image");
  assert.equal(r.src, url);
});

test("extensión en mayúsculas → image", () => {
  const r = resolveDropboxEmbed("https://www.dropbox.com/scl/fi/abc/FOTO.PNG?dl=0");
  assert.equal(r.kind, "image");
});

test("URL malformada → unsupported sin romper", () => {
  const r = resolveDropboxEmbed("no-es-una-url");
  assert.equal(r.kind, "unsupported");
  assert.equal(r.openUrl, "no-es-una-url");
});

test("isDropboxUrl reconoce hosts y rechaza otros", () => {
  assert.ok(isDropboxUrl("https://www.dropbox.com/scl/fi/x/a.png"));
  assert.ok(isDropboxUrl("https://dropbox.com/s/x/a.pdf"));
  assert.ok(isDropboxUrl("https://dl.dropboxusercontent.com/scl/fi/x/a.png"));
  assert.ok(!isDropboxUrl("https://docs.google.com/spreadsheets/d/x"));
  assert.ok(!isDropboxUrl(""));
});
