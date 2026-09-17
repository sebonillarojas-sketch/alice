import { test } from "node:test";
import assert from "node:assert/strict";
import { armarDossier } from "../src/mica/dossier.js";

const BASE = {
  telefono: "+51987654321",
  nombre: "Camila",
  proyecto: "OLVR-01",
  temperatura: "hot",
  evidencia: "me pasas los planos y precios?",
  persona: {
    hogar: { valor: "pareja + bebé en camino", cita: "somos 2 y viene un bebé" },
    prioridad: { valor: "habitaciones", cita: "más espacio en las habitaciones" },
  },
};

test("el dossier abre con lo único que José necesita para escribir: quién y por dónde", () => {
  const d = armarDossier(BASE);
  assert.match(d, /Camila/);
  assert.match(d, /\+51987654321/);
  assert.match(d, /OLVR-01/);
});

test("cada dato va con la frase textual — José tiene que poder verificarlo, no creerme", () => {
  const d = armarDossier(BASE);
  assert.match(d, /somos 2 y viene un bebé/);
  assert.match(d, /más espacio en las habitaciones/);
});

test("lo que disparó el handoff va textual, porque es el momento de mayor intención", () => {
  assert.match(armarDossier(BASE), /me pasas los planos y precios\?/);
});

test("un buyer persona vacío no se maquilla: se dice que no se sabe", () => {
  const d = armarDossier({ ...BASE, persona: {} });
  assert.match(d, /no alcanzó a contar|sin datos/i);
  assert.doesNotMatch(d, /undefined|null|\[object/);
});

test("sin nombre, no inventa uno", () => {
  const d = armarDossier({ ...BASE, nombre: null });
  assert.doesNotMatch(d, /undefined|null/);
  assert.match(d, /\+51987654321/);
});

test("entra en un WhatsApp: no se le manda a José una pared de texto", () => {
  const largo = { ...BASE, persona: Object.fromEntries(
    ["motivacion","hogar","metraje","tipologia","prioridad","plazo"].map(k =>
      [k, { valor: "x".repeat(200), cita: "y".repeat(200) }]) ) };
  assert.ok(armarDossier(largo).length <= 1400, "el dossier tiene que entrar en un mensaje");
});

test("un metraje exacto se dice una sola vez, no '90 a 90'", () => {
  const d = armarDossier({ ...BASE, persona: { metraje: { min: 90, max: 90, cita: "pensamos en unos 90 m2" } } });
  assert.match(d, /Metraje: 90 m2/);
  assert.doesNotMatch(d, /90 a 90/);
});

test("un metraje de rango sí se dice como rango", () => {
  const d = armarDossier({ ...BASE, persona: { metraje: { min: 80, max: 100, cita: "entre 80 y 100" } } });
  assert.match(d, /Metraje: 80 a 100 m2/);
});
