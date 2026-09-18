// El puente Alicia → Mica sobre el MISMO número de WhatsApp.
//
// El número (+51 933 784 348) es el de Alicia y por ahí le habla al equipo todos
// los días. Mica no se pone delante de ese canal: el brain sigue siendo la puerta
// y solo le pasa a Mica las conversaciones que lo pidieron con "ACTIVAR MICA".
// Si Mica se cae, Alicia sigue funcionando.
//
// Es un arreglo de PRUEBA: cuando el sender propio de Mica esté aprobado, esto
// se borra y cada una atiende por su número.

export function ensureModoSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mica_modo (
      phone TEXT PRIMARY KEY,
      activo INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// Comandos exactos, no "menciona a Mica": si bastara nombrarla, cualquiera que le
// escriba a Alicia "avisale a Mica" se quedaría hablando con la agente equivocada.
const ACTIVAR = /^activar\s+mica[\s!.]*$/i;
const SALIR = /^(salir\s+mica|activar\s+alicia)[\s!.]*$/i;

export function detectarComando(texto = "") {
  const t = String(texto).trim();
  if (ACTIVAR.test(t)) return "activar";
  if (SALIR.test(t)) return "salir";
  return null;
}

export function enModoMica(db, phone) {
  const r = db.prepare("SELECT activo FROM mica_modo WHERE phone = ?").get(phone);
  return !!(r && r.activo);
}

function setModo(db, phone, activo) {
  db.prepare(`
    INSERT INTO mica_modo (phone, activo) VALUES (?, ?)
    ON CONFLICT(phone) DO UPDATE SET activo = excluded.activo, updated_at = datetime('now')
  `).run(phone, activo ? 1 : 0);
}

export const activar = (db, phone) => setModo(db, phone, true);
export const salir = (db, phone) => setModo(db, phone, false);

// Le pregunta a Mica qué responde. El brain manda el mensaje por su propio número.
export async function preguntarAMica({ telefono, texto, nombre, url, key, fetchImpl = globalThis.fetch }) {
  const r = await fetchImpl(`${url}/api/mica/puente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-agent-key": key || "" },
    body: JSON.stringify({ telefono, texto, nombre }),
  });
  if (!r.ok) throw new Error(`Mica ${r.status}: ${await r.text()}`);
  return r.json();
}
