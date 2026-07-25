// Knave of Hearts 🃏 — reglas PURAS de postura de seguridad (sin red ni DB, testeable).
// Evalúa headers/estados de una respuesta HTTP y devuelve findings.

const has = (h, k) => Object.keys(h || {}).some((x) => x.toLowerCase() === k.toLowerCase());
const get = (h, k) => { const e = Object.keys(h || {}).find((x) => x.toLowerCase() === k.toLowerCase()); return e ? h[e] : undefined; };

// evaluarHeaders({ url, status, headers }) → [{severity, category, detail}]
export function evaluarHeaders({ url, status = 200, headers = {} }) {
  const out = [];
  const push = (severity, detail) => out.push({ severity, category: "security-headers", detail: `${url}: ${detail}` });

  if (!has(headers, "strict-transport-security")) push("major", "sin HSTS (Strict-Transport-Security)");
  if (!has(headers, "x-content-type-options")) push("minor", "sin X-Content-Type-Options: nosniff");
  if (!has(headers, "content-security-policy")) push("minor", "sin Content-Security-Policy");
  if (!has(headers, "x-frame-options") && !/frame-ancestors/i.test(get(headers, "content-security-policy") || "")) push("minor", "sin X-Frame-Options ni frame-ancestors (clickjacking)");
  if (has(headers, "x-powered-by")) push("minor", `filtra x-powered-by: ${get(headers, "x-powered-by")}`);
  const server = get(headers, "server");
  if (server && /\d/.test(server)) push("minor", `header Server revela versión: ${server}`);
  const acao = get(headers, "access-control-allow-origin");
  if (acao === "*" && String(get(headers, "access-control-allow-credentials")).toLowerCase() === "true") push("major", "CORS permisivo: Allow-Origin '*' con credentials");
  else if (acao === "*") push("minor", "CORS permisivo: Access-Control-Allow-Origin '*'");
  return out;
}

// evaluarRateLimit(statuses[]) → finding | null
// statuses = códigos de N intentos rápidos de login. Si ninguno es 429 → sin throttle.
export function evaluarRateLimit(statuses = []) {
  if (!statuses.length) return null;
  const throttled = statuses.some((s) => s === 429);
  if (throttled) return null;
  return { severity: "major", category: "security-authz", detail: `/api/login sin rate-limit: ${statuses.length} intentos, ningún 429 (fuerza bruta posible)` };
}

// consolida el result final a partir de todos los findings
export function resultDe(findings) {
  if (findings.some((f) => f.severity === "critical" || f.severity === "major")) return "issues";
  return "ok";
}
