// theme.js — tokens de marca de ALICE (fuente única).
//
// Antes este objeto `C` estaba duplicado dentro de HyggeOS.jsx y de cada módulo.
// Los módulos se irán migrando a importar de acá para tener un solo design system.
// Estilo editorial: crema + tinta, acentos navy/cobalto, radios 2-4px.

export const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", surface: "#FAF8F2",
  ink: "#0A0B0F", inkSoft: "#3A3D45", muted: "#8C8F96", mutedSoft: "#B5B3AC",
  line: "#D5D1C5", lineSoft: "#E4E0D4",
  navy: "#1E2A4A", cobalt: "#3D52D5", sky: "#B8C8E5",
  lavender: "#A89BD9", ochre: "#C2A45A", brick: "#A85B5B", green: "#5F8A6A",
};

export const toneMap = {
  navy: C.navy, cobalt: C.cobalt, lavender: C.lavender,
  ochre: C.ochre, brick: C.brick, muted: C.muted, green: C.green,
};

export const SPACE_COLORS = [C.cobalt, C.lavender, C.ochre, C.green, C.brick, C.sky, C.navy];
