// motor paramétrico de distribución esquemática
// convierte los números de cabida en geometría de planta típica (todo en metros)

// reparte `total` unidades según mix (%) sin exceder el total
function repartir(total, mix1, mix2) {
  let n1 = Math.round((total * mix1) / 100);
  n1 = Math.min(n1, total);
  let n2 = Math.round((total * mix2) / 100);
  n2 = Math.min(n2, total - n1);
  const n3 = Math.max(0, total - n1 - n2);
  return { n1, n2, n3 };
}

export function computeEsquema({
  terreno, frente, rf = 0, ri = 0, rd = 0, rp = 0,   // retiros: frontal, izquierda, derecha, posterior
  huella, pisos, dptos, mix1, mix2, areaDpto, circulacion,
}) {
  const warns = [];
  const fondo = frente > 0 ? terreno / frente : 0;

  const anchoEdif = Math.max(frente - ri - rd, 0);
  const fondoEdif = anchoEdif > 0 ? huella / anchoEdif : 0;
  const fondoLibre = fondo - rf - fondoEdif - rp;

  if (fondoLibre < -0.05) {
    warns.push("la huella no entra en el lote con estos retiros — reduce retiros, frente o % área libre");
  }
  if (frente > 0 && fondo / frente > 4) {
    warns.push("lote muy profundo (fondo > 4× frente) — revisa el frente ingresado");
  }

  const uPorPiso = Math.max(1, Math.round(dptos / Math.max(pisos, 1)));
  const mix3 = Math.max(0, 100 - mix1 - mix2);

  // áreas por tipología escaladas para que el promedio ponderado del mix = areaDpto
  const ratios = { d1: 0.65, d2: 1.0, d3: 1.35 };
  const wAvg = (mix1 * ratios.d1 + mix2 * ratios.d2 + mix3 * ratios.d3) / 100 || 1;
  const esc = areaDpto / wAvg;
  const areaTip = { "1D": ratios.d1 * esc, "2D": ratios.d2 * esc, "3D": ratios.d3 * esc };

  const { n1, n2, n3 } = repartir(uPorPiso, mix1, mix2);
  // 3D en los extremos (esquinas), 1D junto al core
  const unidades = [
    ...Array(n3).fill("3D"),
    ...Array(n2).fill("2D"),
    ...Array(n1).fill("1D"),
  ].map((tip) => ({ tip, area: areaTip[tip] }));

  // core central de circulación vertical (escalera + ascensor), mínimo 3 m
  const coreW = Math.min(Math.max(3, anchoEdif * 0.1), Math.max(anchoEdif * 0.4, 0.1));
  const coreX = (anchoEdif - coreW) / 2;

  // doble crujía si el edificio es profundo; si no, crujía simple con corredor posterior
  const doble = fondoEdif >= 13;
  const corrH = doble ? 1.8 : 1.5;
  const stripDepth = Math.max(doble ? (fondoEdif - corrH) / 2 : fondoEdif - corrH, 0.1);

  // filas de unidades: en doble crujía se asignan balanceando área acumulada,
  // para que ambas crujías queden a escala comparable
  const filas = doble
    ? [{ y: 0, depth: stripDepth, units: [] }, { y: stripDepth + corrH, depth: stripDepth, units: [] }]
    : [{ y: 0, depth: stripDepth, units: [] }];
  if (doble) {
    const suma = [0, 0];
    [...unidades].sort((a, b) => b.area - a.area).forEach((u) => {
      const f = suma[0] <= suma[1] ? 0 : 1;
      filas[f].units.push(u);
      suma[f] += u.area;
    });
  } else {
    filas[0].units.push(...unidades);
  }

  // empaquetar cada fila: eje "empaquetado" sin core, de largo anchoEdif − coreW;
  // al mapear a coordenadas reales se inserta el hueco del core en coreX
  const disponible = Math.max(anchoEdif - coreW, 0.1);
  filas.forEach((fila) => {
    const sumW = fila.units.reduce((a, u) => a + u.area / fila.depth, 0) || 1;
    const k = disponible / sumW;
    let x = 0;
    fila.units = fila.units.map((u) => {
      const w = (u.area / fila.depth) * k;
      const a = x, b = x + w;
      const rects = [];
      if (b <= coreX || a >= coreX) {
        rects.push({ x: a < coreX ? a : a + coreW, w });
      } else {
        // la unidad cae sobre el core: se parte en dos cuerpos
        rects.push({ x: a, w: coreX - a });
        rects.push({ x: coreX + coreW, w: b - coreX });
      }
      x = b;
      return { ...u, rects, areaReal: w * fila.depth };
    });
  });

  return {
    fondo, anchoEdif, fondoEdif, fondoLibre,
    uPorPiso, n1, n2, n3, areaTip,
    core: { x: coreX, w: coreW },
    corredor: { y: stripDepth, h: corrH },
    filas, doble, warns,
  };
}
