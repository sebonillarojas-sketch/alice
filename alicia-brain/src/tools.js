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
      if (!googleAvailable()) return "Google Calendar no configurado aún (falta GOOGLE_CLIENT_ID y credenciales OAuth).";
      const days = input.days_ahead || 7;
      const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const events = await googleCalendar.listEvents({ timeMax: to });
      if (!events.length) return "No hay eventos en ese período.";
      return events.map(e =>
        `• ${e.start?.slice(0,16).replace("T"," ")} — ${e.title}${e.attendees?.length ? ` (${e.attendees.join(", ")})` : ""}${e.meetLink ? ` 🔗` : ""}`
      ).join("\n");
    }
    case "calendar_create": {
      if (!googleAvailable()) return "Google Calendar no configurado aún.";
      const event = await googleCalendar.createEvent({
        title: input.title, date: input.date, time: input.time,
        endTime: input.end_time, attendees: input.attendees || [],
        description: input.description, location: input.location,
      });
      return `Evento creado en Google Calendar ✓: "${event.summary}" el ${input.date}${input.time ? " a las " + input.time : ""}${event.hangoutLink ? " · Meet: " + event.hangoutLink : ""}`;
    }

    // ── Gmail ─────────────────────────────────────────────────────────────────
    case "gmail_search": {
      if (!googleAvailable()) return "Gmail no configurado aún.";
      const emails = await gmail.searchEmails({ query: input.query, maxResults: input.max_results || 5 });
      if (!emails.length) return "No encontré emails con esa búsqueda.";
      return emails.map(e =>
        `📧 De: ${e.from}\n   Asunto: ${e.subject}\n   Fecha: ${e.date}\n   ${e.body?.slice(0, 200)}...`
      ).join("\n\n");
    }
    case "gmail_draft": {
      if (!googleAvailable()) return "Gmail no configurado aún.";
      await gmail.createDraft({ to: input.to, subject: input.subject, body: input.body });
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

    default:
      return `Tool desconocida: ${toolName}`;
  }
}
