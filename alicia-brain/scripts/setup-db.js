// ── Alicia Brain · Setup SQLite (node:sqlite built-in) ───────────────────────
// node scripts/setup-db.js
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
dotenv.config();

const path = process.env.SQLITE_PATH || "./alicia.db";
const db = new DatabaseSync(path);

console.log("🧠 Configurando cerebro de Alicia (SQLite)...\n");

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    user_id            TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    role               TEXT,
    phone              TEXT,
    projects           TEXT DEFAULT '[]',
    skills_current     TEXT DEFAULT '[]',
    skills_developing  TEXT DEFAULT '[]',
    skills_explore     TEXT DEFAULT '[]',
    growth_short       TEXT,
    growth_long        TEXT,
    growth_notes       TEXT,
    work_style         TEXT,
    strengths          TEXT DEFAULT '[]',
    opportunities      TEXT DEFAULT '[]',
    created_at         TEXT DEFAULT (datetime('now')),
    updated_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
    content    TEXT NOT NULL,
    channel    TEXT DEFAULT 'app',
    wa_msg_id  TEXT,
    actions    TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS memories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT NOT NULL,
    content       TEXT NOT NULL,
    category      TEXT DEFAULT 'general',
    importance    INTEGER DEFAULT 3,
    source_msg_id INTEGER,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, importance DESC, created_at DESC);

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    date       TEXT,
    time       TEXT,
    attendees  TEXT DEFAULT '[]',
    purpose    TEXT,
    brief      TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    space      TEXT,
    assignee   TEXT,
    priority   TEXT,
    due        TEXT,
    note       TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
console.log("✅ Tablas creadas");

const team = [
  { id: "sb",  name: "Sebastián Bonilla", role: "CEO · Hygge Holding",   projects: ["DC01","PU01","TG01","L36","Legendre"], skills_current: ["Visión estratégica","Liderazgo ejecutivo","Desarrollo inmobiliario","Negociación"], skills_developing: ["Gestión financiera avanzada","Producto digital"], skills_explore: ["VC / Fundraising","Expansión regional"], growth_short: "Escalar Hygge a 3 proyectos simultáneos", growth_long: "Posicionar Hygge como developer premium de referencia en Lima", work_style: "Decisivo, pivota rápido, valora la honestidad. Mobile-first.", strengths: ["Visión de largo plazo","Cierre de deals complejos"], opportunities: ["Delegar más operativo","Documentar decisiones clave"] },
  { id: "vd",  name: "Vanessa Dongo",     role: "Admin & Marketing",     projects: ["DC01","PU01"], skills_current: ["Coordinación","Redes sociales","Administración","Atención al cliente"], skills_developing: ["Métricas digitales","Estrategia de contenido"], skills_explore: ["Email marketing","Gestión de proyectos"], growth_short: "Armar calendario de contenido mensual con métricas", growth_long: "Liderar comunicaciones y marca de Hygge", work_style: "Detallista, comunicativa, orientada al servicio.", strengths: ["Organización","Empatía con clientes"], opportunities: ["Más iniciativa en contenido","Profundizar en data"] },
  { id: "jt",  name: "Jose Torres",       role: "Comercial",             projects: ["DC01","PU01","TG01"], skills_current: ["Ventas inmobiliarias","Relación con clientes","Negociación"], skills_developing: ["CRM","Marketing digital"], skills_explore: ["Data analytics","Liderazgo comercial"], growth_short: "Cerrar pipeline Q3 DC01", growth_long: "Armar equipo comercial propio en Hygge", work_style: "Orientado a resultados, proactivo con clientes.", strengths: ["Cierre de ventas","Relación interpersonal"], opportunities: ["Usar más el CRM","Mejorar presentaciones"] },
  { id: "jm",  name: "Joel Moy",          role: "Finanzas",              projects: ["DC01","PU01","TG01","L36"], skills_current: ["Contabilidad","Flujo de caja","Reportes financieros","Excel avanzado"], skills_developing: ["Modelado financiero","Análisis de rentabilidad"], skills_explore: ["Power BI","Python","NIIF"], growth_short: "Dashboard financiero consolidado de los 4 SPVs", growth_long: "CFO de facto de Hygge", work_style: "Meticuloso, orientado al detalle. No improvisa.", strengths: ["Precisión numérica","Confiabilidad"], opportunities: ["Comunicar con narrativa ejecutiva","Simplificar reportes"] },
  { id: "aa",  name: "Ariel Almaguer",    role: "BAM · Arquitectura",    projects: ["DC01","PU01","TG01","L36"], skills_current: ["Diseño arquitectónico","Supervisión de obra","AutoCAD","Revit"], skills_developing: ["BIM avanzado","Gestión de construcción"], skills_explore: ["LEED","Diseño biofílico","Renders para marketing"], growth_short: "Documentar estándar de diseño BAM replicable", growth_long: "Posicionar BAM como estudio con identidad propia", work_style: "Creativo y riguroso. Alta exigencia de calidad.", strengths: ["Visión estética","Capacidad técnica"], opportunities: ["Delegar supervisión rutinaria","Documentar proceso creativo"] },
  { id: "ac",  name: "Andrea Castillo",   role: "Operaciones",           projects: ["DC01","PU01","TG01"], skills_current: ["Coordinación operativa","Gestión de procesos","Comunicación post-venta"], skills_developing: ["Automatización","Análisis de eficiencia"], skills_explore: ["Scrum/Kanban","BI para operaciones"], growth_short: "Manual de procesos operativos de Hygge", growth_long: "Liderar transformación operativa de Hygge", work_style: "Muy organizada, proactiva. Anticipa problemas.", strengths: ["Anticipación de problemas","Seguimiento riguroso"], opportunities: ["Levantar la mano cuando está sobrecargada","Delegar lo transaccional"] },
  { id: "jmg", name: "J.M. Galup",        role: "Legal",                 projects: ["DC01","PU01","TG01","L36","Legendre"], skills_current: ["Derecho inmobiliario","Contratos","Due diligence","Regulación municipal Lima"], skills_developing: ["Derecho tributario","Contratos con inversores"], skills_explore: ["Legal tech","Arbitraje comercial"], growth_short: "Cerrar expedientes Legendre formalmente", growth_long: "Referente legal de estructuración de proyectos complejos en Lima", work_style: "Preciso, minucioso, conservador ante el riesgo.", strengths: ["Rigor jurídico","Confiabilidad"], opportunities: ["Comunicar legal de forma accesible","Agilizar revisiones rutinarias"] },
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO profiles
  (user_id, name, role, projects, skills_current, skills_developing, skills_explore,
   growth_short, growth_long, work_style, strengths, opportunities)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
`);

for (const p of team) {
  insert.run(
    p.id, p.name, p.role,
    JSON.stringify(p.projects),
    JSON.stringify(p.skills_current),
    JSON.stringify(p.skills_developing),
    JSON.stringify(p.skills_explore),
    p.growth_short, p.growth_long, p.work_style,
    JSON.stringify(p.strengths),
    JSON.stringify(p.opportunities)
  );
}
console.log("✅ Perfiles del equipo cargados (7 colaboradores)");

db.close();
console.log(`\n🧠 Cerebro de Alicia listo → ${path}\n`);
