import * as sbTasks from "./supabase-tasks.js";
import { googleCalendar, gmail, googleAvailable } from "./integrations/google.js";
import { zoom, zoomAvailable } from "./integrations/zoom.js";
import { dropbox, dropboxAvailable } from "./integrations/dropbox.js";
import { tavily, tavilyAvailable } from "./integrations/tavily.js";
import { query } from "./db.js";

// ── Helpers testeables (toman `db` explícito para poder testear con :memory:) ─

export function readConversation(db, personaId, limit = 20) {
  const rows = db.prepare(
    "SELECT role, content, created_at FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?"
  ).all(personaId, limit);
  return rows.reverse();
}

export function resolvePhone(db, personaId) {
  const row = db.prepare("SELECT phone FROM profiles WHERE user_id = ?").get(personaId);
  // Fallback al env PHONE_<id>: los números del equipo (y el de Sebastián) viven ahí,
  // no siempre en la tabla profiles. Sin este fallback, send_document/send_whatsapp
  // decían "no tengo tu número" a Sebastián mismo (su número está en PHONE_sb).
  return row?.phone || process.env[`PHONE_${personaId}`] || null;
}

function mimeFromName(name = "") {
  const ext = name.toLowerCase().split(".").pop();
  return ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    csv: "text/csv", txt: "text/plain" }[ext]) || "application/octet-stream";
}

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
        assignee_id:  { type: "string", description: "ID de UN responsable: sb · vd · jt · jm · aa · ac · jmg" },
        assignee_ids: { type: "array", items: { type: "string" }, description: "IDs si es MULTIASIGNADO (2+ responsables): sb · vd · jt · jm · aa · ac · jmg. Preferí esto cuando sean varios." },
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
        assignee_id: { type: "string", description: "reasignar a UN responsable" },
        assignee_ids: { type: "array", items: { type: "string" }, description: "reasignar a VARIOS (multiasignado)" },
        due_date:    { type: "string" },
        title:       { type: "string" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "get_tasks",
    description: "Consulta tareas del ERP. Úsala cuando pregunten qué está pendiente, qué hay en un proyecto, o cuando te pidan actuar sobre una tarea que mencionan de forma aproximada (para encontrarla y confirmar cuál es). Devuelve el #id de cada tarea. Usá 'query' para buscar por palabra clave del título.",
    input_schema: {
      type: "object",
      properties: {
        query:       { type: "string", description: "Palabra(s) clave del título para buscar tareas parecidas (ej. 'valorización', 'plano del lote'). Coincidencia parcial, no exacta." },
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
    description: "Redacta un borrador de email en Gmail. NO lo envía — solo crea el borrador para revisar.",
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
  {
    name: "gmail_send",
    description: "ENVÍA un email de verdad desde el Gmail del usuario. Es una acción irreversible: antes de enviar, confirmá con la persona el destinatario, asunto y cuerpo (salvo que ya te lo haya confirmado explícitamente). Usala cuando te pidan mandar/enviar un correo.",
    input_schema: {
      type: "object",
      properties: {
        to:      { type: "string", description: "Email del destinatario" },
        subject: { type: "string" },
        body:    { type: "string", description: "Cuerpo del email en texto plano" },
        cc:      { type: "string", description: "Copia (opcional)" },
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
  {
    name: "zoom_read_meeting",
    description: "Lee la TRANSCRIPCIÓN completa de una reunión de Zoom grabada para resumirla, sacar action items o DAR TU OPINIÓN sobre lo que se dijo. Pasá el 'topic' (tema) de la reunión; si no lo pasás, toma la más reciente con transcripción.",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Tema/nombre de la reunión a leer (opcional; si se omite, la más reciente)" },
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
    name: "dropbox_move",
    description: "Mueve o renombra un archivo/carpeta dentro de Dropbox. Usala para ordenar: llevar un archivo mal ubicado a su carpeta correcta bajo /Hygge. El destino DEBE estar bajo /Hygge. Si hay conflicto de nombre, renombra automáticamente.",
    input_schema: {
      type: "object",
      properties: {
        from_path: { type: "string", description: "Path actual completo del archivo (ej. /Hygge/04_FINANZAS/doc.pdf)" },
        to_path:   { type: "string", description: "Path destino completo bajo /Hygge, incluyendo el nombre (ej. /Hygge/07_MARKETING/doc.pdf)" },
      },
      required: ["from_path", "to_path"],
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
  {
    name: "dropbox_upload",
    description: "Sube a Dropbox el ÚLTIMO archivo que el usuario mandó por WhatsApp (PDF, imagen, Excel, etc.). Dropbox se espeja en la tab Archivos del ERP: subirlo ahí = ponerlo en el ERP. Usala cuando te pidan guardar/subir/archivar un archivo que acaban de mandar (el buzón lo retiene 30 minutos).",
    input_schema: {
      type: "object",
      properties: {
        folder_path: { type: "string", description: "Carpeta destino bajo /Hygge (ej. /Hygge/08_GROWTH, /Hygge/03_PROYECTOS)" },
        filename:    { type: "string", description: "Nombre para el archivo (opcional; default: nombre original)" },
      },
      required: ["folder_path"],
    },
  },
  {
    name: "send_document",
    description: "Envía un archivo (PDF, imagen, Excel, etc.) por WhatsApp a la persona que te está hablando. Usala cuando te piden 'mandame/enviame/pasame el archivo X' o 'abrime el PDF'. Podés mandar un archivo de Dropbox (dando su ruta) o reenviar el último que te mandaron. SÍ podés enviar archivos por WhatsApp.",
    input_schema: { type: "object", properties: {
      dropbox_path: { type: "string", description: "Ruta del archivo en Dropbox bajo /Hygge (si es de Dropbox). Buscala antes con dropbox_search si no la sabés." },
      filename: { type: "string", description: "nombre a mostrar (opcional)" }
    } }
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
    name: "radar_query",
    description: "Consultá Radar/Nexo — la data real de mercado inmobiliario de Lima (proyectos, precios por m² en USD, tasas hipotecarias, tipo de cambio). Usala cuando pregunten por precios, oferta, proyectos o el mercado de un distrito (Miraflores, San Isidro, etc.) o una tipología. NO inventes cifras: si no hay data, decilo y ofrecé refrescar.",
    input_schema: {
      type: "object",
      properties: {
        district: { type: "string", description: "Distrito a filtrar (ej. 'San Isidro', 'Miraflores'). Opcional; sin él, resumen general." },
        dorms:    { type: "integer", description: "Tipología por N° de dormitorios (ej. 2). Opcional." },
        incluir_macro: { type: "boolean", description: "Incluir tasa hipotecaria y tipo de cambio (default true)." },
      },
    },
  },
  {
    name: "radar_refresh",
    description: "Refrescá Radar disparando el scrape de mercado. Usala cuando pidan traer data nueva/actualizada de mercado. Si la data ya es reciente (<15 min) no re-scrapea y te avisa. Reportá honesto lo que pasó (puede que Nexo caiga a caché).",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["nexo", "urbania", "sbs", "todo"], description: "Fuente a refrescar (default nexo)." },
      },
    },
  },
  {
    name: "ask_agent",
    description: "Conversá en criollo con un agente Wonderland y te responde en 1ª persona con SU data real: white-rabbit 🐰 (infra), cheshire 😺 (tester E2E), knave 🃏 (seguridad), mad-hatter 🎩 (perf/costos), tea-table 🫖 (síntesis), dark-alice 🖤 (operaciones), bandersnatch ⚔️ (carga), jabberwocky ⚡ (fuzzing). Usala cuando pidan 'preguntale al conejo / a Cheshire', o la mirada de un agente sobre infra/seguridad/performance. Distinto de agents_status (que da el estado crudo de todos).",
    input_schema: {
      type: "object",
      properties: {
        agent:    { type: "string", enum: ["white-rabbit","cheshire","knave","mad-hatter","tea-table","dark-alice","bandersnatch","jabberwocky"], description: "A qué agente le preguntás." },
        question: { type: "string", description: "La pregunta en lenguaje natural." },
      },
      required: ["agent", "question"],
    },
  },
  {
    name: "run_agent",
    description: "Disparás una corrida NUEVA de un agente. Inmediatos (resultado al toque): white-rabbit 🐰 (infra), tea-table 🫖 (síntesis), dark-alice 🖤 (estado de ops). En la bestia (los encolo y el resultado llega en ~10 min): cheshire 😺 (test E2E del ERP), knave 🃏 (chequeo de seguridad). Usala cuando pidan 'corré/ejecutá X ahora', 'testeá el ERP', 'revisá seguridad ya'. Distinto de ask_agent (que solo conversa con la data vieja).",
    input_schema: {
      type: "object",
      properties: {
        agent: { type: "string", enum: ["white-rabbit","tea-table","dark-alice","cheshire","knave"], description: "Qué agente correr." },
      },
      required: ["agent"],
    },
  },
  {
    name: "agents_status",
    description: "Estado de TUS agentes Wonderland (tu equipo de IT autónomo): White Rabbit 🐰 (guardia de infraestructura), Cheshire 😺 (tester E2E), Tea Table 🫖 (síntesis semanal). Devuelve la última corrida de cada uno y los hallazgos abiertos. Usala cuando pregunten por el conejo, el gato, los agentes, el monitoreo, bugs del sistema o el estado de la infraestructura.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "disenar_plano",
    description: "Delegá el diseño de una planta residencial a Feyd-Rautha 🗡️, el arquitecto de BAM (agente aparte, crítico implacable, con su propio conocimiento Neufert+RNE+mercado limeño — si él aprueba un plano, es porque está excelente). Usala cuando pidan diseñar, generar o distribuir un plano/planta/tipología de departamento. Vos NO diseñás planos: él sí. Devolvé su layout JSON tal cual, presentándolo en una línea.",
    input_schema: {
      type: "object",
      properties: {
        dormitorios: { type: "number", description: "Cantidad de dormitorios" },
        banos:       { type: "number", description: "Cantidad de baños (2.5 = 2 completos + visita)" },
        area_m2:     { type: "number", description: "Área techada objetivo en m²" },
        frente_m:    { type: "number", description: "Frente del lote/unidad en metros" },
        fondo_m:     { type: "number", description: "Fondo en metros" },
        fachadas:    { type: "array", items: { type: "string", enum: ["frente", "fondo", "izquierda", "derecha"] }, description: "Lados con fachada libre (default: solo frente)" },
        notas:       { type: "string", description: "Pedidos especiales del brief (ej. cocina cerrada, home office)" },
      },
    },
  },
  {
    name: "read_conversation",
    description: "Lee los últimos mensajes de la conversación de OTRA persona del equipo con vos (Alicia). Usala cuando Sebastián pregunta '¿de qué habla X?' o quiere contexto de otro. Solo Sebastián puede usarla.",
    input_schema: { type: "object", properties: {
      persona: { type: "string", description: "ID: sb·vd·jt·jm·aa·ac·jmg" },
      limit: { type: "number", description: "cuántos mensajes (default 20)" }
    }, required: ["persona"] }
  },
  {
    name: "send_whatsapp",
    description: "Manda un WhatsApp a OTRA persona del equipo de parte de Sebastián. Usala cuando él te pide 'decile a X que…' o 'mandale a X…'. Solo Sebastián puede usarla.",
    input_schema: { type: "object", properties: {
      persona: { type: "string", description: "ID destino: vd·jt·jm·aa·ac·jmg" },
      mensaje: { type: "string", description: "el texto a enviar" }
    }, required: ["persona", "mensaje"] }
  },
  {
    name: "review_lessons",
    description: "Lista las lecciones que aprendiste y esperan el OK de Sebastián (estado validated). Devuelve cada una con su #id. Usala cuando Sebastián pregunte qué aprendiste, qué tenés para aprobar, o al traerle las pendientes del día. Solo Sebastián.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "approve_lesson",
    description: "Aplicá una lección pendiente: pasa a 'applied' y se incorpora a tu conocimiento. Usala SOLO con el OK explícito de Sebastián ('aplicá la #3', 'dale a esa'). Solo Sebastián.",
    input_schema: { type: "object", properties: { id: { type: "integer", description: "El #id de la lección" } }, required: ["id"] },
  },
  {
    name: "reject_lesson",
    description: "Descartá una lección pendiente (queda rejected, no se aplica). Usala cuando Sebastián diga que no. Solo Sebastián.",
    input_schema: { type: "object", properties: { id: { type: "integer", description: "El #id de la lección" } }, required: ["id"] },
  },
  {
    name: "capture_lesson",
    description: "Guardá como lección algo que te ENSEÑARON o CORRIGIERON sobre tu comportamiento ('la próxima hacé X', 'no era así, acordate de Y', 'siempre confirmá antes de…'). Queda como PROPUESTA (no se aplica sola: pasa por revisión y aprobación). Usala cuando te corrijan o te pidan recordar una regla de conducta — NO para datos puntuales (para eso está save_knowledge). Solo Sebastián y admins.",
    input_schema: {
      type: "object",
      properties: {
        lesson: { type: "string", description: "La regla/lección en 1 oración, accionable." },
        scope:  { type: "string", description: "Opcional. 'agent:alicia' (default, regla general de tu conducta) o 'user:sb' si es específica de cómo tratar a Sebastián." },
      },
      required: ["lesson"],
    },
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
      const task = await sbTasks.createTask(input, userId);
      const cab = task._dedup
        ? `Esa tarea ya existía (#${task.id}), no la dupliqué:`
        : `Tarea creada ✓ (#${task.id})`;
      return `${cab} "${task.title}" · space ${task.space} · ${task.assignee} · ${task.priority} · ${task.status}`;
    }
    case "update_task": {
      const { task_id, ...fields } = input;
      const task = await sbTasks.updateTask(task_id, fields);
      return `Tarea actualizada ✓ "${task.title}": ${JSON.stringify(fields)}`;
    }
    case "get_tasks": {
      const tasks = await sbTasks.getTasks(input);
      if (!tasks.length) return "No hay tareas con esos filtros.";
      return tasks.map(t =>
        `#${t.id} · ${t.title} [${t.status}] — ${t.assignee || "sin asignar"} · ${t.priority}${t.due ? ` · vence ${t.due}` : ""}`
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
    case "gmail_send": {
      if (!googleAvailable(userId)) return `Tu Gmail no está conectado. Autorizar en https://aliceai.bam.pe/auth/google?user=${userId}`;
      await gmail.send({ to: input.to, subject: input.subject, body: input.body, cc: input.cc }, userId);
      return `📧 Email ENVIADO ✓ — Para: ${input.to}${input.cc ? " · CC: " + input.cc : ""} · Asunto: "${input.subject}"`;
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
    case "zoom_read_meeting": {
      if (!zoomAvailable()) return "Zoom no configurado aún (falta ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).";
      const recs = await zoom.listRecordings({});
      const withT = recs.filter(r => (r.recordingFiles || []).some(f => f.type === "TRANSCRIPT"));
      if (!withT.length) return "No hay reuniones con transcripción disponible. Activá la transcripción automática (audio transcript) en la configuración de grabación de Zoom.";
      const target = input.topic
        ? (withT.find(r => r.topic?.toLowerCase().includes(input.topic.toLowerCase())) || withT[0])
        : withT[0];
      const tFile = target.recordingFiles.find(f => f.type === "TRANSCRIPT");
      const transcript = await zoom.getTranscript(tFile.url);
      return `Transcripción de "${target.topic}" (${target.startTime?.slice(0,10)}, ${target.duration} min):\n\n${transcript.slice(0, 6000)}`;
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
    case "dropbox_move": {
      if (!dropboxAvailable()) return "Dropbox no configurado aún.";
      const to = String(input.to_path || "").trim();
      if (!/^\/Hygge\//i.test(to)) return "El destino debe estar bajo /Hygge (ej. /Hygge/07_MARKETING/archivo.pdf).";
      const moved = await dropbox.moveFile(String(input.from_path || "").trim(), to);
      return `📦 Movido: ${moved.path_display || to}. Ya se refleja en la tab Archivos del ERP.`;
    }
    case "dropbox_upload": {
      if (!dropboxAvailable()) return "Dropbox no configurado aún.";
      const { getLastFile, clearLastFile } = await import("./inbox-files.js");
      const f = getLastFile(userId);
      if (!f) return "No tengo ningún archivo tuyo en el buzón (retiene 30 min). Mandámelo por WhatsApp de nuevo y repetime el pedido.";
      const folder = String(input.folder_path || "").trim().replace(/\/+$/, "");
      if (!/^\/Hygge(\/|$)/i.test(folder)) return "La carpeta debe estar bajo /Hygge (ej. /Hygge/08_GROWTH).";
      const name = String(input.filename || f.filename).replace(/[\\/:*?"<>|]/g, "-").trim();
      const result = await dropbox.uploadFile(`${folder}/${name}`, f.buffer, { mode: "add", autorename: true });
      clearLastFile(userId);
      return `📎 Subido: ${result.path_display || `${folder}/${name}`} (${Math.round(f.buffer.length / 1024)} KB). Ya se espeja en la tab Archivos del ERP.`;
    }

    case "send_document": {
      const { getDB } = await import("./db.js");
      const phone = resolvePhone(getDB(), userId);
      if (!phone) return "No tengo tu WhatsApp en el perfil, no puedo enviártelo por ahí.";
      let buffer, mime, filename;
      if (input.dropbox_path) {
        if (!/^\/Hygge(\/|$)/i.test(input.dropbox_path.trim())) return "Solo puedo enviar archivos que estén bajo /Hygge en Dropbox.";
        const { dropbox, dropboxAvailable } = await import("./integrations/dropbox.js");
        if (!dropboxAvailable()) return "Dropbox no está configurado.";
        try { buffer = await dropbox.getFileBuffer(input.dropbox_path); }
        catch (e) { return `No encontré ese archivo en Dropbox (${e.message}).`; }
        filename = input.filename || input.dropbox_path.split("/").pop();
        mime = mimeFromName(filename);
      } else {
        const { getLastFile } = await import("./inbox-files.js");
        const f = getLastFile(userId);
        if (!f) return "No tengo ningún archivo tuyo reciente ni una ruta de Dropbox. Decime la ruta o mandame el archivo.";
        buffer = f.buffer; mime = f.mediaType; filename = input.filename || f.filename;
      }
      const { stageFile } = await import("./file-relay.js");
      const id = stageFile({ buffer, mime, filename });
      const url = `${process.env.BASE_URL || "https://aliceai.bam.pe"}/file/${id}`;
      try {
        const { sendWADocument } = await import("./wa.js");
        const ok = await sendWADocument(phone, { buffer, mimetype: mime, filename, url });
        return ok ? `📎 Te mandé "${filename}" por WhatsApp.` : `Preparé "${filename}" pero no pude enviarlo por WhatsApp (canal no disponible).`;
      } catch (e) { return `No pude enviarte el archivo: ${e.message}`; }
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

    case "radar_query": {
      const { getLatestSnapshot, getMacroData, getBankRates } = await import("./market.js");
      const { summarizeMarket, formatMarketSummary } = await import("./radar.js");
      const incMacro = input.incluir_macro !== false;
      const summary = summarizeMarket(getLatestSnapshot(), {
        district: input.district,
        dorms: input.dorms,
        macro: incMacro ? getMacroData() : null,
        bankRates: incMacro ? getBankRates() : null,
      });
      return formatMarketSummary(summary);
    }

    case "radar_refresh": {
      const src = String(input.source || "nexo").toLowerCase();
      const { getLatestSnapshotBySource, refreshMarketData } = await import("./market.js");
      const { isFresh } = await import("./radar.js");
      // Guard anti-spam: si esa fuente se scrapeó hace <15 min, no re-scrapear.
      const bySource = src === "todo" ? null : getLatestSnapshotBySource(src);
      if (bySource && isFresh(bySource.scraped_at)) {
        return `Radar (${src}) ya está fresco — se actualizó ${bySource.scraped_at} con ${bySource.total} proyecto(s). No hace falta refrescar de nuevo por ahora.`;
      }
      try {
        const partes = [];
        if (src === "nexo" || src === "todo") {
          const r = await refreshMarketData();
          partes.push(r.projects?.ok
            ? `Nexo: ${r.projects.total} proyectos nuevos.`
            : `Nexo cayó a caché (${r.projects?.reason || "scrape falló"}); última data: ${r.projects?.last_update || "?"}.`);
        }
        if (src === "urbania" || src === "sbs" || src === "todo") {
          const { runScraperAgent } = await import("./scrapers/index.js");
          const sources = src === "todo" ? ["urbania", "sbs"] : [src];
          const rr = await runScraperAgent({ sources });
          partes.push((rr.results || []).map(x => `${x.source}: ${x.ok ? x.count : "0"}`).join(" · ") || "scrape hecho");
        }
        return partes.length ? `Listo, refresqué Radar. ${partes.join(" ")}` : "No reconocí esa fuente (probá nexo, urbania, sbs o todo).";
      } catch (e) {
        return `Intenté refrescar Radar (${src}) y falló: ${e.message}. La data anterior sigue disponible.`;
      }
    }

    case "ask_agent": {
      const { askAgent } = await import("./agent-voices.js");
      const { getDB } = await import("./db.js");
      return await askAgent(getDB(), input.agent, input.question);
    }

    case "run_agent": {
      const { classifyAgentRun, enqueueRequest } = await import("./agent-requests.js");
      const plan = classifyAgentRun(input.agent);
      if (!plan) return `No puedo correr "${input.agent}". Puedo: white-rabbit, tea-table, dark-alice (al toque) · cheshire, knave (en la bestia, ~10 min).`;
      if (plan.mode === "queue") {
        const { getDB } = await import("./db.js");
        enqueueRequest(getDB(), input.agent, userId);
        const nombre = input.agent === "cheshire" ? "Cheshire 😺" : "Knave 🃏";
        return `Le pedí a ${nombre} que corra en la bestia. Tarda unos minutos — preguntame de nuevo o mirá con agents_status y te muestro el resultado.`;
      }
      try {
        if (plan.run === "white-rabbit") {
          const { runWhiteRabbitChecks } = await import("./whiterabbit.js");
          const r = await runWhiteRabbitChecks();
          return `🐰 White Rabbit corrió recién · ${r.result} · ${r.summary}`;
        }
        if (plan.run === "tea-table") {
          const { runTeaTableReport } = await import("./teatable.js");
          const r = await runTeaTableReport({ notify: false });
          return `🫖 Tea Table corrió recién · ${r.result} · ${r.summary}`;
        }
        const { runDarkAlice } = await import("./darkalice.js");
        const r = await runDarkAlice({ notify: false });
        return `🖤 Dark Alice actualizó el estado de ops · ${r.result} · ${r.summary}`;
      } catch (e) {
        return `Intenté correr ${input.agent} y falló: ${e.message}.`;
      }
    }

    case "agents_status": {
      const { rows: lastRuns } = query(`SELECT r.agent, r.result, r.summary, r.created_at FROM agent_runs r
        INNER JOIN (SELECT agent, MAX(id) mx FROM agent_runs GROUP BY agent) m ON r.agent = m.agent AND r.id = m.mx`);
      const { rows: open } = query(`SELECT agent, severity, category, detail, created_at FROM agent_findings
        WHERE status IN ('open','escalated') ORDER BY created_at DESC LIMIT 20`);
      if (!lastRuns.length) return "Ningún agente ha corrido todavía.";
      return JSON.stringify({ ultima_corrida_por_agente: lastRuns, hallazgos_abiertos: open });
    }

    case "disenar_plano": {
      const { disenarPlano, arquitectoDisponible } = await import("./arquitecto.js");
      if (!arquitectoDisponible()) return "Feyd-Rautha no está disponible: la skill arquitecto-residencial-lima no está en este deploy (seteá ARQUITECTO_SKILL_DIR).";
      const layout = await disenarPlano(input);
      return JSON.stringify(layout);
    }

    case "read_conversation": {
      if (userId !== "sb") return "Solo Sebastián puede leer conversaciones de otras personas.";
      const { getDB } = await import("./db.js");
      const rows = readConversation(getDB(), input.persona, input.limit || 20);
      if (!rows.length) return `No hay conversación registrada con ${input.persona}.`;
      return rows.map(m => `${m.role === "user" ? input.persona : "Alicia"}: ${m.content}`).join("\n");
    }

    case "send_whatsapp": {
      if (userId !== "sb") return "Solo Sebastián puede mandar mensajes en tu nombre a terceros.";
      const { getDB } = await import("./db.js");
      const phone = resolvePhone(getDB(), input.persona);
      if (!phone) return `No tengo el WhatsApp de ${input.persona} en su perfil.`;
      const { sendWA } = await import("./wa.js");
      const ok = await sendWA(phone, input.mensaje);
      return ok ? `Listo, le mandé a ${input.persona}: "${input.mensaje}"` : `No pude enviar el WhatsApp a ${input.persona}.`;
    }

    case "review_lessons": {
      if (userId !== "sb") return "Las lecciones las aprueba directo Sebastián.";
      const { getDB } = await import("./db.js");
      const { pendingLessonsForCEO } = await import("./lessons.js");
      const rows = pendingLessonsForCEO(getDB());
      if (!rows.length) return "No tenés lecciones pendientes de aprobar por ahora.";
      return "Estas esperan tu OK:\n" + rows.map(r => `#${r.id} [${r.risk_level}] ${r.lesson}${r.trigger ? ` — ${r.trigger}` : ""}`).join("\n");
    }

    case "approve_lesson": {
      if (userId !== "sb") return "Solo Sebastián puede aprobar lecciones.";
      const { getDB } = await import("./db.js");
      const { approveLesson } = await import("./lessons.js");
      const r = approveLesson(getDB(), Number(input.id), { by: "sb-whatsapp" });
      return r.applied ? `Listo, apliqué la lección #${input.id} ✓` : `La #${input.id} ya estaba ${r.status} — no la volví a tocar.`;
    }

    case "reject_lesson": {
      if (userId !== "sb") return "Solo Sebastián puede descartar lecciones.";
      const { getDB } = await import("./db.js");
      const { rejectLesson } = await import("./lessons.js");
      rejectLesson(getDB(), Number(input.id), { by: "sb-whatsapp" });
      return `Descarté la lección #${input.id}.`;
    }

    case "capture_lesson": {
      const lesson = String(input.lesson || "").trim();
      if (!lesson) return "¿Qué querés que aprenda exactamente? Decime la regla en una frase.";
      const { getDB } = await import("./db.js");
      const { proposeLesson, runGateOnLesson } = await import("./lessons.js");
      const { HARD_RULES } = await import("./hard-rules.js");
      // Solo scopes que después TIENEN superficie de aprobación (agent:alicia + user:sb);
      // cualquier otro cae al default para no crear lecciones huérfanas que nadie ve.
      const scope = /^(agent:alicia|user:sb)$/.test(input.scope || "") ? input.scope : "agent:alicia";
      const { id } = proposeLesson(getDB(), { scope, source: "correction", trigger: `corrección de ${userId}`, lesson, risk_level: "L1" });
      // Una corrección humana DIRECTA es evidencia suficiente: se corre el gate con minEvidence=1
      // (mantiene el chequeo de reglas duras y el nivel de riesgo) para que aparezca YA para aprobar,
      // sin esperar 3 repeticiones. Aprobar/aplicar sigue siendo un paso humano.
      const res = runGateOnLesson(getDB(), id, { hardRules: HARD_RULES, minEvidence: 1 });
      if (res.status === "rejected") return `No la puedo tomar: choca con una regla dura (${res.reason || "seguridad/autoridad/RNE"}).`;
      if (res.status === "applied") return "Anotado y aplicado 🧠 (era de bajo riesgo).";
      return "Anotado 🧠 — te la dejé lista para aprobar. Decime 'aplicá esa' (o miralas con review_lessons) y la incorporo.";
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
