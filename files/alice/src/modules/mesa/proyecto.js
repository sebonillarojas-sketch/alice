// datos y persistencia de la Mesa de Trabajo — lee lo que ya dejaron Growth,
// Cabida y el Editor de Planos en localStorage, y guarda snapshots por proyecto.

export const K = {
  cabida: "hygge:cabidaState",
  lote: "hygge:loteCabida",
  editor: "hygge:editorPlanos",
  brief: "hygge:planBrief",
  concepto: "hygge:mesaTrabajo",
  terrenos: "hygge:terrenos",
};

export const PROJ_STORE = "hygge:mesaProyectos";

export const loadLS = (k, d = null) => {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch { return d; }
};
const saveLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* cuota */ } };

// ── cabida: mismos defaults y misma fórmula que CabidaView (para leer sin montar la app) ──
const CABIDA_DEF = {
  terreno: 693, areaLibre: 35, pisos: 8, azoteaTechada: 30, circulacion: 12,
  modoLote: "prop", lotePoly: null, cadInfo: null,
  frente: Math.round(Math.sqrt(693 * 1.4)), tipoLote: "medianera",
  retiros: {
    frontal: { on: true, v: 5 }, izquierda: { on: false, v: 3 },
    derecha: { on: false, v: 3 }, posterior: { on: false, v: 3 }, ochavo: { on: false, v: 4 },
  },
  frenteIdx: null, partiIdx: 0, movs: {},
  areaDpto: 90, mix1: 20, mix2: 60, est1: 1, est23: 2, visitas: 10, m2Plaza: 30,
  precioM2: 2600, factorAzotea: 50, precioEst: 15000, costoM2: 950,
};

// Key scopeada por terreno (cada terreno guarda su cabida/plano aparte). Sin id → key global (legacy).
export const kFor = (base, terrenoId) => (terrenoId != null && terrenoId !== "") ? `${base}:${terrenoId}` : base;

export function calcCabida(terrenoId) {
  // lee la cabida del terreno (misma key que escribe CabidaView con scopeKey); si no hay, global legacy
  const raw = loadLS(kFor(K.cabida, terrenoId)) || loadLS(K.cabida) || {};
  const s = { ...CABIDA_DEF, ...raw };
  const libre = s.terreno * s.areaLibre / 100;
  const huella = s.terreno - libre;
  const torre = huella * s.pisos;
  const azTech = huella * s.azoteaTechada / 100;
  const azLibre = huella - azTech;
  const brutaSR = torre + azTech;
  const noComp = brutaSR * s.circulacion / 100;
  const vendible = brutaSR - noComp;

  const dptos = Math.floor(vendible / Math.max(s.areaDpto, 1));
  const mix3 = Math.max(0, 100 - s.mix1 - s.mix2);
  const d1 = Math.round(dptos * s.mix1 / 100);
  const d2 = Math.round(dptos * s.mix2 / 100);
  const d3 = Math.max(0, dptos - d1 - d2);

  const estVend = Math.ceil(d1 * s.est1 + (d2 + d3) * s.est23);
  const estTotal = Math.ceil(estVend * (1 + s.visitas / 100));
  const areaEst = estTotal * s.m2Plaza;
  const pisosSot = Math.ceil(areaEst / Math.max(s.terreno, 1));
  const sotanos = pisosSot * s.terreno;
  const construidaTotal = brutaSR + sotanos;

  const ingViv = vendible * s.precioM2;
  const ingAz = azLibre * s.precioM2 * s.factorAzotea / 100;
  const ingEst = estVend * s.precioEst;
  const ingresos = ingViv + ingAz + ingEst;
  const costo = construidaTotal * s.costoM2;
  const margen = ingresos - costo;

  return {
    s,
    r: {
      libre, huella, torre, azTech, azLibre, brutaSR, noComp, vendible,
      dptos, d1, d2, d3, mix3, estVend, estTotal, areaEst, pisosSot, sotanos,
      construidaTotal, ingViv, ingAz, ingEst, ingresos, costo, margen,
      eficiencia: brutaSR ? vendible / brutaSR * 100 : 0,
      incidencia: ingresos ? costo / ingresos * 100 : 0,
      vendEquiv: vendible + azLibre * s.factorAzotea / 100,
    },
  };
}

export const loadTerrenos = () => loadLS(K.terrenos, []) || [];
export const loadProyectos = () => loadLS(PROJ_STORE, {}) || {};

// snapshot completo bajo el nombre del proyecto: cabida + lote + planos + concepto
export function saveProyecto(nombre, meta = {}) {
  if (!nombre?.trim()) return null;
  const all = loadProyectos();
  all[nombre.trim()] = {
    nombre: nombre.trim(),
    ts: Date.now(),
    terreno: meta.terreno || null,       // terreno Growth asociado (objeto completo)
    portadaImg: meta.portadaImg || null, // portada (imagen del PDF que pase el usuario)
    snap3d: meta.snap3d || null,         // captura de la masa 3D para la presentación
    data: {
      cabida: loadLS(K.cabida),
      lote: loadLS(K.lote),
      editor: loadLS(K.editor),
      brief: loadLS(K.brief),
      concepto: loadLS(K.concepto),
    },
  };
  saveLS(PROJ_STORE, all);
  return all[nombre.trim()];
}

// restaura el snapshot a las keys vivas — Cabida/Editor lo leen al montar
export function cargarProyecto(nombre) {
  const p = loadProyectos()[nombre];
  if (!p) return null;
  Object.entries({ [K.cabida]: p.data?.cabida, [K.lote]: p.data?.lote, [K.editor]: p.data?.editor, [K.brief]: p.data?.brief, [K.concepto]: p.data?.concepto })
    .forEach(([k, v]) => { if (v != null) saveLS(k, v); });
  return p;
}

export function borrarProyecto(nombre) {
  const all = loadProyectos();
  delete all[nombre];
  saveLS(PROJ_STORE, all);
}

export const fmt = (n, d = 0) =>
  (n ?? 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ── estudio de mercado (mismo modelo que Growth · análisis / TerrenoOpportunidad) ──
// La propuesta Hygge sale de cabida: precio/m² y unidades. Supuestos fijos de v1:
// acabados estándar, storytelling 50, arquitecto reconocido local.
import { DISTRICTS_DATA, COMPETITORS_DB, TREND_LABEL } from "../mercado/sectorData.js";

export function calcMercado(terreno, cab) {
  const district = terreno?.district && DISTRICTS_DATA[terreno.district] ? terreno.district : "Miraflores";
  const d = DISTRICTS_DATA[district];
  const competidores = COMPETITORS_DB[district] || [];
  const precioM2 = cab.s.precioM2;
  const units = cab.r.dptos || 40;

  const mid = (d.priceRange[0] + d.priceRange[1]) / 2;
  const priceRatio = precioM2 / mid;
  const storytelling = 50;
  const storyMult = 0.82 + (storytelling / 100) * 0.40;
  const absorption = Math.max(0.4, d.base * storyMult * (priceRatio < 0.88 ? 1.25 : priceRatio > 1.18 ? 0.70 : 1.0));
  const monthsToSell = Math.ceil(units / Math.max(absorption, 0.1));
  const pricePosition = priceRatio < 0.90 ? "Bajo mercado" : priceRatio > 1.12 ? "Sobre mercado" : "En mercado";

  const marketScore = Math.round(d.trendScore * 45 + (Math.min(d.base, 10) / 10) * 30 + ((100 - d.oferta) / 100) * 25);
  const blendedScore = Math.round(((terreno?.score || 70) + marketScore) / 2);

  // curva de absorción acumulada (vendidas vs disponibles)
  const curve = [];
  let sold = 0;
  for (let m = 1; m <= Math.min(monthsToSell + 6, 30); m++) {
    sold = Math.min(units, sold + absorption);
    curve.push({ mes: `M${m}`, vendidas: Math.round(sold), disponibles: Math.max(0, units - Math.round(sold)) });
  }

  // posicionamiento precio vs absorción
  const scatter = {
    comps: competidores.map((c) => ({ x: c.priceM2, y: c.absorption, z: c.units, name: c.name })),
    mine: [{ x: precioM2, y: +absorption.toFixed(1), z: units, name: "Hygge" }],
  };

  // radar diferenciadores Hygge vs mercado
  const priceScore = Math.round(Math.max(0, Math.min(100, (1 - (priceRatio - 1) * 2) * 100)));
  const veloScore = Math.min(100, Math.round((absorption / (d.base * 1.5)) * 100));
  const radar = [
    { axis: "Precio competitivo", comp: 50, hygge: priceScore },
    { axis: "Velocidad est.", comp: Math.round((d.base / 10) * 100), hygge: veloScore },
    { axis: "Storytelling", comp: 40, hygge: storytelling },
    { axis: "Acabados", comp: 50, hygge: 50 },
    { axis: "Ubicación", comp: 60, hygge: Math.round((terreno?.score || 70) * 0.8) },
    { axis: "Arquitecto", comp: 60, hygge: 60 },
  ];

  // comparativa precio/m² (Hygge + competidores, ordenada)
  const priceBars = [
    ...competidores.map((c) => ({ name: c.name.length > 15 ? c.name.slice(0, 14) + "…" : c.name, precio: c.priceM2, mine: false })),
    { name: "◆ Hygge", precio: precioM2, mine: true },
  ].sort((a, b) => b.precio - a.precio);

  return {
    district, d, competidores, precioM2, units, mid, priceRatio, pricePosition,
    absorption, monthsToSell, marketScore, blendedScore, curve, scatter, radar, priceBars,
    trendLabel: TREND_LABEL[d.trend],
  };
}

// mapa minimalista (Leaflet + Carto light) como documento embebible en iframe.
// mode "sector": distritos como burbujas por absorción + terreno; "lote": solo el pin.
export function mapaMinimalHTML({ lat, lng, nombre, district, mode = "lote", zoom }) {
  const BLUE = "#95ABE8", ORANGE = "#F7643B", DARK = "#373737";
  const trendColor = { trending: ORANGE, estable: BLUE, emergente: DARK };
  const markers = mode === "sector"
    ? Object.entries(DISTRICTS_DATA).map(([name, dd]) => {
        const sel = name === district;
        const r = 10 + Math.round((dd.base / 10) * 16) + (sel ? 6 : 0);
        const col = trendColor[dd.trend] || BLUE;
        return `L.circleMarker([${dd.lat},${dd.lng}],{radius:${r},color:"${col}",fillColor:"${col}",fillOpacity:${sel ? 0.55 : 0.22},weight:${sel ? 2.5 : 1}}).bindTooltip('<div style="font:600 11px monospace;padding:2px 6px">${name} · ${dd.base} u/mes</div>').addTo(map);`;
      }).join("\n")
    : "";
  const tiles = mode === "sector" ? "light_nolabels" : "light_all";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>*{margin:0;padding:0}body,html{height:100%;background:#E3E1DE}.leaflet-control-zoom,.leaflet-control-attribution{display:none!important}
.leaflet-tile-pane{filter:grayscale(1) contrast(0.92) brightness(1.04)}</style></head>
<body><div id="map" style="width:100%;height:100vh"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:false}).setView([${lat},${lng}],${zoom ?? (mode === "sector" ? 12 : 15)});
L.tileLayer('https://{s}.basemaps.cartocdn.com/${tiles}/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(map);
${markers}
var icon=L.divIcon({html:'<div style="width:16px;height:16px;background:#000;border:3px solid #E3E1DE;box-shadow:0 2px 8px rgba(0,0,0,.45)"></div>',className:'',iconSize:[16,16],iconAnchor:[8,8]});
L.marker([${lat},${lng}],{icon:icon}).bindTooltip('<b style="font:600 11px monospace">${(nombre || "Terreno").replace(/'/g, "\\'")}</b>',{permanent:true,direction:'top',offset:[0,-10]}).addTo(map);
</script></body></html>`;
}

// imagen → dataURL re-escalado (portadas, etc.)
export const fileToDataURL = (file, cb, max = 1800) => {
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k);
      cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.85));
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
};
