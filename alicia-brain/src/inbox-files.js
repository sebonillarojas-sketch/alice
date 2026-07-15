// Buzón del último archivo que cada usuario mandó por WhatsApp.
// Alicia lo consume con dropbox_upload ("guardá eso en 08_GROWTH").
// PERSISTE EN DISCO (volumen /data en Railway): los redeploys ya no lo evaporan
// — así se perdió el Tangram de sb el 14 jul (buzón en RAM + 6 deploys ese día).
// TTL 30 min — es un handoff inmediato, no storage (los archivos viven en Dropbox).

import fs from "node:fs";
import path from "node:path";

const TTL_MS = 30 * 60 * 1000;
const DIR = fs.existsSync("/data") ? "/data/inbox" : path.join(process.cwd(), ".inbox");
fs.mkdirSync(DIR, { recursive: true });

const fileFor = (userId) => path.join(DIR, `${String(userId).replace(/[^a-z0-9_-]/gi, "")}.bin`);
const metaFor = (userId) => fileFor(userId) + ".json";

export function setLastFile(userId, { buffer, mediaType, filename }) {
  try {
    fs.writeFileSync(fileFor(userId), buffer);
    fs.writeFileSync(metaFor(userId), JSON.stringify({ mediaType, filename, ts: Date.now() }));
  } catch (e) { console.error("inbox setLastFile:", e.message); }
}

export function getLastFile(userId) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaFor(userId), "utf8"));
    if (Date.now() - meta.ts > TTL_MS) { clearLastFile(userId); return null; }
    return { buffer: fs.readFileSync(fileFor(userId)), ...meta };
  } catch { return null; }
}

export function clearLastFile(userId) {
  try { fs.unlinkSync(fileFor(userId)); } catch {}
  try { fs.unlinkSync(metaFor(userId)); } catch {}
}

export const extForMime = (mime = "") => ({
  "application/pdf": "pdf",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/msword": "doc", "application/vnd.ms-excel": "xls",
  "text/csv": "csv", "text/plain": "txt",
}[mime.split(";")[0]] || "bin");
