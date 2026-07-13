// Cerebro de Alicia → Dropbox · espejo legible y organizado
// /Hygge/Sistema/Alicia/ = cerebro (knowledge, skills, config)
// /Hygge/Sistema/Alicia/Memoria/<nombre>.md = una carpeta mental por persona
import { query, parseArr } from "./db.js";
import { dropbox, dropboxAvailable } from "./integrations/dropbox.js";

const BASE = "/Hygge/Sistema/Alicia";

const fmtDate = () => new Date().toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "full", timeStyle: "short" });

function personaMd(userId) {
  const { rows } = query("SELECT * FROM user_personas WHERE user_id = ?", [userId]);
  const p = rows[0];
  if (!p) return "_Alicia todavía no armó una persona para esta persona._\n";
  return `### Cómo la trato (persona aprendida)
- **Estilo:** ${p.style || "—"}
- **Le importa:** ${p.focus || "—"}
- **Prefiere:** ${p.preferences || "—"}
- **Evito:** ${p.avoid || "—"}
${p.manual_instructions ? `\n### Instrucciones directas que me dio\n${p.manual_instructions}\n` : ""}
### Diales
Sarcasmo ${p.sarcasm || 0}/100 · Humor ${p.humor ?? 5}/10 · Formalidad ${p.formality ?? 5}/10 · Proactividad ${p.proactivity ?? 7}/10 · Longitud ${p.length ?? 5}/10 · Emojis ${p.emojis ?? 3}/10
`;
}

function memoriesMd(userId) {
  const { rows } = query(
    "SELECT content, category, importance, created_at FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC LIMIT 100",
    [userId]
  );
  if (!rows.length) return "_Sin memorias todavía._\n";
  const byCategory = {};
  for (const m of rows) (byCategory[m.category || "general"] ||= []).push(m);
  return Object.entries(byCategory).map(([cat, ms]) =>
    `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n` +
    ms.map(m => `- ${"★".repeat(m.importance)}${"☆".repeat(5 - m.importance)} ${m.content} _(${(m.created_at || "").slice(0, 10)})_`).join("\n")
  ).join("\n\n") + "\n";
}

function insightsMd(userId) {
  const { rows } = query("SELECT report, updated_at FROM user_insights WHERE user_id = ?", [userId]);
  if (!rows[0]) return "";
  try {
    const r = JSON.parse(rows[0].report);
    const sec = (t, items) => items?.length ? `**${t}:**\n${items.map(i => `- ${i}`).join("\n")}\n` : "";
    return `## Mi lectura de su desempeño _(${(rows[0].updated_at || "").slice(0, 10)})_
${r.resumen ? `_${r.resumen}_\n` : ""}
${sec("Fortalezas", r.fortalezas)}${sec("Áreas de mejora", r.fallas)}${sec("Green flags", r.green_flags)}${sec("Red flags", r.red_flags)}`;
  } catch { return ""; }
}

function statsMd(userId) {
  const { rows: m } = query("SELECT COUNT(*) c, MAX(created_at) last FROM messages WHERE user_id = ?", [userId]);
  return `Interacciones totales: ${m[0]?.c || 0} · Última: ${(m[0]?.last || "nunca").slice(0, 16)}`;
}

export async function exportBrainToDropbox() {
  if (!dropboxAvailable()) throw new Error("Dropbox no configurado");
  const files = [];

  // Estructura
  for (const p of [BASE, `${BASE}/Memoria`, `${BASE}/Skills`]) {
    await dropbox.createFolder(p).catch(() => {}); // ya existe = ok
  }

  // README
  files.push([`${BASE}/README.md`, `# Cerebro de Alicia 🧠
Espejo legible de mi memoria viva. Se regenera automáticamente cada noche — **no editar a mano** (los cambios se pisan; para enseñarme cosas usá el panel en aliceai.bam.pe o contame directamente).

- \`Empresa.md\` — lo que sé de Hygge
- \`Skills/\` — los oficios que me enseñaron
- \`Memoria/<persona>.md\` — mi relación con cada uno: su personalidad, cómo lo trato, lo que sé de él/ella

_Última sincronización: ${fmtDate()}_
`]);

  // Knowledge de la empresa
  const { rows: knowledge } = query("SELECT topic, category, content, updated_at FROM knowledge ORDER BY category, updated_at DESC");
  const byCat = {};
  for (const k of knowledge) (byCat[k.category] ||= []).push(k);
  files.push([`${BASE}/Empresa.md`, `# Lo que sé de Hygge\n_${fmtDate()}_\n\n` +
    (Object.entries(byCat).map(([cat, ks]) =>
      `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n` +
      ks.map(k => `### ${k.topic}\n${k.content}\n_(actualizado ${(k.updated_at || "").slice(0, 10)})_`).join("\n\n")
    ).join("\n\n") || "_Sin conocimiento guardado todavía._")]);

  // Skills
  const { rows: skills } = query("SELECT name, description, content FROM skills ORDER BY name");
  for (const sk of skills) {
    files.push([`${BASE}/Skills/${sk.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}.md`,
      `# Skill: ${sk.name}\n_Cuándo la uso: ${sk.description}_\n\n${sk.content}\n`]);
  }

  // Memoria por persona
  const { rows: profiles } = query("SELECT user_id, name, role FROM profiles ORDER BY user_id");
  for (const prof of profiles) {
    const first = (prof.name || prof.user_id).split(" ")[0];
    files.push([`${BASE}/Memoria/${first} (${prof.user_id}).md`, `# ${prof.name} · ${prof.role || ""}
_${statsMd(prof.user_id)}_

${personaMd(prof.user_id)}
## Lo que sé de ${first}
${memoriesMd(prof.user_id)}
${insightsMd(prof.user_id)}
_Sincronizado: ${fmtDate()}_
`]);
  }

  // Subir todo
  let uploaded = 0;
  for (const [path, content] of files) {
    await dropbox.uploadFile(path, content);
    uploaded++;
  }
  console.log(`🧠→📦 Cerebro exportado a Dropbox: ${uploaded} archivos en ${BASE}`);
  return { uploaded, base: BASE, files: files.map(f => f[0]) };
}
