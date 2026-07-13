import { erp } from "./erp-client.js";
import { googleCalendar, gmail, googleAvailable } from "./integrations/google.js";
import { zoom, zoomAvailable } from "./integrations/zoom.js";
import { dropbox, dropboxAvailable } from "./integrations/dropbox.js";
import { tavily, tavilyAvailable } from "./integrations/tavily.js";
import { query } from "./db.js";

// ── Definición de herramientas para Claude tool use ───────────────────────────

export const ALICIA_TOOLS = [
  // ── ERP ────────────────────────────────────────────────────────────────────
  {
    name: "create_task",
    description: "Crea una tarea real en el ERP de ALICE. Úsala cuando el usuario pida crear, agregar o asignar una tarea.",
    input_schema: {
      type: "object",
      properties: {
        title:       { type: "string", description: "Título claro y accionable" },
        space_id:    { type: "string", description: "Space: hq · dc01 · pu01 · tg01 · l36 · legendre · bam · finanzas · legal · comercial · marketing · growth" },
        assignee_id: { type: "string", description: "ID del responsable: sb · vd · jt · jm · aa · ac · jmg" },
        priority:    { type: "string", enum: ["urgente","alta","media","baja"] },
        due_date:    { type: "string", description: "Fecha límite YYYY-MM-DD" },
        description: { type: "string" },
        parent_id:   { type: "number", description: "ID de tarea padre si es subtarea" },
      },
      required: ["title", "space_id"],
    },
  },
  {
    name: "update_task",
    description: "Actualiza estado, prioridad, asignado u otro campo de una tarea existente.",
    input_schema: {
      type: "object",
      properties: {
        task_id:     { type: "number" },
        status:      { type: "string", enum: ["todo","in_progress","review","done","cancelled"] },
        priority:    { type: "string", enum: ["urgente","alta","media","baja"] },
        assignee_id: { type: "string" },
        due_date:    { type: "string" },
        title:       { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "get_tasks",
    description: "Consulta tareas del ERP. Úsala cuando pregunten qué está pendiente, qué hay en un proyecto, o el estado del trabajo.",
    input_schema: {
      type: "object",
      properties: {
        space_id:    { type: "string" },
        assignee_id: { type: "string" },
        status:      { type: "string", enum: ["todo","in_progress","review","done","cancelled"] },
      },
    },
  },

  // ── Google Calendar ────────────────────────────────────────────────────────
  {
    name: "calendar_list",
    description: "Ve los eventos del calendario de Google. Úsala cuando pregunten qué hay agendado, qué reuniones hay, o el calendario de alguien.",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: { type: "number", description: "Cuántos días hacia adelante ver (default 7)" },
      },
    },
  },
  {
    name: "calendar_create",
    description: "Crea un evento en Google Calendar. Úsala para agendar reuniones reales.",
    input_schema: {
      type: "object",
      properties: {
        title:       { type: "string" },
        date:        { type: "string", description: "YYYY-MM-DD" },
        time:        { type: "string", description: "HH:MM (24h)" },
        end_time:    { type: "string", description: "HH:MM fin" },
        attendees:   { type: "array", items: { type: "string" }, description: "Emails de los asistentes" },
        description: { type: "string", description: "Agenda / brief de la reunión" },
        location:    { type: "string" },
      },
      required: ["title", "date"],
    },
  },

  {
    name: "check_availability",
    description: "Chequea la disponibilidad (libre/ocupado) de una o varias personas del equipo en un rango de fechas. ÚSALA SIEMPRE antes de agendar una reunión con otra persona: si el horario pedido está ocupado, sugerí alternativas libres y aclarás que lo confirmás con esa persona. Solo muestra bloques ocupados, nunca el detalle de los eventos ajenos.",
    input_schema: {
      type: "object",
      properties: {
        user_ids: { type: "array", items: { type: "string" }, description: "IDs del equipo a consultar: sb · vd · jt · jm · aa · ac · jmg" },
        date:     { type: "string", description: "Día a consultar YYYY-MM-DD" },
        days:     { type: "number", description: "Cuántos días desde esa fecha (default 1)" },
      },
      required: ["user_ids", "date"],
    },
  },

  // ── Gmail ──────────────────────────────────────────────────────────────────
  {
    name: "gmail_search",
    description: "Busca emails en Gmail. Úsala cuando pregunten por un correo, una comunicación, o información que podría estar en el mail.",
    input_schema: {
      type: "object",
      properties: {
        query:       { type: "string", description: "Búsqueda en formato Gmail: 'from:juan subject:contrato after:2024/01/01'" },
        max_results: { type: "number", description: "Máximo de resultados (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "gmail_draft",
    description: "Redacta un borrador de email en Gmail. NO lo envía — solo crea el borrador para que Sebastián lo revise.",
    input_schema: {
      type: "object",
      properties: {
        to:      { type: "string", description: "Email del destinatario" },
        subject: { type: "string" },
        body:    { type: "string", description: "Cuerpo del email en texto plano" },
      },
      required: ["to", "subject", "body"],
    },
  },

  // ── Zoom ───────────────────────────────────────────────────────────────────
  {
    name: "zoom_list_recordings",
    description: "Lista las grabaciones recientes de Zoom. Úsala cuando quieran procesar una reunión grabada.",
    input_schema: {
      type: "object",
      properties: {
        days_back: { type: "number", description: "Días hacia atrás para buscar grabaciones (default 30)" },
      },
    },
  },

  // ── Dropbox ────────────────────────────────────────────────────────────────
  {
    name: "dropbox_search",
    description: "Busca archivos en Dropbox. Úsala cuando pregunten por un documento, contrato, plano, o archivo.",
    input_schema: {
      type: "object",
      properties: {
        query:    { type: "string", description: "Nombre o palabras clave del archivo" },
        path:     { type: "string", description: "Carpeta donde buscar (opcional)" },
        max_results: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "dropbox_read",
    description: "Lee el contenido de un archivo de texto en Dropbox (contratos, docs, etc.).",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path completo del archivo en Dropbox" },
      },
      required: ["file_path"],
    },
  },

  // ── Web Search ─────────────────────────────────────────────────────────────
  {
    name: "web_search",
    description: "Busca información en internet. Úsala para noticias del mercado inmobiliario peruano, precios, regulaciones, o cualquier info que requiera data actual.",
    input_schema: {
      type: "object",
      properties: {
        query:      { type: "string", description: "Búsqueda en español o inglés" },
        max_results: { type: "number", description: "Resultados a devolver (default 5)" },
      },
      required: ["query"],
    },
  },

  // ── Knowledge base ─────────────────────────────────────────────────────────
  {
    name: "save_knowledge",
    description: "Guarda algo que Alicia aprendió sobre Hygge, sus proyectos, el equipo, el mercado, o una decisión importante. Úsala cuando la conversación revele info valiosa que Alicia debe recordar.",
    input_schema: {
      type: "object",
      properties: {
        topic:    { type: "string", description: "Tema corto (ej: 'DC01 - avance obra', 'Legendre - riesgo municipal')" },
        category: { type: "string", enum: ["proyecto","empresa","mercado","persona","decision","riesgo","financiero","otro"] },
        content:  { type: "string", description: "Lo que Alicia aprendió, en detalle" },
        source:   { type: "string", description: "De dónde viene esta info (conversación, email, reunión, etc.)" },
      },
      required: ["topic", "category", "content"],
    },
  },
  {
    name: "search_knowledge",
    description: "Busca en la base de conocimiento de Alicia sobre Hygge. Úsala antes de responder preguntas sobre proyectos, la empresa, o el equipo.",
    input_schema: {
      type: "object",
      properties: {
        topic:    { type: "string", description: "Tema a buscar" },
        category: { type: "string", enum: ["proyecto","empresa","mercado","persona","decision","riesgo","financiero","otro"] },
      },
      required: ["topic"],
    },
  },
  {
    name: "search_resources",
    description: "Busca en la biblioteca de recursos del equipo: links, conectores, snippets de código y notas guardadas por Sebastián. Úsala cuando pidan un link, una credencial de servicio, un código o algo 'que está guardado'.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Qué buscar (nombre o contenido)" },
        type:  { type: "string", enum: ["link","connector","code","skill","nota"], description: "Filtrar por tipo (opcional)" },
      },
      required: ["query"],
    },
  },
  {
    name: "agents_status",
    description: "Estado de TUS agentes Wonderland (tu equipo de IT autónomo): White Rabbit 🐰 (guardia de infraestructura), Cheshire 😺 (tester E2E), Tea Table 🫖 (síntesis semanal). Devuelve la última corrida de cada uno y los hallazgos abiertos. Usala cuando pregunten por el conejo, el gato, los agentes, el monitoreo, bugs del sistema o el estado de la infraestructura.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "use_skill",
    description: "Carga el playbook completo de una skill enseñada por el equipo. Tu system prompt lista las skills disponibles — cuando la tarea coincida con una, cargala ANTES de responder y seguí sus instrucciones al pie de la letra.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre exacto de la skill a cargar" },
      },
      required: ["name"],
    },
  },
];

// ── Ejecutor de tools ─────────────────────────────────────────────────────────

export async function executeTool(toolName, input, userId) {
  switch (toolName) {

    // ── ERP ──────────────────────────────────────────────────────────────────
    case "create_task": {
      const task = await erp.createTask({ ...input, created_by: userId });
      return `Tarea creada ✓ ID #${task.id}: "${task.title}" · ${task.space_id} · ${task.priority} · ${task.status}`;
    }
    case "update_task": {
      const { task_id, ...fields } = input;
      const task = await erp.updateTask(task_id, { ...fields, updated_by: userId });
      return `Tarea #${task.id} actualizada ✓: ${JSON.stringify(fields)}`;
    }
    case "get_tasks": {
      const tasks = await erp.getTasks(input);
      if (!tasks.length) return "No hay tareas con esos filtros.";
      return tasks.map(t =>
        `#${t.id} [${t.status}] ${t.title} — ${t.assignee_id || "sin asignar"} · ${t.priority}${t.due_date ? ` · vence ${t.due_date}` : ""}`
      ).join("\n");
    }

    // ── Google Calendar ───────────────────────────────────────────────────────
    case "calendar_list": {
      const calUser = googleAvailable(userId) ? userId : "sb";
      if (!googleAvailable(calUser)) return `Google Calendar no conectado. Autorizar en https://aliceai.bam.pe/auth/google?user=${userId}`;
      const days = input.days_ahead || 7;
      const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const events = await googleCalendar.listEvents({ timeMax: to }, calUser);
      if (!events.length) return "No hay eventos en ese período.";
      return events.map(e =>
        `• ${e.start?.slice(0,16).replace("T"," ")} — ${e.title}${e.attendees?.length ? ` (${e.attendees.join(", ")})` : ""}${e.meetLink ? ` 🔗` : ""}`
      ).join("\n");
    }
    case "calendar_create": {
      const evUser = googleAvailable(userId) ? userId : "sb";
      if (!googleAvailable(evUser)) return `Google Calendar no conectado. Autorizar en https://aliceai.bam.pe/auth/google?user=${userId}`;
      const event = await googleCalendar.createEvent({
        title: input.title, date: input.date, time: input.time,
        endTime: input.end_time, attendees: input.attendees || [],
        description: input.description, location: input.location,
      }, evUser);
      return `Evento creado en Google Calendar ✓: "${event.summary}" el ${input.date}${input.time ? " a las " + input.time : ""}${event.hangoutLink ? " · Meet: " + event.hangoutLink : ""}`;
    }

    case "check_availability": {
      const { freeBusy } = await import("./integrations/google.js");
      const ids = input.user_ids || [];
      const { rows: profs } = query(
        `SELECT user_id, name, email FROM profiles WHERE user_id IN (${ids.map(() => "?").join(",")})`, ids
      );
      const withEmail = profs.filter(p => p.email);
      const missing = ids.filter(id => !withEmail.find(p => p.user_id === id));
      if (!withEmail.length) return `No tengo el email de ${ids.join(", ")} — pedile a Sebastián que los cargue en los perfiles.`;
      const timeMin = new Date(`${input.date}T00:00:00-05:00`).toISOString();
      const timeMax = new Date(new Date(`${input.date}T00:00:00-05:00`).getTime() + (input.days || 1) * 86400000).toISOString();
      const cal = await freeBusy({ emails: withEmail.map(p => p.email), timeMin, timeMax }, userId);
      const fmt = (iso) => new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", weekday: "short", hour: "2-digit", minute: "2-digit" });
      let out = withEmail.map(p => {
        const busy = cal[p.email]?.busy || [];
        const errs = cal[p.email]?.errors;
        if (errs) return `• ${p.name}: no pude consultar su calendario (${errs[0]?.reason || "error"})`;
        if (!busy.length) return `• ${p.name}: LIBRE todo el período ✓`;
        return `• ${p.name} ocupado en: ${busy.map(b => `${fmt(b.start)}–${fmt(b.end).split(" ").pop()}`).join(" · ")}`;
      }).join("\n");
      if (missing.length) out += `\n(Sin email registrado: ${missing.join(", ")})`;
      return out;
    }

    // ── Gmail ─────────────────────────────────────────────────────────────────
    case "gmail_search": {
      if (!googleAvailable(userId)) return `Tu Gmail no está conectado. Autorizar en https://aliceai.bam.pe/auth/google?user=${userId}`;
      const emails = await gmail.searchEmails({ query: input.query, maxResults: input.max_results || 5 }, userId);
      if (!emails.length) return "No encontré emails con esa búsqueda.";
      return emails.map(e =>
        `📧 De: ${e.from}\n   Asunto: ${e.subject}\n   Fecha: ${e.date}\n   ${e.body?.slice(0, 200)}...`
      ).join("\n\n");
    }
    case "gmail_draft": {
      if (!googleAvailable(userId)) return `Tu Gmail no está conectado. Autorizar en https://aliceai.bam.pe/auth/google?user=${userId}`;
      await gmail.createDraft({ to: input.to, subject: input.subject, body: input.body }, userId);
      return `Borrador creado ✓ en Gmail — Para: ${input.to} · Asunto: "${input.subject}". Revisalo antes de enviar.`;
    }

    // ── Zoom ──────────────────────────────────────────────────────────────────
    case "zoom_list_recordings": {
      if (!zoomAvailable()) return "Zoom no configurado aún (falta ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).";
      const daysBack = input.days_back || 30;
      const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const recordings = await zoom.listRecordings({ from });
      if (!recordings.length) return "No hay grabaciones en ese período.";
      return recordings.map(r =>
        `🎥 "${r.topic}" — ${r.startTime?.slice(0,10)} · ${r.duration} min · ${r.recordingFiles?.length || 0} archivos`
      ).join("\n");
    }

    // ── Dropbox ───────────────────────────────────────────────────────────────
    case "dropbox_search": {
      if (!dropboxAvailable()) return "Dropbox no configurado aún (falta DROPBOX_ACCESS_TOKEN).";
      const results = await dropbox.search({ query: input.query, path: input.path, maxResults: input.max_results || 10 });
      if (!results.length) return "No encontré archivos con esa búsqueda.";
      return results.map(r => `📁 ${r.name}\n   ${r.path}`).join("\n");
    }
    case "dropbox_read": {
      if (!dropboxAvailable()) return "Dropbox no configurado aún.";
      const content = await dropbox.getFileContent(input.file_path);
      return `Contenido de ${input.file_path}:\n\n${content.slice(0, 4000)}`;
    }

    // ── Web Search ────────────────────────────────────────────────────────────
    case "web_search": {
      if (!tavilyAvailable()) return "Web search no configurado aún (falta TAVILY_API_KEY).";
      const result = await tavily.search({ query: input.query, maxResults: input.max_results || 5 });
      let out = "";
      if (result.answer) out += `**Respuesta directa:** ${result.answer}\n\n`;
      out += result.results.map(r => `• ${r.title}\n  ${r.url}\n  ${r.content}`).join("\n\n");
      return out || "No encontré resultados.";
    }

    // ── Knowledge base ────────────────────────────────────────────────────────
    case "save_knowledge": {
      query(
        `INSERT INTO knowledge (topic, category, content, source, created_by)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(topic, category) DO UPDATE SET content=excluded.content, source=excluded.source, updated_at=datetime('now')`,
        [input.topic, input.category, input.content, input.source || null, userId || "alicia"]
      );
      return `Conocimiento guardado ✓: [${input.category}] ${input.topic}`;
    }
    case "search_knowledge": {
      const { rows } = query(
        `SELECT topic, category, content, updated_at FROM knowledge
         WHERE topic LIKE ? ${input.category ? "AND category = ?" : ""}
         ORDER BY updated_at DESC LIMIT 5`,
        input.category ? [`%${input.topic}%`, input.category] : [`%${input.topic}%`]
      );
      if (!rows.length) return `No encontré nada sobre "${input.topic}" en la base de conocimiento.`;
      return rows.map(r => `[${r.category}] ${r.topic} (${r.updated_at?.slice(0,10)})\n${r.content}`).join("\n\n");
    }

    case "search_resources": {
      const params = [`%${input.query}%`, `%${input.query}%`];
      let sql = `SELECT type, name, content, notes FROM resources WHERE (name LIKE ? OR content LIKE ?)`;
      if (input.type) { sql += ` AND type = ?`; params.push(input.type); }
      const { rows } = query(sql + ` LIMIT 10`, params);
      if (!rows.length) return `No encontré recursos para "${input.query}".`;
      return rows.map(r => `[${r.type}] ${r.name}\n${r.content}${r.notes ? `\nNota: ${r.notes}` : ""}`).join("\n\n");
    }

    case "agents_status": {
      const { rows: lastRuns } = query(`SELECT r.agent, r.result, r.summary, r.created_at FROM agent_runs r
        INNER JOIN (SELECT agent, MAX(id) mx FROM agent_runs GROUP BY agent) m ON r.agent = m.agent AND r.id = m.mx`);
      const { rows: open } = query(`SELECT agent, severity, category, detail, created_at FROM agent_findings
        WHERE status IN ('open','escalated') ORDER BY created_at DESC LIMIT 20`);
      if (!lastRuns.length) return "Ningún agente ha corrido todavía.";
      return JSON.stringify({ ultima_corrida_por_agente: lastRuns, hallazgos_abiertos: open });
    }

    case "use_skill": {
      const { rows } = query(`SELECT name, content FROM skills WHERE name = ? OR name LIKE ?`, [input.name, `%${input.name}%`]);
      if (!rows.length) return `No existe la skill "${input.name}". Skills disponibles: ${query("SELECT name FROM skills").rows.map(r => r.name).join(", ") || "ninguna"}`;
      return `## Skill: ${rows[0].name}\n\n${rows[0].content}`;
    }

    default:
      return `Tool desconocida: ${toolName}`;
  }
}
