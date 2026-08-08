// Puente GitHub → Taller de Bammy.
// La rutina nocturna (cloud) NO puede llegar a aliceai.bam.pe (bloqueo de egress 403),
// pero SÍ pushea sus plantas a la rama `bammy/aprendizaje-vivienda`. Este módulo corre
// en Railway (que sí alcanza GitHub y su propia DB): lee la última tanda de plantas del
// repo y la cuelga en el Taller (bammy_studies) + avisa por WhatsApp. Sin depender del
// egress del entorno cloud.
import { query } from "./db.js";

const OWNER = "sebonillarojas-sketch";
const REPO = "alice";
const BRANCH = "bammy/aprendizaje-vivienda";
const ESTUDIOS = "alicia-brain/skills/arquitecto-residencial-lima/references/estudios";

async function gh(path, { raw = false } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN no configurado (agregalo en las variables de Railway)");
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json",
      "User-Agent": "alicia-bammy-bridge",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} en ${path}: ${(await r.text()).slice(0, 140)}`);
  return raw ? r.text() : r.json();
}

// Parsea la ÚLTIMA fila de la tabla de study-log.md.
// Formato: | Día | Fecha | Tema | Nota | 3 planos |
//   3 planos: "[u01](planos/2026-08-07b-u01.svg) 1D/1B … · [u02](planos/…-u02.svg) 2D/2B … · …"
export function parseLatestStudy(md) {
  const rows = md.split("\n").filter((l) => /^\|\s*\d+\s*\|/.test(l));
  if (!rows.length) return null;
  const cols = rows[rows.length - 1].split("|").map((s) => s.trim());
  const day = parseInt(cols[1], 10);
  const date = cols[2] || "";
  const topic = cols[3] || "";
  const planosCell = cols[5] || "";
  const units = [];
  for (const part of planosCell.split("·")) {
    const m = part.match(/\(planos\/([^)]+\.svg)\)\s*(.*)$/);
    if (!m) continue;
    const rest = (m[2] || "").trim();
    const unidad = (rest.match(/\b(1D|2D|3D)\b/) || [, ""])[1] || "";
    units.push({ unidad, svgPath: m[1].trim(), brief: rest });
  }
  return Number.isFinite(day) ? { day, date, topic, units } : null;
}

// Cuelga en el Taller la última tanda de plantas del repo, si aún no está.
export async function ingestLatestBammyStudy({ notify = true } = {}) {
  const md = await gh(`${ESTUDIOS}/study-log.md`, { raw: true });
  const latest = parseLatestStudy(md);
  if (!latest || !latest.units.length) return { ok: false, reason: "study-log sin filas de plantas" };

  const { rows } = query("SELECT id FROM bammy_studies WHERE day = ? LIMIT 1", [latest.day]);
  if (rows.length) return { ok: true, skipped: true, day: latest.day, reason: "ya colgado" };

  const units = [];
  for (const u of latest.units) {
    let svg = "";
    try { svg = await gh(`${ESTUDIOS}/planos/${u.svgPath}`, { raw: true }); }
    catch (e) { console.error(`🌉 Bridge: no pude traer ${u.svgPath}: ${e.message}`); }
    units.push({ unidad: u.unidad, brief: u.brief, svg });
  }

  const { lastID } = query(
    "INSERT INTO bammy_studies (day, date, topic, units) VALUES (?,?,?,?)",
    [latest.day, latest.date, latest.topic, JSON.stringify(units)]
  );
  console.log(`🌉 Bridge: colgó día ${latest.day} en el Taller (#${lastID}, ${units.length} unidades)`);

  if (notify && process.env.PHONE_sb) {
    const { sendWA } = await import("./wa.js");
    sendWA(process.env.PHONE_sb,
      `Bammy colgó el día ${latest.day} en el Taller (${latest.topic}) — 3 tipologías para corregir dibujando.`
    ).catch((e) => console.error("🌉 Bridge WA:", e.message));
  }
  return { ok: true, id: lastID, day: latest.day, date: latest.date, units: units.length };
}
