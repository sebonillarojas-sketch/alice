// Backends de modelo. La lógica de Mica no sabe cuál está puesto: recibe `llm`.
//  · Anthropic SDK  → producción (Railway tiene ANTHROPIC_API_KEY)
//  · Claude CLI     → local, sin API key: usa la sesión de Claude Code de la máquina
// El modelo local (ollama/MLX) entra acá como un tercer backend cuando esté instalado.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Anthropic from "@anthropic-ai/sdk";

const execFileP = promisify(execFile);

const transcripcion = (mensajes) => mensajes
  .map(m => `${m.rol === "prospecto" ? "Prospecto" : "Mica"}: ${m.texto}`)
  .join("\n");

// NADA de instrucciones propias acá. El backend es un canal, no un autor: cuando
// le pegaba "escribí solo el próximo mensaje de Mica" a cada llamada, el extractor
// de buyer persona recibía a Mica ACTUANDO en vez del JSON que pedía — y actuando
// mal, ofreciendo planos y precios. Lo que cada uso necesite, va en su system.

export function backendCLI({ model = "sonnet", timeoutMs = 60_000 } = {}) {
  return async ({ system, mensajes }) => {
    const { stdout } = await execFileP("claude", [
      "-p", transcripcion(mensajes),
      "--system-prompt", system,
      "--model", model,
    ], { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  };
}

export function backendAnthropic({ model = "claude-sonnet-5", apiKey = process.env.ANTHROPIC_API_KEY, client = null } = {}) {
  client = client || new Anthropic({ apiKey });
  return async ({ system, mensajes }) => {
    const r = await client.messages.create({
      model,
      max_tokens: 400,
      system,
      messages: mensajes.map(m => ({ role: m.rol === "prospecto" ? "user" : "assistant", content: m.texto })),
    });
    return (r.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  };
}

// El que corresponda según dónde esté corriendo.
export function backendPorDefecto() {
  return process.env.ANTHROPIC_API_KEY ? backendAnthropic() : backendCLI();
}
