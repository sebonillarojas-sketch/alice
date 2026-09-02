// Cheshire 😺 · tester E2E de usabilidad v2 (ver docs/WONDERLAND_IT.md)
// Corre en la Mac Studio (launchd cada 30 min) con Chromium REAL contra producción:
// lo que Cheshire ve es lo que ve un usuario (TLS estricto, JS real, viewport real).
// Reporta a /api/agents/report → Lab del ERP + WhatsApp automático si hay críticos.
//
// v1 no se logueaba nunca (entraba con clave incorrecta a propósito, para probar el
// error-path). Era deliberado — no ensuciar prod — pero tenía un costo alto: Cheshire
// JAMÁS vio el interior de la app, así que no podía detectar ningún bug de adentro.
// Se pasaron semanas con bugs de UI que nadie reportaba porque el único que miraba
// solo conocía la pantalla de login.
//
// v2 mantiene toda la superficie pública de v1 y le suma una fase autenticada, con
// dos candados contra el problema original:
//   · Sin CHESHIRE_EMAIL/PASSWORD → hace exactamente lo de v1 y REPORTA que le faltan
//     credenciales. Nunca queda mudo por una variable ausente.
//   · Sin CHESHIRE_SPACE → la fase autenticada es de SOLO LECTURA. No crea nada. Sin un
//     space de QA confirmado, prefiere no probar a ensuciar el trabajo del equipo.
// Lo que crea, lo borra.
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
// Credenciales del tester. Cuenta propia (no compartida) y sin permisos de admin:
// si Cheshire se equivoca, el daño es el de un usuario cualquiera. Viven en el .env
// de esta máquina — nunca en el repo.
const CHESHIRE_EMAIL = (process.env.CHESHIRE_EMAIL || "").trim();
const CHESHIRE_PASSWORD = process.env.CHESHIRE_PASSWORD || "";
// Space donde puede crear y borrar. Sin esto no escribe nada, a propósito.
const CHESHIRE_SPACE = (process.env.CHESHIRE_SPACE || "").trim();

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

  // ── 5) Fase autenticada ────────────────────────────────────────────────────
  // Todo lo de arriba mira la puerta de calle. Esto mira adentro, que es donde
  // viven los bugs que el equipo sufre todos los días.
  if (!CHESHIRE_EMAIL || !CHESHIRE_PASSWORD) {
    note(false, "Fase autenticada", "faltan CHESHIRE_EMAIL / CHESHIRE_PASSWORD en el .env");
    findings.push({
      severity: "major",
      category: "cheshire-sin-credenciales",
      detail: "Cheshire corrió SOLO la superficie pública: faltan CHESHIRE_EMAIL/CHESHIRE_PASSWORD en el .env de esta máquina. Nada de lo que pasa dentro del ERP está siendo vigilado.",
    });
  } else {
    const app = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const appErrors = [];
    app.on("pageerror", e => appErrors.push(`pageerror: ${e.message}`));
    app.on("console", m => { if (m.type() === "error") appErrors.push(m.text()); });
    let creada = null;   // id/título de lo que cree, para poder limpiarlo en el finally

    try {
      await app.goto(ERP_URL, { waitUntil: "networkidle", timeout: 30000 });
      await app.fill('input[type="email"]', CHESHIRE_EMAIL);
      await app.fill('input[type="password"]', CHESHIRE_PASSWORD);
      await app.click('button[type="submit"]');

      // Adentro no hay campo de contraseña. Es la señal más estable de que entró:
      // no depende de ningún texto ni clase que un rediseño pueda cambiar.
      const dentro = await app.locator('input[type="password"]')
        .waitFor({ state: "detached", timeout: 20000 }).then(() => true).catch(() => false);
      note(dentro, "Login con credenciales válidas entra al ERP");
      await app.screenshot({ path: join(SHOTS, `${stamp}-app.png`) });

      if (!dentro) {
        findings.push({ severity: "critical", category: "login-roto", detail: "Cheshire no pudo entrar con credenciales válidas — o el login está roto, o la cuenta del tester quedó deshabilitada/con clave cambiada." });
      } else {
        // 5a) Errores de consola ADENTRO. v1 solo veía los del login; los de acá son
        // los que rompen el trabajo real y nadie estaba mirando.
        await app.waitForTimeout(4000);
        note(appErrors.length === 0, "Consola sin errores dentro del ERP", appErrors[0]?.slice(0, 90) || "");
        if (appErrors.length) findings.push({ severity: "major", category: "js-errors-app", detail: `Consola con ${appErrors.length} error(es) DENTRO del ERP: ${appErrors.slice(0, 3).join(" | ").slice(0, 300)}` });

        // 5b) Navegación por el router de fragmento, que es contrato estable
        // (HyggeOS.jsx) y no un selector que un rediseño mueva de lugar.
        for (const sp of ["hq", "mistareas", "notifications"]) {
          const antes = appErrors.length;
          await app.goto(`${ERP_URL}/#/space/${sp}`, { waitUntil: "networkidle", timeout: 20000 });
          await app.waitForTimeout(1500);
          const rompio = appErrors.length > antes;
          note(!rompio, `Space "${sp}" abre sin errores`, rompio ? appErrors[appErrors.length - 1]?.slice(0, 80) : "");
          if (rompio) findings.push({ severity: "major", category: "space-roto", detail: `Abrir el space "${sp}" produjo errores de consola: ${appErrors[appErrors.length - 1]?.slice(0, 200)}` });
        }

        // 5c) Responsive DE VERDAD. v1 medía overflow en el login, que es una
        // pantalla casi vacía — pasaba siempre y no probaba nada útil.
        const mobApp = await browser.newPage({ viewport: { width: 375, height: 812 } });
        try {
          await mobApp.goto(ERP_URL, { waitUntil: "networkidle", timeout: 30000 });
          await mobApp.fill('input[type="email"]', CHESHIRE_EMAIL);
          await mobApp.fill('input[type="password"]', CHESHIRE_PASSWORD);
          await mobApp.click('button[type="submit"]');
          await mobApp.locator('input[type="password"]').waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
          await mobApp.waitForTimeout(3000);
          const ov = await mobApp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          note(ov <= 2, "Sin overflow horizontal en 375px (dentro del ERP)", ov > 2 ? `${ov}px de desborde` : "");
          if (ov > 2) findings.push({ severity: "minor", category: "responsive-app", detail: `El ERP desborda ${ov}px en viewport 375px (celular) estando logueado` });
          await mobApp.screenshot({ path: join(SHOTS, `${stamp}-app-mobile.png`) });
        } catch (e) { note(false, "responsive dentro del ERP", e.message); }
        finally { await mobApp.close().catch(() => {}); }

        // 5d) Crear y borrar una tarea. SOLO con un space de QA confirmado: sin eso
        // preferimos no probar el flujo antes que ensuciar el trabajo del equipo.
        if (!CHESHIRE_SPACE) {
          note(false, "Flujo de crear tarea", "sin CHESHIRE_SPACE — fase de escritura salteada a propósito");
          findings.push({ severity: "minor", category: "cheshire-solo-lectura", detail: "Sin CHESHIRE_SPACE en el .env, Cheshire no ejercita crear/borrar tareas. El flujo más usado del ERP no está siendo probado." });
        } else {
          const titulo = `[cheshire] prueba ${stamp}`;
          await app.goto(`${ERP_URL}/#/space/${CHESHIRE_SPACE}`, { waitUntil: "networkidle", timeout: 20000 });
          await app.waitForTimeout(1500);
          // ⌘N abre el modal de nueva tarea (HyggeOS.jsx). El atajo es más estable
          // que cualquier selector de botón.
          await app.keyboard.press("Meta+n");
          const modal = await app.locator("input[autofocus], input:focus").first()
            .waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
          note(modal, "⌘N abre el modal de nueva tarea");
          if (!modal) {
            findings.push({ severity: "major", category: "flujo-crear-tarea", detail: "⌘N no abrió el modal de nueva tarea — el atajo o el modal se rompieron." });
          } else {
            await app.keyboard.type(titulo);
            await app.keyboard.press("Enter");
            await app.waitForTimeout(2500);
            const aparece = await app.getByText(titulo, { exact: false }).first().isVisible({ timeout: 8000 }).catch(() => false);
            creada = aparece ? titulo : null;
            note(aparece, "La tarea creada aparece en la lista");
            if (!aparece) findings.push({ severity: "major", category: "flujo-crear-tarea", detail: `Creé la tarea "${titulo}" y no apareció en la lista del space ${CHESHIRE_SPACE}.` });
          }
        }
      }
    } catch (e) {
      note(false, "Fase autenticada", e.message);
      findings.push({ severity: "major", category: "fase-autenticada", detail: `La fase autenticada falló: ${e.message}` });
    } finally {
      // Limpieza: lo que Cheshire crea, Cheshire lo borra. Si esto falla, avisa —
      // basura acumulándose en silencio es peor que un test que no corrió.
      if (creada) {
        try {
          await app.getByText(creada, { exact: false }).first().click({ timeout: 8000 });
          await app.waitForTimeout(1200);
          const borrado = await app.getByRole("button", { name: /eliminar|borrar/i }).first()
            .click({ timeout: 5000 }).then(() => true).catch(() => false);
          await app.waitForTimeout(1500);
          note(borrado, "Limpieza: la tarea de prueba se borró");
          if (!borrado) findings.push({ severity: "minor", category: "cheshire-basura", detail: `No pude borrar mi tarea de prueba "${creada}" en el space ${CHESHIRE_SPACE}. Hay que limpiarla a mano.` });
        } catch (e) {
          findings.push({ severity: "minor", category: "cheshire-basura", detail: `Falló la limpieza de "${creada}": ${e.message}` });
        }
      }
      await app.close().catch(() => {});
    }
  }

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
