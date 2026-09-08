// Tarea 3, criterio de aceptación #5: "el camino de producción lo usa". En este
// proyecto ya pasó que algo se construyó y no quedó conectado al lienzo real del
// editor (no un componente de prueba). Como EditorPlanos.jsx es JSX y no se levanta con
// node --test (no hay jsdom/RTL en el repo), esta prueba verifica el ARCHIVO REAL que
// monta la app — mismo patrón que ya usa editor-una-puerta.test.mjs — en vez de
// reimplementar la lógica en un componente aparte que nadie renderiza.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ed = readFileSync(new URL("../src/modules/planos/EditorPlanos.jsx", import.meta.url), "utf8");

test("el editor importa el grafo de muros/vanos derivado, no lo reinventa", () => {
  assert.match(ed, /from "\.\/muros\.js"/, "debe importar construirMuros");
  assert.match(ed, /construirMuros/);
  assert.match(ed, /from "\.\/vanos\.js"/, "debe importar construirVanos");
  assert.match(ed, /construirVanos/);
  assert.match(ed, /from "\.\/muroDibujo\.js"/, "debe usar los helpers de dibujo compartidos");
});

test("el lienzo dibuja estructura.muros (derivados), no ya el contorno de cada ambiente", () => {
  assert.match(ed, /estructura\.muros/, "el render debe recorrer los muros derivados");
  assert.match(ed, /muroEsVisible/, '"sin_muro" debe filtrarse antes de dibujar');
  // La técnica vieja (dedupe por redondeo de coordenadas de CADA polígono de ambiente)
  // no debe reaparecer: si vuelve, es que alguien revirtió el cambio real por uno más
  // fácil de escribir pero que no clasifica ni funde de verdad.
  assert.ok(!ed.includes("Math.round(n / 0.1) * 0.1"), "no debe reaparecer el dedupe manual por redondeo");
});

test("los polígonos de ambiente ya no llevan trazo de contorno (solo relleno; terraza es la única excepción declarada)", () => {
  const m = ed.match(/\/\* ambientes: SOLO relleno[\s\S]{0,700}/);
  assert.ok(m, "debe existir el bloque de relleno de ambientes");
  assert.match(m[0], /stroke=\{terraza \? C\.ink : "none"\}/, "el contorno normal debe ser \"none\"; terraza sigue con su borde punteado declarado");
});

test("los vanos derivados se dibujan con el símbolo existente, posicionado por resolverVano (vía simboloDeVano)", () => {
  assert.match(ed, /estructura\.vanos\.map/);
  assert.match(ed, /simboloDeVano\(/);
  assert.match(ed, /<Simbolo[^>]*it=\{\{\s*ref: s\.ref/, "debe pasar el resultado de simboloDeVano directo al símbolo, sin recalcular la posición");
});

test("los items de categoría abertura quedan obsoletos: ya no se dibujan por su cuenta, pero no se borran de items", () => {
  assert.ok(!ed.includes('aberturas.map((t) => {'), "no debe quedar el render viejo de items-abertura");
  assert.match(ed, /aberturasObsoletas/, "debe existir el aviso de migración §10");
  assert.match(ed, /useState\(seedAcceptedFloor \? \[\] : \(P\.items \|\| \[\]\)\)/, "items (mobiliario) sigue viniendo tal cual del proyecto — no se filtra ni se borra");
});

test("el recálculo del grafo se congela durante el arrastre de geometría (no recalcula por cuadro)", () => {
  assert.match(ed, /roomsForWalls/, "el grafo debe recalcularse sobre una copia estable, no sobre `rooms` en vivo");
  assert.match(ed, /draggingGeom/);
  // debe frenarse en los tres arrastres que cambian geometría de ambientes
  assert.match(ed, /kind: "vertex"[\s\S]{0,80}setDraggingGeom\(true\)/);
  assert.match(ed, /kind: "room", roomIdx: inside[\s\S]{0,200}setDraggingGeom\(true\)/);
  assert.match(ed, /setDraggingGeom\(false\)/, "debe liberarse al soltar (onUp)");
});

test("el editor monta sin ambientes: nada de lo nuevo asume selId/rooms/estructura no vacíos sin guardar antes", () => {
  // regresión del incidente reportado: un render leyó el ambiente seleccionado sin
  // guardar el caso "no hay ninguno". Los accesos nuevos de esta tarea (estructura.*,
  // murosById, aberturasObsoletas) deben poder evaluarse con rooms=[] e items=[]: eso lo
  // fijan los tests de construirMuros/construirVanos con rooms=[] (ver muros.test.mjs y
  // vanos.test.mjs) más los de simboloDeVano con muro/vano null (muros-dibujo.test.mjs).
  // Acá solo se fija que el punto de entrada al grafo sigue siendo `rooms` del estado
  // (nunca `sel.pts` ni un ambiente asumido) y que el filtro de vano no asume `m` existe.
  assert.match(ed, /const \[roomsForWalls, setRoomsForWalls\] = useState\(rooms\)/);
  assert.match(ed, /if \(!m\) return null;/, "el render de vanos no debe asumir que el muro referenciado existe");
});
