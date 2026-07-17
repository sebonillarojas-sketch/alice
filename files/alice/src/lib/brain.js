// URL única del backend de Alicia (alicia-brain) para TODO el ERP.
// - Prod (build de Netlify): fallback a aliceai.bam.pe — no requiere env.
// - Dev local: files/alice/.env.development la apunta a localhost:3001
//   (el brain corriendo en esta máquina, con Dropbox local).
// No importar nada acá: supabase.js la usa desde su interceptor de fetch.
export const ALICIA_URL = import.meta.env.VITE_ALICIA_URL || "https://aliceai.bam.pe";
