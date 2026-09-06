import Anthropic from "@anthropic-ai/sdk";

// Loop de aprendizaje · fusión de lecciones equivalentes.
//
// El problema que resuelve: `proposeLesson` acumula evidencia con igualdad EXACTA de
// texto (`WHERE scope = ? AND lesson = ?`), y las lecciones las redacta un modelo, así
// que el fraseo cambia cada semana. Medido el 2026-09-05 sobre producción: 42 lecciones
// en `proposed`, 41 de ellas con evidencia 1, ninguna que hubiera llegado nunca a
// `validated` en un mes de loop. Cuatro semanas de Cheshire diciendo la misma cosa de
// cuatro maneras distintas son cuatro filas de evidencia 1 en vez de una de evidencia 4.
//
// Esta pasada corre ANTES del gate-pass y funde lo equivalente. No toca `proposeLesson`
// —que sigue síncrona— justamente para no propagar `async` a sus cinco llamadores.

// Deja el texto en su forma comparable: sin markdown, sin tildes, sin mayúsculas, con
// los números en comodín (el Tea Table repite la misma frase con el contador de días
// cambiando) y sin la puntuación del final. Es el atajo barato: cuando dos lecciones
// coinciden acá, no hace falta gastar una llamada al modelo para saber que son la misma.
export function normalize(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // tildes fuera
    .toLowerCase()
    .replace(/[*_`>#]+/g, " ")                          // markdown fuera
    .replace(/^\s*[-•]\s+/gm, " ")                      // viñetas fuera
    .replace(/\d+/g, "#")                               // 20 días == 34 días
    .replace(/[^\p{L}\p{N}#\s]+/gu, " ")                // puntuación fuera
    .replace(/\s+/g, " ")
    .trim();
}

const _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const DEDUP_MODEL = "claude-opus-5";

export function buildClusterPrompt(rows) {
  const system = `Sos el desduplicador del loop de aprendizaje de ALICE. Te doy lecciones que un mismo agente se propuso a sí mismo en semanas distintas. Como las redacta un modelo, la misma lección aparece varias veces con otras palabras.

Agrupá las que dicen LO MISMO: la misma corrección, sobre el mismo problema, que llevaría a la misma acción. Dos lecciones sobre el mismo sistema pero pidiendo cosas distintas NO son la misma. Ante la duda, no las agrupes: una fusión de más infla la evidencia de algo que nadie dijo dos veces.

Respondé SOLO un objeto JSON, sin markdown ni explicación:
{"groups": [[<índices de un grupo>], ...]}
Incluí solo los grupos de 2 o más. Si ninguna se repite, respondé {"groups": []}.`;

  const user = rows.map((r, i) => `[${i}] ${r.lesson}`).join("\n");
  return { system, user };
}

async function clusterScope(rows, { client = _client } = {}) {
  const { system, user } = buildClusterPrompt(rows);
  const resp = await client.messages.create({
    model: DEDUP_MODEL,
    max_tokens: 500,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = resp?.content?.find(b => b.type === "text")?.text?.trim() || "";
  const raw = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!raw) throw new Error("el desduplicador no devolvió JSON");
  const groups = JSON.parse(raw).groups;
  if (!Array.isArray(groups)) throw new Error("respuesta sin 'groups'");
  // Un índice inventado invalida su grupo entero: fusionar por una posición que no
  // existe es fusionar a ciegas.
  return groups
    .filter(g => Array.isArray(g) && g.length > 1)
    .filter(g => g.every(i => Number.isInteger(i) && i >= 0 && i < rows.length))
    .map(g => [...new Set(g)])
    .filter(g => g.length > 1);
}

// Funde un grupo: gana la más vieja (id menor), se le suma la evidencia de las demás y
// las absorbidas pasan a 'retired'. No se borra nada — queda auditable y reversible.
function applyGroup(db, group) {
  const sorted = [...group].sort((a, b) => a.id - b.id);
  const winner = sorted[0];
  const absorbed = sorted.slice(1);
  const total = sorted.reduce((n, r) => n + (r.evidence_count || 1), 0);
  db.prepare("UPDATE lessons SET evidence_count = ?, updated_at = datetime('now') WHERE id = ?")
    .run(total, winner.id);
  for (const r of absorbed) {
    db.prepare(
      `UPDATE lessons SET status = 'retired',
         trigger = COALESCE(trigger, '') || ' · fusionada en #${winner.id}',
         updated_at = datetime('now') WHERE id = ?`
    ).run(r.id);
  }
  return absorbed.length;
}

// Corre antes del gate-pass. Nunca lanza: un problema acá no puede trabar el loop.
export async function mergeEquivalentLessons(db, { client } = {}) {
  const counts = { scopes: 0, merged: 0, errors: 0 };
  let rows;
  try {
    rows = db.prepare(
      "SELECT id, scope, lesson, evidence_count FROM lessons WHERE status = 'proposed' ORDER BY id"
    ).all();
  } catch { return counts; }

  const byScope = new Map();
  for (const r of rows) {
    if (!byScope.has(r.scope)) byScope.set(r.scope, []);
    byScope.get(r.scope).push(r);
  }

  for (const [, scopeRows] of byScope) {
    if (scopeRows.length < 2) continue;
    counts.scopes++;

    // 1) El atajo barato: mismo texto normalizado, sin gastar una llamada.
    const byNorm = new Map();
    for (const r of scopeRows) {
      const k = normalize(r.lesson);
      if (!byNorm.has(k)) byNorm.set(k, []);
      byNorm.get(k).push(r);
    }
    const survivors = [];
    for (const [, group] of byNorm) {
      if (group.length > 1) {
        counts.merged += applyGroup(db, group);
        survivors.push([...group].sort((a, b) => a.id - b.id)[0]);
      } else {
        survivors.push(group[0]);
      }
    }

    // 2) Lo que quedó distinto a los ojos, al juez.
    if (survivors.length < 2) continue;
    let groups;
    try {
      groups = await clusterScope(survivors, { client });
    } catch {
      counts.errors++;   // fail-open: este scope no se funde, los demás siguen
      continue;
    }
    for (const g of groups) counts.merged += applyGroup(db, g.map(i => survivors[i]));
  }

  return counts;
}
