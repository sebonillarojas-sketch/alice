// fleet.js — la flota de scrapers 🪰 (buzzfly1…5).
//
// POR QUÉ EXISTE ESTE ARCHIVO: hasta el 16/09/2026 los scrapers reportaban bajo
// el agente 'white-rabbit', que ya era OTRO trabajo — la guardia de infra pública
// que corre cada 30 min. Esa guardia cierra sus hallazgos cuando el TLS está sano
// con un `WHERE agent = 'white-rabbit'`, sin filtrar por categoría, así que de paso
// borraba los del scraper: Urbania fallaba 5:30am, SBS 6:00am, y a las 6:30 la
// guardia los marcaba 'auto-fixed'. A las 7:15, cuando Dark Alice buscaba hallazgos
// abiertos para avisar por WhatsApp, no quedaba rastro. Urbania y SBS estuvieron
// caídos tres días y la única forma de enterarse fue mirar Railway a mano.
//
// El nombre propio es el arreglo: cada scraper tiene identidad en agent_runs /
// agent_findings, así el ciclo de vida de sus hallazgos es suyo y de nadie más.
import { query } from "../db.js";

// maxHours = cuánto puede pasar sin datos frescos antes de que sea un hallazgo.
// Se fija con holgura sobre la cadencia real (una corrida perdida no alarma; dos sí).
// `datos` = de dónde se lee la huella real de esa fuente. Se mira el dato además de
// la corrida registrada: así el chequeo dice la verdad desde el minuto uno, sin
// esperar a que cada scraper estrene su identidad nueva.
export const FLEET = {
  buzzfly1: { source: "sbs",           label: "SBS · tasas hipotecarias por banco", cadencia: "diario 6:00am", maxHours: 30,
              datos: { sql: "SELECT MAX(scraped_at) AS ts FROM bank_rates WHERE source = 'sbs'" } },
  buzzfly2: { source: "urbania",       label: "Urbania · listings de venta Lima",   cadencia: "cada 12h",      maxHours: 30,
              datos: { sql: "SELECT MAX(scraped_at) AS ts FROM market_snapshots WHERE source = 'urbania'" } },
  buzzfly3: { source: "nexo",          label: "Nexo · proyectos Lima",              cadencia: "cada hora",     maxHours: 6,
              datos: { sql: "SELECT MAX(scraped_at) AS ts FROM market_snapshots WHERE source = 'nexo'" } },
  buzzfly4: { source: "wynwood_house", label: "Wynwood House · renta corta",        cadencia: "cada 6h",       maxHours: 18,
              datos: { sql: "SELECT MAX(scraped_at) AS ts FROM rental_listings WHERE source = 'wynwood_house'" } },
  // La bestia no tiene tabla propia: escribe en las mismas que las demás fuentes.
  // Su única huella distinguible es el push registrado en /api/market-import.
  buzzfly5: { source: "bestia",        label: "Bestia · Playwright (Nexo+Urbania+SBS)", cadencia: "cada 6h",   maxHours: 18,
              datos: null },
};

// agent → buzzfly. `source` es el nombre con que cada scraper se conoce en el código.
export const AGENT_BY_SOURCE = Object.fromEntries(
  Object.entries(FLEET).map(([agent, cfg]) => [cfg.source, agent])
);

// El más reciente de dos marcas (cualquiera puede faltar).
export function masReciente(a, b) {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}

// SQLite guarda datetime('now') en UTC sin zona: "2026-09-16 11:00:09".
export function tsMs(ts) {
  if (!ts) return null;
  const ms = Date.parse(String(ts).replace(" ", "T") + (/[Zz+]/.test(ts) ? "" : "Z"));
  return Number.isFinite(ms) ? ms : null;
}

// Registra una corrida con la identidad del scraper. `result`: ok | issues | error.
// Si salió OK cierra los hallazgos abiertos de ESTE scraper — el mismo ciclo de vida
// que usan el conejo y el sombrerero, pero acotado a su propio nombre, que es
// justamente lo que faltaba.
export function recordScraperRun(agent, { result, summary, actions = [], findings = [] }) {
  try {
    if (result === "ok") {
      query(
        `UPDATE agent_findings SET status = 'auto-fixed', resolved_by = ?, updated_at = datetime('now')
         WHERE agent = ? AND status IN ('open','escalated')`,
        [agent, agent]
      );
    }
    const { lastID: runId } = query(
      `INSERT INTO agent_runs (agent, finished_at, result, summary, actions_taken)
       VALUES (?, datetime('now'), ?, ?, ?)`,
      [agent, result, summary, JSON.stringify(actions)]
    );
    for (const f of findings) {
      query(
        `INSERT INTO agent_findings (agent, run_id, severity, category, detail, status)
         VALUES (?, ?, ?, ?, ?, 'open')`,
        [agent, runId, f.severity, f.category, f.detail]
      );
    }
    return runId;
  } catch (e) {
    console.error(`🪰 ${agent}: no pude registrar la corrida:`, e.message);
    return null;
  }
}

// PURA: dado el último OK de cada scraper (ms epoch o null), decide quién está viejo.
// Vigila el SILENCIO además del fallo — un scraper que dejó de correr no genera
// ningún hallazgo por sí solo, y así fue como la bestia estuvo siete días muda.
export function staleFindings(lastOkByAgent, nowMs, fleet = FLEET) {
  const out = [];
  for (const [agent, cfg] of Object.entries(fleet)) {
    const last = lastOkByAgent[agent] ?? null;
    const ageH = last == null ? null : (nowMs - last) / 3_600_000;
    if (ageH != null && ageH <= cfg.maxHours) continue;
    // Mudo del todo, o más de 3× el umbral: ya no es "se atrasó", es que no está.
    const mudo = ageH == null || ageH > cfg.maxHours * 3;
    out.push({
      agent,
      severity: mudo ? "critical" : "major",
      category: "datos-viejos",
      detail: ageH == null
        ? `${cfg.label}: ni una corrida OK ni un dato registrado — el scraper está mudo (${cfg.cadencia})`
        : `${cfg.label}: sin datos nuevos hace ${Math.round(ageH)}h (tolerancia ${cfg.maxHours}h, corre ${cfg.cadencia})`,
    });
  }
  return out;
}

// ── Latido de la bestia ───────────────────────────────────────────────────────
// buzzfly5 mide DATOS (tolera 18h, porque scrapea cada 6h). Esto mide que la
// MÁQUINA esté viva, y es otra pregunta: el reloj puede estar muerto nueve horas
// antes de que la falta de datos cante. El watchdog de allá postea cada 10 min con
// curl puro — sin node, sin repo, sin nada que pueda romperse en el medio — así que
// si esto se calla, se calló la máquina.
export const HEARTBEAT_KEY = "bestia_heartbeat";

// PURA: severidad según cuánto lleva sin latir. 10 min de cadencia → 30 de gracia.
export function heartbeatFinding(lastMs, nowMs, { graciaMin = 30, mudaHoras = 3 } = {}) {
  if (lastMs != null && nowMs - lastMs <= graciaMin * 60_000) return null;
  const min = lastMs == null ? null : Math.round((nowMs - lastMs) / 60_000);
  const muda = min == null || min > mudaHoras * 60;
  return {
    agent: "buzzfly5",
    severity: muda ? "critical" : "major",
    category: "bestia-muda",
    detail: min == null
      ? "La bestia nunca reportó un latido — el reloj de Wonderland no está corriendo"
      : `La bestia no late hace ${min} min (el watchdog postea cada 10) — el reloj o la máquina están caídos`,
  };
}

// Corre cada 30 min desde el cron. Abre uno y solo uno; lo cierra cuando vuelve.
export function checkBestiaHeartbeat({ now = Date.now() } = {}) {
  let last = null;
  try {
    const { rows } = query(`SELECT updated_at FROM app_settings WHERE key = ?`, [HEARTBEAT_KEY]);
    last = tsMs(rows[0]?.updated_at);
  } catch { last = null; }

  const f = heartbeatFinding(last, now);
  const { rows: previos } = query(
    `SELECT id, severity FROM agent_findings
     WHERE category = 'bestia-muda' AND status IN ('open','escalated') LIMIT 1`
  );
  const abierto = previos[0];

  if (!f) {
    if (abierto) {
      query(
        `UPDATE agent_findings SET status = 'auto-fixed', resolved_by = 'latido', updated_at = datetime('now') WHERE id = ?`,
        [abierto.id]
      );
      console.log("💓 La bestia volvió a latir — hallazgo cerrado");
    }
    return { vivo: true };
  }

  if (!abierto) {
    query(
      `INSERT INTO agent_findings (agent, severity, category, detail, status) VALUES (?, ?, ?, ?, 'open')`,
      [f.agent, f.severity, f.category, f.detail]
    );
  } else if (abierto.severity !== "critical" && f.severity === "critical") {
    query(
      `UPDATE agent_findings SET severity = 'critical', detail = ?, updated_at = datetime('now') WHERE id = ?`,
      [f.detail, abierto.id]
    );
  }
  console.log(`💔 ${f.detail}`);
  return { vivo: false, finding: f };
}

// Corre cada hora desde el cron. Un hallazgo abierto por scraper: no repite el
// mismo grito cada hora, pero si el atraso se vuelve silencio sube la severidad.
export function checkFleetFreshness({ now = Date.now() } = {}) {
  const lastOk = {};
  for (const [agent, cfg] of Object.entries(FLEET)) {
    let run = null, dato = null;
    try {
      const { rows } = query(
        `SELECT MAX(created_at) AS ts FROM agent_runs WHERE agent = ? AND result = 'ok'`,
        [agent]
      );
      run = tsMs(rows[0]?.ts);
    } catch { run = null; }
    if (cfg.datos) {
      try { dato = tsMs(query(cfg.datos.sql).rows[0]?.ts); } catch { dato = null; }
    }
    lastOk[agent] = masReciente(run, dato);
  }

  const stale = staleFindings(lastOk, now);
  const viejos = new Set(stale.map(f => f.agent));

  // El mismo chequeo que abre es el que cierra: si un scraper volvió a traer datos
  // —aunque sea por otra vía que no registre corrida suya— su hallazgo se va solo.
  // Un hallazgo que sobrevive a su causa es ruido, y el ruido constante fue parte
  // de por qué el informe diario de Dark Alice dejó de decir algo.
  let cerrados = 0;
  for (const agent of Object.keys(FLEET)) {
    if (viejos.has(agent)) continue;
    const { changes } = query(
      `UPDATE agent_findings SET status = 'auto-fixed', resolved_by = 'frescura', updated_at = datetime('now')
       WHERE agent = ? AND category = 'datos-viejos' AND status IN ('open','escalated')`,
      [agent]
    );
    cerrados += changes || 0;
  }

  let nuevos = 0, escalados = 0;
  for (const f of stale) {
    const { rows } = query(
      `SELECT id, severity FROM agent_findings
       WHERE agent = ? AND category = 'datos-viejos' AND status IN ('open','escalated') LIMIT 1`,
      [f.agent]
    );
    const abierto = rows[0];
    if (!abierto) {
      query(
        `INSERT INTO agent_findings (agent, severity, category, detail, status) VALUES (?, ?, ?, ?, 'open')`,
        [f.agent, f.severity, f.category, f.detail]
      );
      nuevos++;
    } else if (abierto.severity !== "critical" && f.severity === "critical") {
      query(
        `UPDATE agent_findings SET severity = 'critical', detail = ?, updated_at = datetime('now') WHERE id = ?`,
        [f.detail, abierto.id]
      );
      escalados++;
    }
  }

  console.log(
    `🪰 Frescura de la flota · ${stale.length}/${Object.keys(FLEET).length} sin datos frescos` +
    `${nuevos ? ` · ${nuevos} hallazgo(s) nuevo(s)` : ""}${escalados ? ` · ${escalados} escalado(s)` : ""}` +
    `${cerrados ? ` · ${cerrados} cerrado(s) al volver los datos` : ""}`
  );
  return { stale, nuevos, escalados, cerrados };
}
