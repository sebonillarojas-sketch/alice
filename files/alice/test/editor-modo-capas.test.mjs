// El editor tiene dos lenguajes de dibujo y cinco capas. Como los tests no montan React,
// se verifica sobre el archivo: que el estado exista, que cada capa filtre lo suyo, y que
// el modo esquemático use los colores de tipología de Cabida y no invente otros.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ed = readFileSync(new URL("../src/modules/planos/EditorPlanos.jsx", import.meta.url), "utf8");

test("existen el modo de dibujo y las cinco capas", () => {
  assert.match(ed, /const \[modo, setModo\] = useState\("tecnico"\)/, "arranca en técnico");
  for (const capa of ["divisiones", "puertas", "ventanas", "muebles", "flujos"]) {
    assert.ok(ed.includes(`${capa}:`), `falta la capa "${capa}"`);
  }
  assert.match(ed, /flujos: false/, "los flujos arrancan apagados: en una planta no se dibujan");
});

test("cada capa filtra lo suyo en el lienzo", () => {
  assert.match(ed, /v\.tipo === "ventana" \? capas\.ventanas : capas\.puertas/,
    "puertas y ventanas se filtran por separado");
  assert.match(ed, /\(capas\.muebles \? muebles : \[\]\)/, "el mobiliario se filtra");
  assert.match(ed, /if \(!capas\.divisiones\) return false/, "las divisiones se filtran");
  assert.match(ed, /capas\.flujos && rooms\.length/, "los flujos solo se calculan si se piden");
});

test("el esquemático usa los colores de tipología de Cabida", () => {
  // los mismos hex que EsquemaPlanta.jsx: si divergen, los dos módulos dibujan distinto
  const cab = readFileSync(new URL("../src/modules/cabida/EsquemaPlanta.jsx", import.meta.url), "utf8");
  const deCabida = cab.match(/const TIP_COLOR = \{([^}]+)\}/)[1];
  for (const hex of deCabida.match(/#[0-9A-Fa-f]{6}/g)) {
    assert.ok(ed.includes(hex), `el editor no usa ${hex}, que Cabida sí: los dos dibujos divergirían`);
  }
});

test("en esquemático el muro perimetral no se redibuja", () => {
  // el borde del bloque de tipología ya lo marca; repetirlo lo engrosa al doble
  assert.match(ed, /\["fachada", "medianera", "entre_unidades", "fachada_patio"\]\.includes\(m\.clase\)/);
});

test("el motor de flujos y el ajuste de vanos llegan al editor", () => {
  assert.match(ed, /import \{[^}]*construirFlujos[^}]*\} from "\.\/vanos\.js"/);
  assert.match(ed, /ajustarVanos\(vanosDerivados, murosDerivados, items, \{ rooms \}\)/,
    "el ajuste tiene que recibir los ambientes o no puede evitar que el barrido cruce un muro");
});
