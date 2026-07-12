// ─── HYGGE OS · CREDENCIALES MVP FRONT-END ──────────────────────────────────
//
// ⚠️ AVISO DE SEGURIDAD ⚠️
// Esto es auth FRONT-END temporal para el MVP. NO es seguro para producción real:
//   - Las contraseñas están en plaintext en el bundle JS (cualquiera con DevTools las ve)
//   - No hay verificación server-side
//   - No hay tokens, no hay revocación, no hay rate-limiting
//
// SIRVE COMO: gate básico para que la URL pública no esté abierta al mundo
// NO SIRVE COMO: protección real de datos sensibles
//
// PRÓXIMO PASO REAL: migrar a Supabase Auth o Clerk (ver README.md)
//

// allowedSpaces: null = acceso a todos los spaces
// allowedSpaces: [...ids] = solo esos spaces (+ sus sub-spaces)
// isCEO: solo Sebastián puede ver todos los chats de Alicia
export const USERS = [
  {
    id: "sb",
    username: "sebastian",
    password: "hygge2026",
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
    password: "hygge2026",
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
    password: "hygge2026",
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
    password: "hygge2026",
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
    password: "hygge2026",
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
    password: "hygge2026",
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
    password: "hygge2026",
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
