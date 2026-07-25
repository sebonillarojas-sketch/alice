// drive.js — referencias a Google Drive de Hygge (IDs de carpetas/archivos).
// Datos estáticos; Alicia/WikiHygge los usan para linkear docs reales por proyecto.

export const KNOWN_DRIVE_REFS = {
  // Folders raíz
  "BAM root": "1ZV54PfOLzrGRpw4nz8nIkA6oESdtTHIj",
  "HYGGE GRUPPE": "15ZcobnMQ7NTf_u6UmFMiJsb4c8liQquy",
  "Brand Hygge Bronca": "1TZvxsncwDME0qFP3jJZq3mMpAGjG_ZvA",
  "eecc HYGGE": "18UWqbv-rNpJlsY5Ur_YdeqzFBnuM40pk",
  // Diseño por proyecto
  "Del Castillo · Diseño": "1FZ52l9N69NM6TJ5FlPD08HLogdWlo3m5",
  "Paula Ugarriza · Diseño": "1qrt9odgJ9BUOQ5kdNJQ0pE3JE8ou-fRL",
  "De la Torre · Diseño": "1dGlGY6vWpD5ODS12d6GFjnhyP7lei79o",
  "Larco 1036 · Supervisión": "1NLCOo1bfaeKHJyNWfJaluMK0YGYzrOMY",
  "Estudio BAM": "1-FWqI1EaKtX6zViJsGzcApuHOXDZVP-8",
  // FC (Fit Capital) por proyecto
  "FC · Del Castillo": "1jeSZJLyUfsrsxeOImlDV8kxqHeds6F3w",
  "FC · Paula Ugarriza": "1v1cDIR0FMXZu15YBXOuggKiTibtmrgxr",
  "FC · De la Torre": "1zho6xqpXHac2p4VAmVJF8iSH4eOOtVXJ",
};

export const KNOWN_DRIVE_FILES = {
  "Edificio Legendre · ventas": "12cSCNNGz6QuREEuIVAk6NcVrvNb4eomM",
  "Cash flow Hygge 2026": "1KUp7z4OtuQ24EXZvTdsLf0JQP8dQk1Jn4v3Md3a63Bo",
  "Cap Table investors": "1eR98gF1wpxTlGNBY6qeovxSsykrkauogaYOv07cIQkY",
  "ACUERDO PRIVADO Libre 5": "1fToxXb332tY23TGHweCJuMtjZiE9t8iJ",
};

export const PROJECT_DRIVE_MAP = {
  "dc01": { design: "1FZ52l9N69NM6TJ5FlPD08HLogdWlo3m5", fc: "1jeSZJLyUfsrsxeOImlDV8kxqHeds6F3w", projectName: "Del Castillo" },
  "pu01": { design: "1qrt9odgJ9BUOQ5kdNJQ0pE3JE8ou-fRL", fc: "1v1cDIR0FMXZu15YBXOuggKiTibtmrgxr", projectName: "Paula Ugarriza" },
  "tg01": { design: "1dGlGY6vWpD5ODS12d6GFjnhyP7lei79o", fc: "1zho6xqpXHac2p4VAmVJF8iSH4eOOtVXJ", projectName: "De la Torre" },
  "l36":  { design: "1NLCOo1bfaeKHJyNWfJaluMK0YGYzrOMY", projectName: "Larco 1036" },
};
