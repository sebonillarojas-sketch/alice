// Cheshire 😺 · tester E2E de usabilidad v1 (ver docs/WONDERLAND_IT.md)
// Corre en la Mac Studio (launchd cada 30 min) con Chromium REAL contra producción:
// lo que Cheshire ve es lo que ve un usuario (TLS estricto, JS real, viewport real).
// v1 sin login con datos (no ensucia prod): superficie pública + error-path + responsive.
// Reporta a /api/agents/report → Lab del ERP + WhatsApp automático si hay críticos.
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { homedir } from "os";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const ERP_URL = "https://alice.bam.pe";
const BRAIN_PUBLIC = "https://aliceai.bam.pe";
// El reporte va por el dominio de Railway (cert *.up.railway.app siempre válido):
// si aliceai.bam.pe está roto, el reporte del hallazgo tiene que poder salir igual.
const REPORT_URL = "https://alice-production-462e.up.railway.app/api/agents/report";
const SHOTS = join(homedir(), "Library/Logs/cheshire");
mkdirSync(SHOTS, { recursive: true });

const findings = [];
const actions = [];
const note = (ok, label, detail = "") => {
  actions.push({ check: label, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? " · " + detail : ""}`);
};

async function run() {
  const browser = await chromium.launch();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  // ── 1) ERP carga + login renderiza + sin errores de consola ────────────────
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on("pageerror", e => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });
  try {
    const res = await page.goto(ERP_URL, { waitUntil: "networkidle", timeout: 30000 });
    const httpOk = res && res.ok();
    const emailInput = await page.locator('input[type="email"]').count();
    const pwInput = await page.locator('input[type="password"]').count();
    const loginOk = httpOk && emailInput > 0 && pwInput > 0;
    note(loginOk, "ERP carga y el login (correo+contraseña) renderiza", httpOk ? "" : `HTTP ${res?.status()}`);
    if (!loginOk) findings.push({ severity: "critical", category: "erp-caido", detail: `alice.bam.pe no renderiza el login (HTTP ${res?.status()}, email:${emailInput}, pw:${pwInput})` });
    await page.screenshot({ path: join(SHOTS, `${stamp}-login.png`) });
  } catch (e) {
    note(false, "ERP carga", e.message);
    findings.push({ severity: "critical", category: "erp-caido", detail: `alice.bam.pe no carga: ${e.message}` });
  }

  // ── 2) Error-path del login: clave incorrecta DEBE mostrar mensaje ─────────
  try {
    await page.fill('input[type="email"]', "cheshire@hygge.pe");
    await page.fill('input[type="password"]', "clave-incorrecta-cheshire");
    await page.click('button[type="submit"]');
    const errVisible = await page.getByText(/incorrect/i).first().isVisible({ timeout: 8000 }).catch(() => false);
    note(errVisible, "Login con clave incorrecta muestra el error");
    if (!errVisible) findings.push({ severity: "major", category: "ux-login", detail: "Clave incorrecta NO muestra mensaje de error (usuario queda sin feedback) — o Supabase no responde" });
  } catch (e) {
    note(false, "Error-path del login", e.message);
    findings.push({ severity: "major", category: "ux-login", detail: `No se pudo ejercitar el login: ${e.message}` });
  }

  // ── 3) aliceai.bam.pe desde el browser (TLS estricto — lo que mató al iPad) ─
  try {
    const health = await page.evaluate(async (url) => {
      try { const r = await fetch(url + "/health", { signal: AbortSignal.timeout(10000) }); const d = await r.json(); return { ok: r.ok && d.ok }; }
      catch (e) { return { ok: false, err: e.message }; }
    }, BRAIN_PUBLIC);
    note(health.ok, "aliceai.bam.pe accesible desde un browser real", health.err || "");
    if (!health.ok) findings.push({ severity: "critical", category: "infra-publica", detail: `aliceai.bam.pe inaccesible desde browser (${health.err || "fetch failed"}) — Alicia/Velocity/archivos/calendario muertos para usuarios` });
  } catch (e) { note(false, "check aliceai desde browser", e.message); }

  // ── 4) Responsive 375px: overflow horizontal grosero ────────────────────────
  try {
    const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await mob.goto(ERP_URL, { waitUntil: "networkidle", timeout: 30000 });
    const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    note(overflow <= 2, "Sin overflow horizontal en 375px (login)", overflow > 2 ? `${overflow}px de desborde` : "");
    if (overflow > 2) findings.push({ severity: "minor", category: "responsive", detail: `Login desborda ${overflow}px en viewport 375px (celular)` });
    await mob.screenshot({ path: join(SHOTS, `${stamp}-mobile.png`) });
    await mob.close();
  } catch (e) { note(false, "check responsive", e.message); }

  if (consoleErrors.length) {
    findings.push({ severity: "major", category: "js-errors", detail: `Consola con ${consoleErrors.length} error(es): ${consoleErrors.slice(0, 3).join(" | ").slice(0, 300)}` });
    note(false, "Consola sin errores", consoleErrors[0]?.slice(0, 80));
  } else { note(true, "Consola sin errores JS"); }

  await browser.close();

  // ── Reporte al Lab (críticos → WhatsApp automático vía pipeline existente) ──
  const result = findings.some(f => f.severity === "critical") ? "issues" : findings.length ? "issues" : "ok";
  const summary = findings.length ? `${findings.length} hallazgo(s): ${findings.map(f => f.category).join(", ")}` : "Suite E2E completa OK";
  try {
    const r = await fetch(REPORT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-key": process.env.AGENTS_API_KEY || "" },
      body: JSON.stringify({ agent: "cheshire", result, summary, actions_taken: actions, findings }),
    });
    console.log(`😺 Reporte enviado: HTTP ${r.status} · ${result} · ${summary}`);
  } catch (e) { console.error("😺 No pude reportar:", e.message); }
}

run().then(() => process.exit(0)).catch(e => { console.error("😺 Cheshire crash:", e.message); process.exit(1); });
