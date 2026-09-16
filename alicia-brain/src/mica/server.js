// Servidor del cockpit de Mica (micaai.bam.pe). Separado del brain a propósito:
// el brain exige auth en todo y ya carga 16k líneas de otra cosa. Acá solo vive Mica.
import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { responder } from "./chat.js";
import { backendPorDefecto } from "./llm.js";

dotenv.config();
const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "../../public");
const SKILL = join(HERE, "../../skills/conversacion-comercial-hygge");

// Catálogo: vacío hasta que Jose lo cargue. Vacío es correcto — inventado, no.
const catalogo = (() => {
  try { return JSON.parse(readFileSync(join(HERE, "catalogo.json"), "utf8")); } catch { return []; }
})();

const llm = backendPorDefecto();
const app = express();
app.use(express.json({ limit: "1mb" }));

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

app.get("/api/mica/voz", (_, res) =>
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
const PORT = process.env.PORT || process.env.MICA_PORT || 3010;
app.listen(PORT, "0.0.0.0", () => console.log(`🟠 Mica escuchando en http://localhost:${PORT}`));
