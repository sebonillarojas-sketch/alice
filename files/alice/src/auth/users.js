// ─── HYGGE OS · CREDENCIALES MVP FRONT-END ──────────────────────────────────
//
// ⚠️ AVISO DE SEGURIDAD ⚠️
// Esto es auth FRONT-END temporal para el MVP. NO es seguro para producción real:
// Auth real = Supabase (AuthContext). Este archivo solo mapea username→email y metadata
// de UI. NUNCA poner passwords acá: el bundle es público (lección del 13 jul 2026).
//

// allowedSpaces: null = acceso a todos los spaces
// allowedSpaces: [...ids] = solo esos spaces (+ sus sub-spaces)
// isCEO: solo Sebastián puede ver todos los chats de Alicia
export const USERS = [
  {
    id: "sb",
    username: "sebastian",
    firstName: "Sebastián",
    lastName: "Bonilla",
    role: "CEO",
    email: "sebastian@hygge.pe",
    color: "#0A0B0F",
    isAdmin: true,
    isCEO: true,
    allowedSpaces: null,
  },
  {
    id: "vd",
    username: "vanessa",
    firstName: "Vanessa",
    lastName: "Dongo",
    role: "Admin + Marketing",
    email: "vane@hygge.pe",
    color: "#A89BD9",
    isAdmin: true,
    isCEO: false,
    allowedSpaces: null,
  },
  {
    id: "jt",
    username: "jose",
    firstName: "Jose",
    lastName: "Torres",
    role: "Comercial",
    email: "jose@hygge.pe",
    color: "#C2A45A",
    isAdmin: false,
    isCEO: false,
    allowedSpaces: ["comercial", "proyectos"],
  },
  {
    id: "jm",
    username: "joel",
    firstName: "Joel",
    lastName: "Moy",
    role: "Finanzas",
    email: "joel@hygge.pe",
    color: "#5F8A6A",
    isAdmin: false,
    isCEO: false,
    allowedSpaces: ["finanzas", "proyectos"],
  },
  {
    id: "aa",
    username: "ariel",
    firstName: "Ariel",
    lastName: "Almaguer",
    role: "BAM · Arquitectura",
    email: "ariel@bam.pe",
    color: "#3D52D5",
    isAdmin: false,
    isCEO: false,
    allowedSpaces: ["bam", "proyectos"],
  },
  {
    id: "ac",
    username: "andrea",
    firstName: "Andrea",
    lastName: "Castillo",
    role: "Operaciones",
    email: "andre@hygge.pe",
    color: "#A85B5B",
    isAdmin: false,
    isCEO: false,
    allowedSpaces: ["proyectos", "bam", "finanzas", "legal"],
  },
  {
    id: "jmg",
    username: "galup",
    firstName: "Juan Miguel",
    lastName: "Galup",
    role: "Legal",
    email: "galup@hygge.pe",
    color: "#1E2A4A",
    isAdmin: false,
    isCEO: false,
    allowedSpaces: ["legal", "proyectos"],
  },
];

// Cambialos a algo más seguro en producción · password mínimo recomendable
// Cualquier credencial cambia editando este archivo y haciendo push de nuevo
