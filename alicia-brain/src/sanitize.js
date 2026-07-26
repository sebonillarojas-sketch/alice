// Clon-stack 🪞 — sanitizador PURO de la copia de DB (redacta secrets/PII antes de que
// salga de prod). Recibe una conexión sqlite (better-sqlite3 en runtime) y la muta.
export const SANITIZE_RULES = {
  appSettingsSecretKeyLike: ["%token%", "%key%", "%secret%", "dropbox%", "google%", "twilio%", "anthropic%", "groq%", "%password%"],
  dropTables: ["oauth_tokens"],
  profilePlaceholders: { phone: "+000000000", email: "qa@example.com" },
  redactContentTables: ["messages", "conversations"],
};

function safeRun(db, sql, ...args) {
  try { return db.prepare(sql).run(...args).changes || 0; } catch { return 0; }
}

export function sanitizeDb(db) {
  const r = { appSettings: 0, oauth: 0, profiles: 0, messages: 0 };
  for (const pat of SANITIZE_RULES.appSettingsSecretKeyLike) {
    r.appSettings += safeRun(db, "UPDATE app_settings SET value=NULL WHERE lower(key) LIKE ?", pat.toLowerCase());
  }
  for (const t of SANITIZE_RULES.dropTables) r.oauth += safeRun(db, `DELETE FROM ${t}`);
  r.profiles += safeRun(db, "UPDATE profiles SET phone=?, email=?",
    SANITIZE_RULES.profilePlaceholders.phone, SANITIZE_RULES.profilePlaceholders.email);
  for (const t of SANITIZE_RULES.redactContentTables) r.messages += safeRun(db, `UPDATE ${t} SET content='[redactado]'`);
  return r;
}
