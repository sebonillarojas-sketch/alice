// El hilo tal como lo tiene que ver el ERP.
//
// Distinto de readConversation() de tools.js: aquella alimenta a la tool
// read_conversation y no trae canal. Acá el canal importa, porque el space
// ahora muestra el hilo REAL — y en ese hilo aparecen los mensajes de WhatsApp.
// Sin marcarlos, la persona no entiende de dónde salieron.

const parseActions = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

export function readThread(db, userId, limit = 60) {
  const rows = db.prepare(
    `SELECT id, role, content, channel, actions, created_at
       FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?`
  ).all(userId, limit);
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    channel: r.channel || "app",
    actions: parseActions(r.actions),
    createdAt: r.created_at,
  }));
}
