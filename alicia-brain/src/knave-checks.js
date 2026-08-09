// Knave 🃏 · lógica pura de evaluación de seguridad (sin red — testeable).
// Cada función recibe datos ya obtenidos y devuelve findings. La parte de fetch
// vive en scripts/knave.js. Ver docs/WONDERLAND_IT.md y el spec de este sub-proyecto.

const REQUIRED_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
];

export function checkSecurityHeaders(headers = {}) {
  const present = new Set(Object.keys(headers).map(k => k.toLowerCase()));
  return REQUIRED_HEADERS
    .filter(h => !present.has(h))
    .map(h => ({
      severity: "major",
      category: "security-headers",
      detail: `Falta el header de seguridad '${h}' — el navegador queda sin esa protección`,
    }));
}

// acao = valor de Access-Control-Allow-Origin devuelto ante un preflight con Origin hostil.
// Si refleja '*' o el propio origin hostil, el CORS está abierto de más.
export function checkCorsOpen(acao) {
  if (!acao) return null;
  if (acao === "*" || /evil\.example/i.test(acao)) {
    return {
      severity: "critical",
      category: "cors",
      detail: `CORS abierto: Access-Control-Allow-Origin devolvió '${acao}' ante un Origin hostil`,
    };
  }
  return null;
}

// status = código de una request a ruta protegida SIN credenciales. Debe ser 401 o 403.
export function checkAuthRejected(status) {
  if (status === 401 || status === 403) return null;
  return {
    severity: "critical",
    category: "auth-gate",
    detail: `Ruta protegida respondió HTTP ${status} sin credenciales — debería rechazar (401/403)`,
  };
}
