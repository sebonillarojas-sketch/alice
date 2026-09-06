// Extremo a extremo del nuevo contrato: Tweedledum ya no devuelve polígonos, devuelve
// un parti aproximado (la decisión de zonificación) que ALICE normaliza y tesela. Este
// test es el que define el éxito del cambio: un parti que NO cierra (sus anchos de unidad
// no suman el frente disponible) tiene que producir polígonos que pasen
// validateFloorProposal con CERO hallazgos geométricos, sobre la misma huella irregular
// (cóncava) que fallback-clipped.test.mjs usa para el camino determinístico.
import test from "node:test";
import assert from "node:assert/strict";
import { materializeFloorProposal } from "../src/modules/cabida/floorProposal.js";
import { validateFloorProposal } from "../../../alicia-brain/src/architecture/floor-validation.js";
import { CORE_LONGITUD_DEFAULT } from "../src/modules/planos/partiNormalizar.js";

// misma huella irregular que files/alice/test/fallback-clipped.test.mjs (~61% de la
// envolvente de un lote real, con una concavidad en la fachada).
const HUELLA = [
  { x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 5 }, { x: 22, y: 9 },
  { x: 22, y: 14.5 }, { x: 6, y: 14.5 }, { x: 6, y: 9 }, { x: 0, y: 5 },
];
const VERSION = "cabida_test_v1";

const GEOMETRIC_CODES = new Set([
  "self_intersecting_polygon", "degenerate_polygon", "outside_buildable_footprint",
  "incomplete_partition", "polygon_overlap",
]);

const validar = (propuesta) => validateFloorProposal(propuesta, {
  buildableFootprint: HUELLA.map((p) => [p.x, p.y]),
  sourceCabidaVersionId: VERSION,
});

// área de un polígono [[x,y],...] por shoelace — sirve para medir la profundidad real de
// una pieza sin asumir cómo orientedFrame roto/trasladó las coordenadas al mundo.
const area = (polygon) => Math.abs(polygon.reduce((sum, [x1, y1], i) => {
  const [x2, y2] = polygon[(i + 1) % polygon.length];
  return sum + (x1 * y2 - x2 * y1);
}, 0)) / 2;

const rectValidar = (propuesta, rect) => validateFloorProposal(propuesta, {
  buildableFootprint: rect.map((p) => [p.x, p.y]),
  sourceCabidaVersionId: VERSION,
});

test("un parti aproximado que no cierra tesela sin hallazgos geométricos sobre la huella irregular", () => {
  // frente real de esta huella (borde 0): 31 m. El parti de Tweedledum es deliberadamente
  // aproximado: cree un core de ~5 m y tres unidades cuyos anchos suman 19.4 m — muy lejos
  // de los ~26 m disponibles (31 − 5). Nunca tiene que cerrar: ALICE prorratea.
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 9, ancho: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 3, banos: 2 },
      { unitRef: "u2", orden: 2, ancho: 6, dormitorios: 2, banos: 2 },
      { unitRef: "u3", orden: 3, ancho: 6.4, dormitorios: 1, banos: 1 },
    ],
  };
  // control: efectivamente no cierra contra el frente real de esta huella (31 m)
  const sumaAnchos = parti.core.ancho + parti.units.reduce((s, u) => s + u.ancho, 0);
  assert.equal(sumaAnchos, 24.4);
  assert.notEqual(sumaAnchos, 31);

  const propuesta = materializeFloorProposal({
    parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION, summary: "Parti de prueba",
  });

  assert.ok(propuesta.floor.polygons.length > 0, "debe emitir polígonos");
  const unidades = propuesta.floor.polygons.filter((p) => p.role === "unidad");
  assert.equal(unidades.length, 3, "las 3 unidades del parti deben sobrevivir al recorte");
  for (const u of unidades) {
    assert.ok(u.unitRef, `${u.name} perdió su unitRef`);
    assert.ok(u.unitProgram?.dormitorios >= 1, `${u.name} perdió su programa`);
  }

  const resultado = validar(propuesta);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});

test("crujía doble sin banda declarada mantiene el comportamiento de siempre (banda 2 queda como vacío)", () => {
  // ninguna unidad declara `banda`: tiene que comportarse EXACTAMENTE como antes de
  // agregar el reparto por banda — todas las unidades al frente, el fondo como vacío.
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 6, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const resultado = validar(propuesta);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);

  const unidades = propuesta.floor.polygons.filter((p) => p.role === "unidad");
  assert.deepEqual(unidades.map((u) => u.unitRef).sort(), ["u1", "u2"], "las dos unidades siguen yendo al frente");
  const vacios = propuesta.floor.polygons.filter((p) => p.role === "void");
  assert.deepEqual(vacios.map((v) => v.polygonId), ["banda-2-void"], "el fondo sigue quedando como vacío de servicio");
  assert.ok(
    propuesta.tradeoffs.some((t) => t.includes("crujía doble simplificada")),
    "debe anotar en tradeoffs que la crujía doble quedó simplificada",
  );
});

test("crujía doble con banda 1 y banda 2 reparte unidades en las dos bandas sin dejar ningún vacío", () => {
  // anchos aproximados que NO cierran en ninguna banda: frente disponible (31 − 5 = 26 m)
  // vs. banda 1 (7+6=13 m) y banda 2 (8+5=13 m). Ninguna suma 26: nunca tiene que cerrar.
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 2, banos: 1, banda: 1 },
      { unitRef: "u2", orden: 2, ancho: 6, dormitorios: 1, banos: 1, banda: 1 },
      { unitRef: "u3", orden: 3, ancho: 8, dormitorios: 2, banos: 1, banda: 2 },
      { unitRef: "u4", orden: 4, ancho: 5, dormitorios: 1, banos: 1, banda: 2 },
    ],
  };
  const sumaBanda1 = 7 + 6;
  const sumaBanda2 = 8 + 5;
  const disponible = 31 - parti.core.ancho;
  assert.notEqual(sumaBanda1, disponible);
  assert.notEqual(sumaBanda2, disponible);

  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const vacios = propuesta.floor.polygons.filter((p) => p.role === "void");
  assert.deepEqual(vacios, [], "con las dos bandas ocupadas no debe quedar ningún vacío");

  const unidades = propuesta.floor.polygons.filter((p) => p.role === "unidad");
  assert.deepEqual(unidades.map((u) => u.unitRef).sort(), ["u1", "u2", "u3", "u4"], "las 4 unidades deben sobrevivir, repartidas en las dos bandas");

  // ninguna pieza (unidad, core o circulación) se solapa con otra: ni entre bandas ni
  // contra el núcleo. polygon_overlap es exactamente el código que detecta esto.
  const resultado = validar(propuesta);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);
  assert.deepEqual(resultado.findings.filter((f) => f.code === "polygon_overlap"), [], "ninguna banda puede solaparse con la otra ni con el núcleo");
});

test("materializeFloorProposal sigue funcionando sobre la huella rectangular", () => {
  const rect = [{ x: 0, y: 0 }, { x: 31, y: 0 }, { x: 31, y: 14.5 }, { x: 0, y: 14.5 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    core: { posicion: 10, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 9, dormitorios: 2, banos: 2 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const resultado = validateFloorProposal(propuesta, { buildableFootprint: rect.map((p) => [p.x, p.y]), sourceCabidaVersionId: VERSION });
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, []);
});

// --- Profundidad del núcleo (core.longitud) ------------------------------------------
// El núcleo ya no atraviesa el bloque entero por defecto: penetra `longitud` metros desde
// el frente, y lo que queda detrás se cierra como `circulacion`, nunca como hueco.

test("el core respeta su longitud: no atraviesa el bloque entero (22 m), y detrás se cierra como circulación hasta el fondo de su banda", () => {
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 22 }, { x: 0, y: 22 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4, longitud: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 8, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const core = propuesta.floor.polygons.find((p) => p.role === "core");
  assert.ok(core, "debe emitir un core");
  const areaCore = area(core.polygon);
  // core.ancho no se prorratea (solo las unidades): sigue siendo 4 m exactos.
  assert.ok(Math.abs(areaCore - 4 * 5) < 1e-6, `el core debe medir 5 m de fondo (área 20), dio ${areaCore}`);
  assert.ok(areaCore < 4 * 22 - 1e-6, "el core NO debe atravesar el bloque entero (22 m de fondo)");

  const circulacionNucleo = propuesta.floor.polygons.find((p) => p.polygonId === "circulacion-nucleo");
  assert.ok(circulacionNucleo, "debe emitir una pieza de circulación detrás del núcleo");
  assert.equal(circulacionNucleo.role, "circulacion");
  // bandDepth (crujía simple) = 22 − 1.6 = 20.4; corridorV1 = min(20.4+1.6, 22) = 22:
  // la circulación detrás del núcleo completa hasta el fondo del lote (17 m), no se corta a mitad de nada.
  const areaHueco = area(circulacionNucleo.polygon);
  assert.ok(Math.abs(areaHueco - 4 * 17) < 1e-6, `la circulación detrás del núcleo debe completar hasta el fondo de su banda (área 68), dio ${areaHueco}`);

  const resultado = rectValidar(propuesta, rect);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});

test("sin longitud declarada, el core cae al default acotado a la banda del frente (nunca al fondo entero) y no genera hallazgos geométricos", () => {
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 22 }, { x: 0, y: 22 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 8, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const core = propuesta.floor.polygons.find((p) => p.role === "core");
  const areaCore = area(core.polygon);
  assert.ok(
    Math.abs(areaCore - 4 * CORE_LONGITUD_DEFAULT) < 1e-6,
    `el default de longitud debe ser ${CORE_LONGITUD_DEFAULT} m (ancho 4 → área ${4 * CORE_LONGITUD_DEFAULT}), dio ${areaCore}`,
  );

  const resultado = rectValidar(propuesta, rect);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `cero hallazgos geométricos: ${JSON.stringify(geometricos)}`);

  // el default también se acota: en una banda más angosta que el default (5 m), no la
  // puede exceder — fondo 6, corredor 1.6 → bandDepth = 4.4 < 5.
  const rectAngosto = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 6 }, { x: 0, y: 6 }];
  const partiAngosto = { ...parti };
  const propuestaAngosta = materializeFloorProposal({ parti: partiAngosto, footprint: rectAngosto, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const coreAngosto = propuestaAngosta.floor.polygons.find((p) => p.role === "core");
  const areaCoreAngosto = area(coreAngosto.polygon);
  const bandDepthAngosta = 6 - 1.6; // 4.4
  assert.ok(
    Math.abs(areaCoreAngosto - 4 * bandDepthAngosta) < 1e-6,
    `en una banda de ${bandDepthAngosta} m, el default no puede exceder la banda: esperada área ${4 * bandDepthAngosta}, dio ${areaCoreAngosto}`,
  );
  const resultadoAngosto = rectValidar(propuestaAngosta, rectAngosto);
  const geometricosAngosto = resultadoAngosto.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricosAngosto, [], `cero hallazgos geométricos (banda angosta): ${JSON.stringify(geometricosAngosto)}`);
});

test("crujía doble: si la longitud del núcleo no supera la banda del frente, la banda del fondo aprovecha el frente completo (el core no la interrumpe)", () => {
  const rect = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 16 }, { x: 0, y: 16 }];
  const bandDepth = (16 - 1.5) / 2; // 7.25
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 5, longitud: 4 }, // 4 <= bandDepth (7.25): no la supera
    units: [
      { unitRef: "u1", orden: 1, ancho: 12, dormitorios: 2, banos: 1, banda: 1 },
      { unitRef: "u2", orden: 2, ancho: 13, dormitorios: 2, banos: 1, banda: 1 },
      { unitRef: "u3", orden: 3, ancho: 25, dormitorios: 3, banos: 2, banda: 2 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const u3 = propuesta.floor.polygons.find((p) => p.unitRef === "u3");
  assert.ok(u3, "u3 (única unidad de la banda del fondo) debe sobrevivir");
  const areaU3 = area(u3.polygon);
  assert.ok(
    Math.abs(areaU3 - 30 * bandDepth) < 1e-6,
    `u3 debe ocupar el frente completo de su banda (30 m × ${bandDepth} m = ${30 * bandDepth}), dio ${areaU3}`,
  );
  // ningún hueco de fila debería hacer falta: la unidad única ya llena el frente completo.
  assert.ok(!propuesta.floor.polygons.some((p) => p.polygonId?.startsWith("banda-2-hueco")));

  const resultado = rectValidar(propuesta, rect);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});

// --- Núcleo retirado del frente (core.distanciaAlFrente) -----------------------------
// El dueño del producto: "el núcleo lo debe determinar él, debe pensar". Un núcleo
// pegado al frente se come la fachada que se vende; distanciaAlFrente > 0 lo retira
// hacia adentro. El tramo que queda entre el frente y el núcleo nunca puede quedar sin
// asignar — ya hubo un bug de producción de suelo sin asignar y no puede volver.

test("el núcleo retirado (distanciaAlFrente:4) empieza a 4 m del frente y mide 5 m; el tramo de adelante queda asignado, nunca vacío", () => {
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 22.35 }, { x: 0, y: 22.35 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4, longitud: 5, distanciaAlFrente: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 8, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const core = propuesta.floor.polygons.find((p) => p.role === "core");
  assert.ok(core, "debe emitir un core");
  const areaCore = area(core.polygon);
  assert.ok(Math.abs(areaCore - 4 * 5) < 1e-6, `el core debe medir 4×5 (área 20), dio ${areaCore}`);
  // el core arranca a 4 m del frente: el punto más cercano al frente de su polígono
  // (menor "y", porque frontIdx:0 en este rectángulo mapea v directo a y) está en 4, no en 0.
  const vMinCore = Math.min(...core.polygon.map(([, y]) => y));
  assert.ok(Math.abs(vMinCore - 4) < 1e-6, `el core debe empezar a 4 m del frente, arrancó en ${vMinCore}`);

  // el tramo de los primeros 4 m, en el ancho del núcleo, tiene que estar asignado — no
  // puede haber ningún hueco entre v=0 y v=4 en u=[8,12].
  const frenteNucleo = propuesta.floor.polygons.find((p) => p.polygonId === "circulacion-nucleo-frente");
  assert.ok(frenteNucleo, "debe emitir una pieza asignada delante del núcleo retirado");
  assert.equal(frenteNucleo.role, "circulacion");
  const areaFrenteNucleo = area(frenteNucleo.polygon);
  assert.ok(Math.abs(areaFrenteNucleo - 4 * 4) < 1e-6, `el tramo de adelante debe medir 4×4 (área 16), dio ${areaFrenteNucleo}`);

  // cero suelo sin asignar: la suma de áreas de los polígonos debe igualar el área de la huella.
  const areaHuella = area(rect.map((p) => [p.x, p.y]));
  const areaTotal = propuesta.floor.polygons.reduce((sum, p) => sum + area(p.polygon), 0);
  assert.ok(Math.abs(areaTotal - areaHuella) < 1e-6, `las piezas deben cubrir toda la huella (${areaHuella}), dieron ${areaTotal}`);

  const resultado = rectValidar(propuesta, rect);
  assert.equal(resultado.findings.length, 0, `validateFloorProposal debe dar cero hallazgos: ${JSON.stringify(resultado.findings)}`);
});

test("distanciaAlFrente:0 o ausente se comporta EXACTAMENTE como antes de la Tarea (compatibilidad)", () => {
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 22 }, { x: 0, y: 22 }];
  const partiSinDistancia = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4, longitud: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 8, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  const partiConCero = { ...partiSinDistancia, core: { ...partiSinDistancia.core, distanciaAlFrente: 0 } };

  const propuestaSinDistancia = materializeFloorProposal({ parti: partiSinDistancia, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const propuestaConCero = materializeFloorProposal({ parti: partiConCero, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });

  assert.deepEqual(propuestaConCero.floor.polygons, propuestaSinDistancia.floor.polygons, "distanciaAlFrente:0 explícita debe dar exactamente los mismos polígonos que omitirla");
  // ni ausente ni 0 generan una pieza "delante del núcleo": el núcleo sigue pegado al frente.
  assert.ok(!propuestaSinDistancia.floor.polygons.some((p) => p.polygonId === "circulacion-nucleo-frente"));
});

test("un parti sin longitud produce un tradeoff que dice explícitamente que se usó el default", () => {
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 22 }, { x: 0, y: 22 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 8, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });
  assert.ok(
    propuesta.tradeoffs.some((t) => t.includes("profundidad del núcleo no especificada por el agente") && t.includes("por defecto")),
    `debe anotar el default aplicado en tradeoffs: ${JSON.stringify(propuesta.tradeoffs)}`,
  );
});

test("crujía doble: el núcleo penetra ambas bandas y una sola unidad en banda 2 no deja el otro lado del core sin polígono", () => {
  const rect = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 16 }, { x: 0, y: 16 }];
  const bandDepth = (16 - 1.5) / 2; // 7.25
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 5, longitud: 10 }, // 10 > bandDepth (7.25): SÍ la supera
    units: [
      { unitRef: "u1", orden: 1, ancho: 12, dormitorios: 2, banos: 1, banda: 1 },
      { unitRef: "u2", orden: 2, ancho: 13, dormitorios: 2, banos: 1, banda: 1 },
      { unitRef: "u3", orden: 3, ancho: 8, dormitorios: 2, banos: 1, banda: 2 },
    ],
  };
  assert.ok(parti.core.longitud > bandDepth, "control: este test necesita que el núcleo SÍ penetre la banda del fondo");

  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const u3 = propuesta.floor.polygons.find((p) => p.unitRef === "u3");
  assert.ok(u3, "u3 debe sobrevivir");
  // u3 es la única unidad de banda 2 y cae entera a un lado del core: el otro lado (un
  // tramo con ancho real) no puede quedar sin ningún polígono — antes era el bug de
  // producción (franja blanca en el lote de 538 m²).
  const huecosBanda2 = propuesta.floor.polygons.filter((p) => p.polygonId?.startsWith("banda-2-hueco"));
  assert.ok(huecosBanda2.length > 0, "el segmento del otro lado del core debe salir como circulación, no quedar vacío");
  huecosBanda2.forEach((p) => assert.equal(p.role, "circulacion"));

  const resultado = rectValidar(propuesta, rect);
  assert.deepEqual(resultado.findings.filter((f) => f.code === "incomplete_partition"), [], "el hueco detrás del core tiene que estar siempre asignado");
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `cero hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});
