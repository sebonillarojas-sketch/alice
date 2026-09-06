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

  // el núcleo ya no es una única caja: se despieza en escalera/ascensor/hall (todas
  // role:"core") que teselan exactamente el mismo rectángulo — se suma su área.
  const coreParts = propuesta.floor.polygons.filter((p) => p.role === "core");
  assert.ok(coreParts.length > 0, "debe emitir al menos una pieza de core");
  const areaCore = coreParts.reduce((sum, p) => sum + area(p.polygon), 0);
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
  const areaCore = propuesta.floor.polygons.filter((p) => p.role === "core").reduce((sum, p) => sum + area(p.polygon), 0);
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
  const areaCoreAngosto = propuestaAngosta.floor.polygons.filter((p) => p.role === "core").reduce((sum, p) => sum + area(p.polygon), 0);
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

  const coreParts = propuesta.floor.polygons.filter((p) => p.role === "core");
  assert.ok(coreParts.length > 0, "debe emitir al menos una pieza de core");
  const areaCore = coreParts.reduce((sum, p) => sum + area(p.polygon), 0);
  assert.ok(Math.abs(areaCore - 4 * 5) < 1e-6, `el core debe medir 4×5 (área 20), dio ${areaCore}`);
  // el core arranca a 4 m del frente: el punto más cercano al frente de CUALQUIER pieza
  // de core (menor "y", porque frontIdx:0 en este rectángulo mapea v directo a y) está
  // en 4, no en 0.
  const vMinCore = Math.min(...coreParts.flatMap((p) => p.polygon.map(([, y]) => y)));
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

// --- Núcleo de circulación vertical: escalera + ascensor + hall ----------------------
// El núcleo ya no sale como una única caja negra sin nada adentro: se despieza en sus
// componentes normados (escalera en U, ascensor/ducto, hall de descanso y distribución),
// que teselan exactamente el mismo rectángulo que antes ocupaba el bloque único. Sobre la
// misma huella irregular que fallback-clipped.test.mjs usa para el camino determinístico.

test("un núcleo holgado (5×5) se despieza en escalera + ascensor + hall núcleo, sin solape ni hueco", () => {
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 9, ancho: 5, longitud: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 13, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 13, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const nucleo = propuesta.floor.polygons.filter((p) => p.role === "core");
  assert.deepEqual(nucleo.map((p) => p.name).sort(), ["ascensor", "escalera", "hall núcleo"],
    `debe despiezarse en escalera + ascensor + hall núcleo, dio ${JSON.stringify(nucleo.map((p) => p.name))}`);
  nucleo.forEach((p) => {
    assert.equal(p.unitRef, null);
    assert.equal(p.unitProgram, null);
  });

  const areaNucleo = nucleo.reduce((sum, p) => sum + area(p.polygon), 0);
  assert.ok(Math.abs(areaNucleo - 5 * 5) < 1e-6, `las 3 piezas deben sumar exactamente el área del núcleo (25), dio ${areaNucleo}`);

  const escalera = nucleo.find((p) => p.name === "escalera");
  const ascensor = nucleo.find((p) => p.name === "ascensor");
  const bbox = (polygon) => {
    const xs = polygon.map(([x]) => x), ys = polygon.map(([, y]) => y);
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const bEsc = bbox(escalera.polygon), bAsc = bbox(ascensor.polygon);
  assert.ok(Math.min(bEsc.w, bEsc.h) >= 2.40 - 1e-6 && Math.max(bEsc.w, bEsc.h) >= 4.20 - 1e-6,
    `la escalera debe medir al menos 2.40 × 4.20, dio ${JSON.stringify(bEsc)}`);
  assert.ok(Math.min(bAsc.w, bAsc.h) >= 1.60 - 1e-6 && Math.max(bAsc.w, bAsc.h) >= 1.80 - 1e-6,
    `el ascensor debe medir al menos 1.60 × 1.80, dio ${JSON.stringify(bAsc)}`);

  const resultado = validar(propuesta);
  assert.deepEqual(resultado.findings.filter((f) => f.code === "polygon_overlap"), [], "las piezas del núcleo no pueden solaparse entre sí ni con el resto");
  assert.deepEqual(resultado.findings.filter((f) => f.code === "incomplete_partition"), [], "el núcleo no puede dejar área sin asignar");
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `cero hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});

test("un núcleo chico (3×3.5) no se despieza: sale un único core y tradeoffs explica por qué con los números", () => {
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 9, ancho: 3, longitud: 3.5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 13, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 2, ancho: 13, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const nucleo = propuesta.floor.polygons.filter((p) => p.role === "core");
  assert.deepEqual(nucleo.map((p) => p.name), ["core"], "un núcleo que no da para los mínimos debe salir como bloque único, sin despiezar");
  assert.ok(Math.abs(area(nucleo[0].polygon) - 3 * 3.5) < 1e-6);

  assert.ok(
    propuesta.tradeoffs.some((t) => t.includes("3.00")
      && t.includes("3.50")
      && t.includes("no admite escalera")
      && t.includes("2.40")
      && t.includes("4.20")
      && t.includes("1.60")
      && t.includes("1.80")),
    `tradeoffs debe explicar con números por qué no entra: ${JSON.stringify(propuesta.tradeoffs)}`,
  );

  const resultado = validar(propuesta);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `cero hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});

// --- Terrazas por unidad y patios de banda ---------------------------------------------
// Dos figuras nuevas, las dos rectangulares por construcción: una terraza le quita
// profundidad a SU unidad (contra la fachada de su banda) y la ocupa; un patio es una
// ranura vacía intercalada en el orden de una banda. Ambas se emiten role:"void", y tienen
// que llegar limpias a validateFloorProposal — cero hallazgos, no solo los geométricos.

test("una unidad con terraza produce dos rectángulos que juntos ocupan lo que ocupaba la unidad sola (sobre la huella irregular)", () => {
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 9, ancho: 5, longitud: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 13, dormitorios: 2, banos: 1, terraza: 2.5 },
      { unitRef: "u2", orden: 2, ancho: 13, dormitorios: 1, banos: 1 },
    ],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const terraza = propuesta.floor.polygons.find((p) => p.role === "void" && p.name === "terraza");
  assert.ok(terraza, "debe emitir la terraza de u1");
  assert.equal(terraza.unitRef, "u1", "la terraza apunta a su unidad");
  assert.equal(terraza.unitProgram, null);

  const u1 = propuesta.floor.polygons.find((p) => p.role === "unidad" && p.unitRef === "u1");
  assert.ok(u1, "u1 debe seguir existiendo, más corta");

  // terraza + unidad deben sumar exactamente lo que medía u1 SOLA en el mismo lote (la
  // huella es cóncava y recorta la pieza: se compara contra un baseline sin terraza en
  // vez de contra el área bruta del rectángulo, para no asumir que el recorte es simple).
  const partiSinTerraza = { ...parti, units: parti.units.map((u) => ({ ...u, terraza: undefined })) };
  const baseline = materializeFloorProposal({ parti: partiSinTerraza, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });
  const u1Baseline = baseline.floor.polygons.find((p) => p.role === "unidad" && p.unitRef === "u1");
  assert.ok(u1Baseline);

  const sumaAreas = area(terraza.polygon) + area(u1.polygon);
  assert.ok(
    Math.abs(sumaAreas - area(u1Baseline.polygon)) < 1e-6,
    `terraza + unidad deben sumar exactamente lo que medía u1 sola (${area(u1Baseline.polygon)}), dio ${sumaAreas}`,
  );

  const resultado = validar(propuesta);
  assert.deepEqual(resultado.findings, [], `cero hallazgos: ${JSON.stringify(resultado.findings)}`);
});

test("una terraza pedida de más se recorta al mínimo de la unidad (nunca la unidad) y lo reporta en tradeoffs con los números", () => {
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 8.1 }, { x: 0, y: 8.1 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 8, dormitorios: 2, banos: 1, terraza: 3 },
      { unitRef: "u2", orden: 2, ancho: 8, dormitorios: 1, banos: 1 },
    ],
  };
  // bandDepth = 8.1 − 1.6 = 6.5: pedir 3 m de terraza dejaría u1 en 3.5 m (< 4.00), se
  // recorta a 6.5 − 4.00 = 2.5 m.
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const terraza = propuesta.floor.polygons.find((p) => p.role === "void" && p.name === "terraza" && p.unitRef === "u1");
  assert.ok(terraza);
  assert.ok(Math.abs(area(terraza.polygon) - 8 * 2.5) < 1e-6, `la terraza recortada debe medir 8×2.50, dio ${area(terraza.polygon)}`);
  const u1 = propuesta.floor.polygons.find((p) => p.role === "unidad" && p.unitRef === "u1");
  assert.ok(Math.abs(area(u1.polygon) - 8 * 4.0) < 1e-6, `la unidad debe quedar en 8×4.00 (su mínimo), dio ${area(u1.polygon)}`);

  assert.ok(
    propuesta.tradeoffs.some((t) => t.includes("u1") && t.includes("terraza") && t.includes("2.50") && t.includes("3.00")),
    `tradeoffs debe reportar el recorte con los números: ${JSON.stringify(propuesta.tradeoffs)}`,
  );

  const resultado = rectValidar(propuesta, rect);
  assert.deepEqual(resultado.findings, [], `cero hallazgos: ${JSON.stringify(resultado.findings)}`);
});

test("un patio se intercala entre las unidades de su banda con la profundidad completa de la banda (sobre la huella irregular)", () => {
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 2, banos: 1, banda: 1 },
      { unitRef: "u2", orden: 2, ancho: 6, dormitorios: 1, banos: 1, banda: 1 },
      { unitRef: "u3", orden: 3, ancho: 8, dormitorios: 2, banos: 1, banda: 2 },
      { unitRef: "u4", orden: 5, ancho: 5, dormitorios: 1, banos: 1, banda: 2 },
    ],
    patios: [{ banda: 2, orden: 4, ancho: 3 }],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const patio = propuesta.floor.polygons.find((p) => p.role === "void" && p.name === "patio");
  assert.ok(patio, "debe emitir el patio");
  assert.equal(patio.unitRef, null);
  assert.equal(patio.unitProgram, null);

  // bandDepth ((14.5 − 1.5) / 2 = 6.5) es la misma para las dos bandas: el patio debe
  // tomar la profundidad completa de su fila.
  const bandDepth = (14.5 - 1.5) / 2;
  assert.ok(Math.abs(area(patio.polygon) - 3 * bandDepth) < 1e-6, `el patio debe medir 3×${bandDepth}, dio ${area(patio.polygon)}`);

  const unidades = propuesta.floor.polygons.filter((p) => p.role === "unidad");
  assert.deepEqual(unidades.map((u) => u.unitRef).sort(), ["u1", "u2", "u3", "u4"], "las 4 unidades sobreviven junto con el patio");

  const resultado = validar(propuesta);
  assert.deepEqual(resultado.findings, [], `cero hallazgos: ${JSON.stringify(resultado.findings)}`);
});

test("un patio angosto se sube al mínimo (2.10 m) y lo reporta en tradeoffs con los números", () => {
  const rect = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 12 }, { x: 0, y: 12 }];
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 1,
    corredorProfundidad: 1.6,
    core: { posicion: 8, ancho: 4 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 8, dormitorios: 2, banos: 1 },
      { unitRef: "u2", orden: 3, ancho: 8, dormitorios: 1, banos: 1 },
    ],
    patios: [{ banda: 1, orden: 2, ancho: 1 }],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: rect, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const patio = propuesta.floor.polygons.find((p) => p.role === "void" && p.name === "patio");
  assert.ok(patio);
  // bandDepth (crujía simple, fondo 12, corredor 1.6) = 10.4: el patio toma el fondo
  // completo de la banda, no el fondo del lote entero.
  const bandDepth = 12 - 1.6;
  assert.ok(Math.abs(area(patio.polygon) - 2.1 * bandDepth) < 1e-6, `el patio debe medir 2.10×${bandDepth}, dio ${area(patio.polygon)}`);

  assert.ok(
    propuesta.tradeoffs.some((t) => t.includes("patio") && t.includes("2.10") && t.includes("1.00")),
    `tradeoffs debe reportar la elevación al mínimo con los números: ${JSON.stringify(propuesta.tradeoffs)}`,
  );

  const resultado = rectValidar(propuesta, rect);
  assert.deepEqual(resultado.findings, [], `cero hallazgos: ${JSON.stringify(resultado.findings)}`);
});

test("terraza y patio combinados en la misma planta (sobre la huella irregular): cero hallazgos", () => {
  const parti = {
    sourceCabidaVersionId: VERSION,
    crujias: 2,
    corredorProfundidad: 1.5,
    core: { posicion: 9, ancho: 5 },
    units: [
      { unitRef: "u1", orden: 1, ancho: 7, dormitorios: 2, banos: 1, banda: 1, terraza: 2.5 },
      { unitRef: "u2", orden: 2, ancho: 6, dormitorios: 1, banos: 1, banda: 1 },
      { unitRef: "u3", orden: 3, ancho: 8, dormitorios: 2, banos: 1, banda: 2 },
      { unitRef: "u4", orden: 5, ancho: 5, dormitorios: 1, banos: 1, banda: 2 },
    ],
    patios: [{ banda: 2, orden: 4, ancho: 3 }],
  };
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });

  const terraza = propuesta.floor.polygons.find((p) => p.role === "void" && p.name === "terraza" && p.unitRef === "u1");
  const patio = propuesta.floor.polygons.find((p) => p.role === "void" && p.name === "patio");
  assert.ok(terraza, "la terraza de u1 debe sobrevivir junto con el patio");
  assert.ok(patio, "el patio debe sobrevivir junto con la terraza");

  const resultado = validar(propuesta);
  assert.deepEqual(resultado.findings.filter((f) => f.code === "polygon_overlap"), [], "terraza y patio no se solapan con nada");
  assert.deepEqual(resultado.findings, [], `cero hallazgos combinando terraza y patio: ${JSON.stringify(resultado.findings)}`);
});

test("un parti sin terraza ni patios se comporta EXACTAMENTE como antes (compatibilidad)", () => {
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
  const propuesta = materializeFloorProposal({ parti, footprint: HUELLA, frontIdx: 0, sourceCabidaVersionId: VERSION });
  assert.ok(
    propuesta.floor.polygons.every((p) => p.name !== "terraza" && p.name !== "patio"),
    "sin terraza ni patios declarados, ninguna pieza nueva debe aparecer",
  );
  const resultado = validar(propuesta);
  const geometricos = resultado.findings.filter((f) => GEOMETRIC_CODES.has(f.code));
  assert.deepEqual(geometricos, [], `no debe haber hallazgos geométricos: ${JSON.stringify(geometricos)}`);
});
