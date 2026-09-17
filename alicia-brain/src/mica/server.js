// Servidor del cockpit de Mica (micaai.bam.pe). Separado del brain a propósito:
// el brain exige auth en todo y ya carga 16k líneas de otra cosa. Acá solo vive Mica.
import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { responder } from "./chat.js";
import { detectarProyecto } from "./motor.js";
import { backendPorDefecto } from "./llm.js";
import { normalizarTwilio, enviarWA, firmaValida } from "./wa.js";
import { abrirHilos, guardar, hilo, estado, marcarHandoff } from "./hilos.js";
import { sintetizar, listarVoces } from "./voz.js";
import { extraerPersona } from "./persona.js";
import { armarDossier } from "./dossier.js";

dotenv.config();
const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "../../public");
const SKILL = join(HERE, "../../skills/conversacion-comercial-hygge");

// Catálogo: vacío hasta que Jose lo cargue. Vacío es correcto — inventado, no.
const catalogo = (() => {
  try { return JSON.parse(readFileSync(join(HERE, "catalogo.json"), "utf8")); } catch { return []; }
})();

const llm = backendPorDefecto();

// Los hilos viven en el volumen si hay uno; si no, en memoria (el sandbox del cockpit
// no necesita persistir, pero WhatsApp sí: un redeploy no puede borrar una conversación).
const HILOS_PATH = process.env.MICA_DB_PATH || (process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "mica.db") : ":memory:");
const hilos = abrirHilos(HILOS_PATH);

const TW = {
  sid: process.env.TWILIO_ACCOUNT_SID || "",
  token: process.env.TWILIO_AUTH_TOKEN || "",
  from: process.env.MICA_WHATSAPP_FROM || "",
};

// El teléfono de José. Sin esto el handoff le llega al prospecto pero no a él,
// que es la mitad que importa.
const JOSE = process.env.PHONE_jt || "";

const EL = {
  apiKey: process.env.ELEVENLABS_API_KEY || "",
  // Voz PROPIA de Mica. Nunca cae a ELEVENLABS_VOICE_ID, que es la de Alicia.
  voiceId: process.env.MICA_VOICE_ID || "",
};

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// OJO: nada de express.static(PUBLIC). Esa carpeta es del brain y su index.html es el
// panel de control de Alice — servirla acá lo publicaba entero en el dominio de Mica.
// Mica sirve exactamente sus dos archivos y nada más.
app.get("/", (_, res) => res.sendFile(join(PUBLIC, "mica.html")));
app.get("/favicon.svg", (_, res) => res.sendFile(join(PUBLIC, "favicon.svg")));
app.get("/health", (_, res) => res.json({ ok: true, agente: "mica" }));

app.get("/api/mica/estado", (_, res) => res.json({
  backend: process.env.ANTHROPIC_API_KEY ? "Anthropic SDK" : "Claude CLI",
  modelo: process.env.ANTHROPIC_API_KEY ? "claude-sonnet-5" : "sonnet · sesión local",
  catalogo,
}));

app.get("/api/mica/skill-voz", (_, res) =>
  res.type("text/plain").send(readFileSync(join(SKILL, "references/voz.md"), "utf8")));

app.post("/api/mica/chat", async (req, res) => {
  const { mensajes = [], estado = {} } = req.body || {};
  try {
    res.json(await responder({ mensajes, estado, catalogo, llm }));
  } catch (e) {
    console.error("mica/chat:", e.message);
    res.status(500).json({ tipo: "error", texto: "Dame un momento y te respondo bien." });
  }
});

// Railway inyecta PORT y contra ese hace el healthcheck. MICA_PORT es solo para local.
// Las voces de la cuenta, para elegir la de Mica escuchándolas desde el cockpit.
app.get("/api/mica/voces", async (_, res) => {
  if (!EL.apiKey) return res.json({ voces: [], error: "sin ELEVENLABS_API_KEY" });
  try {
    res.json({ voces: await listarVoces(EL), elegida: EL.voiceId });
  } catch (e) { res.status(502).json({ voces: [], error: e.message }); }
});

app.post("/api/mica/voz", async (req, res) => {
  const { texto, voiceId } = req.body || {};
  if (!texto) return res.status(400).json({ error: "falta texto" });
  try {
    const audio = await sintetizar({ texto, apiKey: EL.apiKey, voiceId: voiceId || EL.voiceId });
    res.type("audio/mpeg").send(audio);
  } catch (e) {
    console.error("🟠 voz:", e.message);
    res.status(502).json({ error: e.message });
  }
});

// WhatsApp entrante (Twilio). Se responde 200 al toque y se contesta aparte: el
// modelo tarda segundos y Twilio no debe quedarse esperando ni reintentar.
app.post("/webhook/whatsapp", (req, res) => {
  // Twilio firma sobre la URL EXACTA que llamó. Detrás del proxy de Railway el
  // esquema real viene en X-Forwarded-Proto; en local es http. Fijar "https" acá
  // hace que la firma no cierre nunca fuera de producción.
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const url = `${proto}://${req.get("host")}${req.originalUrl}`;
  if (!firmaValida({ url, params: req.body, firma: req.get("X-Twilio-Signature"), token: TW.token })) {
    console.warn("🟠 webhook con firma inválida — descartado");
    return res.status(403).end();
  }
  res.type("text/xml").send("<Response></Response>");

  const m = normalizarTwilio(req.body);
  if (!m) return;
  atender(m).catch(e => console.error("🟠 atendiendo WhatsApp:", e.message));
});

// Lo que Mica piensa para un mensaje: hilo + respuesta + dossier si toca.
// NO manda nada — quien tenga el canal se encarga. Así el mismo cerebro sirve
// para el WhatsApp propio de Mica y para el puente por el número de Alicia.
export async function pensar({ telefono, texto, nombre }) {
  guardar(hilos, telefono, "prospecto", texto);
  const st = estado(hilos, telefono);
  const mensajes = hilo(hilos, telefono, 20);
  // Si la persona nombró un proyecto, ese es el suyo — aunque haya varios cargados.
  const proyecto = detectarProyecto(mensajes, catalogo);
  const r = await responder({
    mensajes,
    estado: { ...st, nombre: st.nombre || nombre, proyecto: st.proyecto || proyecto?.nombre || null },
    catalogo,
    llm,
  });
  guardar(hilos, telefono, "mica", r.texto);

  let dossier = null;
  if (r.tipo === "handoff") {
    marcarHandoff(hilos, telefono, r.combo);
    try {
      const persona = await extraerPersona({ mensajes: hilo(hilos, telefono, 40), llm });
      dossier = armarDossier({
        telefono, nombre,
        proyecto: proyecto?.nombre || (catalogo.length === 1 ? (catalogo[0].nombre || catalogo[0].id) : null),
        temperatura: r.temperatura, evidencia: r.evidencia, persona,
      });
    } catch (e) { console.error("🟠 dossier:", e.message); }
  }
  return { ...r, dossier };
}

// El puente desde el brain: Alicia recibe por su número y le pregunta a Mica qué
// contestar. Autenticado con la misma llave que usan Cheshire y Knave.
app.post("/api/mica/puente", async (req, res) => {
  const key = process.env.AGENTS_API_KEY || "";
  if (!key || req.get("x-agent-key") !== key) return res.status(401).json({ error: "no autorizado" });
  const { telefono, texto, nombre } = req.body || {};
  if (!telefono || !texto) return res.status(400).json({ error: "faltan telefono o texto" });
  try {
    const r = await pensar({ telefono, texto, nombre });
    console.log(`🟠 puente · ${telefono} · ${r.tipo} · ${r.temperatura}`);
    res.json(r);
  } catch (e) {
    console.error("🟠 puente:", e.message);
    res.status(500).json({ error: e.message });
  }
});

async function atender(m) {
  // Un audio o una foto no se responden con silencio: se dice la verdad.
  const texto = m.texto || "(te mandó un adjunto que Mica todavía no puede abrir)";
  const r = await pensar({ telefono: m.telefono, texto, nombre: m.nombrePerfil });

  await enviarWA({ to: m.telefono, texto: r.texto, ...TW });
  console.log(`🟠 ${m.telefono} · ${r.tipo} · ${r.temperatura}`);

  // El handoff no termina cuando Mica responde: termina cuando José tiene el dossier.
  // Va después de contestarle al prospecto, y aparte: si falla el aviso a José, la
  // persona ya recibió su respuesta igual.
  if (r.dossier && JOSE) {
    enviarWA({ to: JOSE, texto: r.dossier, ...TW })
      .catch(e => console.error("🟠 no pude avisarle a José:", e.message));
  }
}

const PORT = process.env.PORT || process.env.MICA_PORT || 3010;
app.listen(PORT, "0.0.0.0", () => console.log(`🟠 Mica escuchando en http://localhost:${PORT}`));
