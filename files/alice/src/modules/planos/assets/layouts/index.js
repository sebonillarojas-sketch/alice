// índice de las láminas dimensionadas de referencia (dimensions.com, licencia Pro).
// `url` = SVG completo (con cotas) para insertar como fondo · `thumb` = versión limpia
// (sin capas de cotas ni fondo) para la miniatura del panel.

const full = import.meta.glob("./{bathrooms,dining,living,kitchen,bedroom}/*.svg", { eager: true, query: "?url", import: "default" });
const thumbs = import.meta.glob("./thumbs/*/*.png", { eager: true, query: "?url", import: "default" });

const AMBIENTE_LABEL = { bathrooms: "baños", dining: "comedores", living: "salas", kitchen: "cocinas", bedroom: "dormitorios" };

const thumbFor = (room, file) => thumbs[`./thumbs/${room}/${file.replace(/\.svg$/, ".png")}`] || full[`./${room}/${file}`];

export const LAYOUTS = {};
for (const [k, url] of Object.entries(full)) {
  const [, room, file] = k.split("/");            // ['.', 'bathrooms', 'Half-1-Wall.svg']
  (LAYOUTS[room] ||= []).push({ name: file.replace(/\.svg$/, "").replace(/-/g, " ").toLowerCase(), url, thumb: thumbFor(room, file) });
}
for (const r of Object.keys(LAYOUTS)) LAYOUTS[r].sort((a, b) => a.name.localeCompare(b.name));

export const ROOMS = Object.keys(LAYOUTS).map((k) => ({ key: k, label: AMBIENTE_LABEL[k] || k, n: LAYOUTS[k].length }));
export const TOTAL = Object.values(LAYOUTS).reduce((a, l) => a + l.length, 0);
