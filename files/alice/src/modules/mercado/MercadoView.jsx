import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import {
  MapPin, TrendingUp, TrendingDown, Zap, BarChart2,
  ChevronDown, ChevronRight, Plus, Trash2, Sparkles,
  RefreshCw, ExternalLink, Target, Building,
  Image, Newspaper, Link, Tag, X, Globe,
} from "lucide-react";

// ─── BRAND ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", ink: "#0A0B0F", inkSoft: "#2E2E33",
  muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6", surface: "#E5E1D6",
  navy: "#1E2A4A", cobalt: "#3D52D5", lavender: "#A89BD9", ochre: "#C2A45A",
  brick: "#A85B5B", green: "#5F8A6A", sky: "#9BCBE3",
};

// ─── LIMA DISTRICT DATA ───────────────────────────────────────────────────────
const DISTRICTS = [
  { id: "miraflores",  name: "Miraflores",   lat: -12.1219, lng: -77.0299, base: 3.5, priceRange: [3200, 6500], trend: "estable",   trendScore: 1.05, desc: "NSE A. Demanda sostenida, premium consolidado." },
  { id: "sanisidro",   name: "San Isidro",    lat: -12.0976, lng: -77.0365, base: 2.8, priceRange: [3800, 7200], trend: "estable",   trendScore: 1.00, desc: "NSE A+. Mercado small & luxury. Absorción lenta pero precio alto." },
  { id: "barranco",    name: "Barranco",      lat: -12.1434, lng: -77.0222, base: 2.5, priceRange: [2800, 5000], trend: "trending",  trendScore: 1.28, desc: "NSE A/B+. Narrativa cultural fuerte. Storytelling = driver clave." },
  { id: "lamolina",    name: "La Molina",     lat: -12.0759, lng: -76.9425, base: 4.8, priceRange: [2200, 4800], trend: "estable",   trendScore: 1.00, desc: "NSE B+/A. Casas + dptos. Familia como buyer principal." },
  { id: "surco",       name: "Surco",         lat: -12.1491, lng: -76.9924, base: 6.2, priceRange: [1800, 3800], trend: "estable",   trendScore: 0.98, desc: "NSE B/B+. Mercado masivo con bolsones premium en El Polo." },
  { id: "jesusmaria",  name: "Jesús María",   lat: -12.0715, lng: -77.0528, base: 7.5, priceRange: [1600, 2800], trend: "trending",  trendScore: 1.22, desc: "NSE B/B+. Alta velocidad, precio accesible. Ideal primera vivienda." },
  { id: "magdalena",   name: "Magdalena",     lat: -12.0908, lng: -77.0728, base: 5.5, priceRange: [1700, 3000], trend: "trending",  trendScore: 1.18, desc: "NSE B+. Zona en consolidación. Precio/m² atractivo vs Miraflores." },
  { id: "sanborja",    name: "San Borja",     lat: -12.1026, lng: -76.9986, base: 4.2, priceRange: [2200, 4200], trend: "estable",   trendScore: 1.00, desc: "NSE A/B+. Familiar. Menos especulación que Miraflores." },
  { id: "pueblolibre", name: "Pueblo Libre",  lat: -12.0796, lng: -77.0638, base: 5.8, priceRange: [1500, 2600], trend: "emergente", trendScore: 0.88, desc: "NSE B. Emergente. Comprador joven buscando alternativa a Jesús María." },
  { id: "sanmiguel",   name: "San Miguel",    lat: -12.0855, lng: -77.0892, base: 6.8, priceRange: [1400, 2500], trend: "emergente", trendScore: 0.90, desc: "NSE B. Velocidad alta, margen comprimido. Volumen es el negocio." },
  { id: "lince",       name: "Lince",         lat: -12.0843, lng: -77.0391, base: 8.2, priceRange: [1300, 2200], trend: "emergente", trendScore: 0.85, desc: "NSE B/C+. Precio más bajo de Lima top. Riesgo: sobre-oferta." },
  { id: "chorrillos",  name: "Chorrillos",    lat: -12.1699, lng: -77.0181, base: 5.2, priceRange: [1500, 2800], trend: "emergente", trendScore: 0.82, desc: "NSE B. Playa como diferenciador. Buyer Lima Moderna buscando escape." },
];

const TREND_COLOR = { trending: C.green, estable: C.cobalt, emergente: C.ochre };
const TREND_LABEL = { trending: "En tendencia ↑", estable: "Mercado estable", emergente: "Zona emergente" };

// ─── VELOCITY MODEL ──────────────────────────────────────────────────────────
const ACABADOS_OPTS  = ["Básico", "Estándar", "Premium", "Luxury"];
const MEDIA_OPTS     = ["Nula", "Digital básica", "Digital completa", "Full 360°"];
const ARCHITECT_OPTS = ["Sin nombre conocido", "Reconocido local", "Internacional"];
const DEVELOPER_OPTS = ["Primer proyecto", "Track record local", "Developer consolidado"];
const STORY_LABELS   = ["Sin concepto", "Básico", "Bien definido", "Sólido y diferenciado", "Exceptional — storytelling de marca"];
const TIPOLOGIA_OPTS = ["Flats", "Dúplex", "Mix tipologías", "Penthouses", "Vivienda social"];

const ACABADOS_MULT  = [0.82, 1.0, 1.18, 0.88]; // luxury = mercado chico
const MEDIA_MULT     = [0.78, 1.0, 1.24, 1.48];
const ARCH_MULT      = [1.0, 1.14, 1.30];
const DEV_MULT       = [0.87, 1.0, 1.15];
const STORY_MULT     = [0.72, 0.88, 1.0, 1.28, 1.52]; // 0→4

function calcVelocity(district, f) {
  if (!district) return null;
  const priceMult      = Math.pow(0.968, f.priceDelta);
  const acabadosMult   = ACABADOS_MULT[f.acabados];
  const storyMult      = STORY_MULT[f.storytelling];
  const mediaMult      = MEDIA_MULT[f.media];
  const archMult       = ARCH_MULT[f.architect];
  const devMult        = DEV_MULT[f.developer];
  const exclusiveMult  = f.exclusivity ? 1.24 : 1.0;
  const viewMult       = f.specialView ? 1.15 : 1.0;
  const trendMult      = district.trendScore;
  const v = district.base * priceMult * acabadosMult * storyMult * mediaMult * archMult * devMult * exclusiveMult * viewMult * trendMult;
  return Math.max(0.3, Math.min(v, district.base * 3.2));
}

function calcStoryScore(f) {
  // 0-100 score for intangibles
  let score = 0;
  score += f.storytelling * 14;           // 0-56
  score += f.architect * 8;               // 0-16
  score += f.exclusivity ? 14 : 0;        // 0-14
  score += f.specialView ? 10 : 0;        // 0-10
  score += f.media === 3 ? 4 : f.media === 2 ? 2 : 0; // 0-4
  return Math.min(100, Math.round(score));
}

function calcAbsorption(velocity, totalUnits) {
  if (!velocity || !totalUnits) return [];
  const data = [];
  let sold = 0;
  const months = Math.ceil(totalUnits / velocity) + 4;
  for (let m = 0; m <= months; m++) {
    const phase = m / months;
    // S-curve: slow start, peak, tail
    const phaseV = phase < 0.15 ? velocity * 0.55
      : phase > 0.82 ? velocity * 0.62
      : velocity;
    sold = Math.min(totalUnits, sold + phaseV);
    const pct = (sold / totalUnits) * 100;
    data.push({
      mes: m === 0 ? "Lanzamiento" : `M${m}`,
      vendidas: Math.round(sold),
      pct: Math.round(pct),
      disponibles: Math.max(0, totalUnits - Math.round(sold)),
    });
    if (sold >= totalUnits) break;
  }
  return data;
}

function calcTornado(district, factors) {
  const base = calcVelocity(district, factors);
  if (!base) return [];
  const tests = [
    { label: "Storytelling",    key: "storytelling",  lo: 0,     hi: 4     },
    { label: "Precio relativo", key: "priceDelta",    lo: 20,    hi: -20   },
    { label: "Pauta mediática", key: "media",         lo: 0,     hi: 3     },
    { label: "Arquitecto",      key: "architect",     lo: 0,     hi: 2     },
    { label: "Acabados",        key: "acabados",      lo: 0,     hi: 2     },
    { label: "Developer",       key: "developer",     lo: 0,     hi: 2     },
    { label: "Vista especial",  key: "specialView",   lo: false, hi: true  },
    { label: "Exclusividad",    key: "exclusivity",   lo: false, hi: true  },
  ];
  return tests.map(t => {
    const lo = calcVelocity(district, { ...factors, [t.key]: t.lo });
    const hi = calcVelocity(district, { ...factors, [t.key]: t.hi });
    return { label: t.label, impact: hi - lo, low: lo - base, high: hi - base };
  }).sort((a, b) => b.impact - a.impact);
}

function calcSpider(district, factors) {
  const v = calcVelocity(district, factors) || 0;
  const base = district?.base || 1;
  return [
    { subject: "Precio",     value: Math.round(Math.max(0, (1 - factors.priceDelta / 30) * 5)) },
    { subject: "Story",      value: factors.storytelling + 1 },
    { subject: "Media",      value: factors.media + 1 },
    { subject: "Producto",   value: factors.acabados === 2 ? 5 : factors.acabados + 2 },
    { subject: "Marca",      value: Math.min(5, factors.architect * 1.5 + factors.developer + 1) },
    { subject: "Diferenc.",  value: Math.min(5, (factors.exclusivity ? 2 : 0) + (factors.specialView ? 2 : 0) + 1) },
    { subject: "Ubicación",  value: Math.min(5, Math.round(district ? district.trendScore * 3.5 : 2.5)) },
  ];
}

// ─── MAP COMPONENT ───────────────────────────────────────────────────────────
function DistrictMap({ selectedId, onSelect }) {
  const markersJs = DISTRICTS.map(d => {
    const color = d.trend === "trending" ? "#5F8A6A" : d.trend === "emergente" ? "#C2A45A" : "#3D52D5";
    const r = 8 + d.base * 1.6;
    return `
      L.circleMarker([${d.lat}, ${d.lng}], {
        radius: ${r}, color: "${color}", fillColor: "${color}",
        fillOpacity: 0.75, weight: 2,
      }).addTo(map)
        .bindTooltip("<b>${d.name}</b><br/>${d.base} u/mes base · ${d.trend}", { permanent: false })
        .on("click", () => window.parent.postMessage({ type:"district:select", id:"${d.id}" }, "*"));
    `;
  }).join("\n");

  const html = `<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>html,body,#map{margin:0;padding:0;height:100%;background:#EEEBE3;}
  .leaflet-control-attribution{display:none;}
  </style></head><body>
  <div id="map"></div>
  <script>
    const map = L.map("map", { zoomControl: true, scrollWheelZoom: true })
      .setView([-12.08, -77.03], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd"
    }).addTo(map);
    ${markersJs}
    window.addEventListener("message", e => {
      if (e.data?.type === "district:highlight") {
        // Could highlight selected district circle here
      }
    });
  </script></body></html>`;

  return (
    <iframe
      srcDoc={html}
      style={{ width: "100%", height: "100%", border: "none", borderRadius: 2 }}
      title="Mapa de distritos Lima"
      sandbox="allow-scripts"
    />
  );
}

// ─── SLIDER COMPONENT ────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, onChange, format = v => v, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.ink, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {format(value)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: C.cobalt, cursor: "pointer" }} />
      {hint && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ─── RADIO GROUP ─────────────────────────────────────────────────────────────
function RadioGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map((opt, i) => (
          <button key={i} onClick={() => onChange(i)}
            style={{
              padding: "4px 10px", fontSize: 11, borderRadius: 2, cursor: "pointer",
              border: `1px solid ${value === i ? C.cobalt : C.line}`,
              background: value === i ? C.cobalt : "transparent",
              color: value === i ? "#fff" : C.inkSoft, fontWeight: value === i ? 600 : 400,
              transition: "all .15s",
            }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TOGGLE ──────────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: C.muted }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
        background: value ? C.cobalt : C.line, position: "relative", flexShrink: 0,
        transition: "background .2s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left .2s",
        }} />
      </button>
    </div>
  );
}

// ─── PHOTO GALLERY ───────────────────────────────────────────────────────────
const EMPTY_PHOTO = () => ({ id: Date.now() + Math.random(), url: "", caption: "", isStreetView: false });

function PhotoGallery({ photos, setPhotos, district }) {
  const [lightbox, setLightbox] = useState(null);

  const streetViewUrl = district
    ? `https://www.google.com/maps/@${district.lat},${district.lng},3a,75y,0h,90t/data=!3m6!1e1`
    : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Fotos del entorno
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {district && (
            <a href={streetViewUrl} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.cobalt, fontWeight: 600,
                textDecoration: "none", padding: "3px 8px", border: `1px solid ${C.line}`, borderRadius: 2 }}>
              <Globe size={10} /> Street View ↗
            </a>
          )}
          <button onClick={() => setPhotos(p => [...p, EMPTY_PHOTO()])}
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.cobalt,
              background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            <Plus size={12} /> Agregar foto
          </button>
        </div>
      </div>

      {/* Add URL inputs */}
      {photos.map(ph => (
        <div key={ph.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input value={ph.url} onChange={e => setPhotos(p => p.map(x => x.id === ph.id ? { ...x, url: e.target.value } : x))}
            placeholder="URL de imagen (jpg, png, webp…)"
            style={{ flex: 2, padding: "5px 8px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 2,
              background: C.paper, color: C.ink, outline: "none" }} />
          <input value={ph.caption} onChange={e => setPhotos(p => p.map(x => x.id === ph.id ? { ...x, caption: e.target.value } : x))}
            placeholder="Descripción…"
            style={{ flex: 1, padding: "5px 8px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 2,
              background: C.paper, color: C.ink, outline: "none" }} />
          <button onClick={() => setPhotos(p => p.filter(x => x.id !== ph.id))}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, flexShrink: 0 }}>
            <X size={12} />
          </button>
        </div>
      ))}

      {/* Grid */}
      {photos.filter(p => p.url).length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 8 }}>
          {photos.filter(p => p.url).map(ph => (
            <div key={ph.id} onClick={() => setLightbox(ph)}
              style={{ position: "relative", aspectRatio: "4/3", borderRadius: 2, overflow: "hidden",
                cursor: "pointer", background: C.surface, border: `1px solid ${C.line}` }}>
              <img src={ph.url} alt={ph.caption}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={e => { e.target.style.display = "none"; }} />
              {ph.caption && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.55)",
                  color: "#fff", fontSize: 9, padding: "4px 6px", lineHeight: 1.3 }}>
                  {ph.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {photos.filter(p => p.url).length === 0 && photos.length === 0 && (
        <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "14px 0",
          borderTop: `1px solid ${C.lineSoft}`, fontStyle: "italic" }}>
          Pegá URLs de imágenes del entorno, renders, o abrí Street View
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: "100%", position: "relative" }}>
            <img src={lightbox.url} alt={lightbox.caption}
              style={{ width: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 2 }} />
            {lightbox.caption && (
              <div style={{ color: "#fff", fontSize: 12, textAlign: "center", marginTop: 10 }}>{lightbox.caption}</div>
            )}
            <button onClick={() => setLightbox(null)}
              style={{ position: "absolute", top: -12, right: -12, background: C.ink, border: "none",
                color: "#fff", width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NEWS PANEL ──────────────────────────────────────────────────────────────
const NEWS_TAGS = ["Mercado", "Legal", "Urbanismo", "Macro", "Competencia", "Tendencia", "Riesgo"];
const TAG_COLORS = {
  "Mercado": C.cobalt, "Legal": C.ochre, "Urbanismo": C.green,
  "Macro": C.navy, "Competencia": C.lavender, "Tendencia": C.sky, "Riesgo": C.brick,
};
const EMPTY_NEWS = () => ({ id: Date.now() + Math.random(), title: "", url: "", source: "", date: "", tag: "Mercado", note: "" });

function NewsPanel({ news, setNews }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(EMPTY_NEWS());

  const save = () => {
    if (!draft.title.trim()) return;
    setNews(n => [{ ...draft, id: Date.now() }, ...n]);
    setDraft(EMPTY_NEWS());
    setAdding(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Noticias & contexto del sector
        </span>
        <button onClick={() => setAdding(a => !a)}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.cobalt,
            background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          <Plus size={12} /> {adding ? "Cancelar" : "Agregar"}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ background: C.surface, borderRadius: 2, padding: "12px", marginBottom: 12 }}>
          <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="Título de la noticia o insight…"
            style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 2,
              background: C.paper, color: C.ink, outline: "none", boxSizing: "border-box", marginBottom: 6 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, marginBottom: 6 }}>
            <input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
              placeholder="URL (opcional)"
              style={{ padding: "5px 8px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 2,
                background: C.paper, color: C.ink, outline: "none" }} />
            <input value={draft.source} onChange={e => setDraft(d => ({ ...d, source: e.target.value }))}
              placeholder="Fuente"
              style={{ padding: "5px 8px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 2,
                background: C.paper, color: C.ink, outline: "none" }} />
            <input value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
              placeholder="Fecha" type="date"
              style={{ padding: "5px 8px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 2,
                background: C.paper, color: C.ink, outline: "none" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {NEWS_TAGS.map(t => (
              <button key={t} onClick={() => setDraft(d => ({ ...d, tag: t }))}
                style={{ padding: "3px 8px", fontSize: 10, borderRadius: 2, border: "none", cursor: "pointer",
                  background: draft.tag === t ? (TAG_COLORS[t] || C.cobalt) : C.line,
                  color: draft.tag === t ? "#fff" : C.muted, fontWeight: 600 }}>
                {t}
              </button>
            ))}
          </div>
          <textarea value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
            placeholder="Nota / relevancia para el proyecto…" rows={2}
            style={{ width: "100%", padding: "6px 8px", fontSize: 11, border: `1px solid ${C.line}`, borderRadius: 2,
              background: C.paper, color: C.ink, outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 8, fontFamily: "inherit" }} />
          <button onClick={save}
            style={{ padding: "6px 16px", background: C.ink, color: "#fff", border: "none", borderRadius: 2,
              fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Guardar
          </button>
        </div>
      )}

      {/* News list */}
      {news.length === 0 && !adding && (
        <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "14px 0",
          borderTop: `1px solid ${C.lineSoft}`, fontStyle: "italic" }}>
          Agregá noticias, informes o insights del sector para enriquecer el análisis
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {news.map(item => (
          <div key={item.id} style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 2,
                    background: TAG_COLORS[item.tag] || C.cobalt, color: "#fff" }}>
                    {item.tag}
                  </span>
                  {item.source && <span style={{ fontSize: 10, color: C.muted }}>{item.source}</span>}
                  {item.date && <span style={{ fontSize: 10, color: C.muted }}>{item.date}</span>}
                </div>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, fontWeight: 600, color: C.ink, textDecoration: "none", lineHeight: 1.4,
                      display: "flex", alignItems: "center", gap: 4 }}>
                    {item.title} <ExternalLink size={10} style={{ flexShrink: 0, color: C.muted }} />
                  </a>
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>{item.title}</div>
                )}
                {item.note && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontStyle: "italic", lineHeight: 1.4 }}>
                    {item.note}
                  </div>
                )}
              </div>
              <button onClick={() => setNews(n => n.filter(x => x.id !== item.id))}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, flexShrink: 0 }}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPARABLE ROW ──────────────────────────────────────────────────────────
const EMPTY_COMP = () => ({ id: Date.now(), nombre: "", precio: "", velocidad: "", acabados: "Estándar", nota: "" });

function ComparableTable({ comps, setComps }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Proyectos comparables
        </span>
        <button onClick={() => setComps(c => [...c, EMPTY_COMP()])}
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.cobalt,
            background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
          <Plus size={12} /> Agregar comp
        </button>
      </div>
      {comps.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "20px 0", borderTop: `1px solid ${C.line}` }}>
          Sin comparables — agregá proyectos del sector para enriquecer el análisis
        </div>
      )}
      {comps.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                {["Proyecto", "$/m²", "U/mes", "Acabados", "Nota"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 6px", color: C.muted, fontWeight: 600, fontSize: 10 }}>{h}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {comps.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  {["nombre", "precio", "velocidad", "acabados", "nota"].map(field => (
                    <td key={field} style={{ padding: "4px 6px" }}>
                      <input value={c[field]} onChange={e => setComps(prev => prev.map(r => r.id === c.id ? { ...r, [field]: e.target.value } : r))}
                        placeholder={field === "nombre" ? "Nombre..." : field === "precio" ? "USD/m²" : field === "velocidad" ? "u/mes" : ""}
                        style={{ border: "none", background: "transparent", fontSize: 11, color: C.ink, width: "100%", outline: "none" }} />
                    </td>
                  ))}
                  <td>
                    <button onClick={() => setComps(c2 => c2.filter(r => r.id !== c.id))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "8px 12px", fontSize: 11 }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  );
}

// ─── MAIN VIEW ───────────────────────────────────────────────────────────────
export default function MercadoView() {
  // District
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  // Project factors
  const [factors, setFactors] = useState({
    priceDelta:   0,      // -25 to +25 (% vs mercado)
    acabados:     1,      // 0-3
    storytelling: 2,      // 0-4
    media:        1,      // 0-3
    architect:    0,      // 0-2
    developer:    1,      // 0-2
    exclusivity:  false,
    specialView:  false,
    totalUnits:   40,
    preciom2:     "",
    tipologia:    2,
  });

  const setF = useCallback((key, val) => setFactors(f => ({ ...f, [key]: val })), []);

  // Analysis
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  // Comparables
  const [comps, setComps] = useState([]);

  // Photos & news
  const [photos, setPhotos] = useState([]);
  const [news, setNews] = useState([]);

  // Section collapse
  const [showComps, setShowComps] = useState(false);
  const [showSpider, setShowSpider] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [showNews, setShowNews] = useState(true);

  // Listen for district selection from map iframe
  useEffect(() => {
    const handler = e => {
      if (e.data?.type === "district:select") {
        const d = DISTRICTS.find(x => x.id === e.data.id);
        if (d) setSelectedDistrict(d);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Computed
  const velocity     = useMemo(() => calcVelocity(selectedDistrict, factors), [selectedDistrict, factors]);
  const absorption   = useMemo(() => calcAbsorption(velocity, factors.totalUnits), [velocity, factors.totalUnits]);
  const tornado      = useMemo(() => calcTornado(selectedDistrict, factors), [selectedDistrict, factors]);
  const spider       = useMemo(() => calcSpider(selectedDistrict, factors), [selectedDistrict, factors]);
  const storyScore   = useMemo(() => calcStoryScore(factors), [factors]);
  const absMonths    = useMemo(() => absorption.length ? absorption.length - 1 : null, [absorption]);
  const revenueEst   = useMemo(() => {
    if (!factors.preciom2 || !factors.totalUnits) return null;
    const avgM2 = 85; // avg unit size assumption
    return Math.round(Number(factors.preciom2) * avgM2 * factors.totalUnits / 1e6 * 10) / 10;
  }, [factors.preciom2, factors.totalUnits]);

  // Alicia analysis
  const runAnalysis = useCallback(async () => {
    if (!selectedDistrict || !velocity) return;
    setAnalyzing(true);
    setAnalysis("");

    const prompt = `Sos Alicia, asistente ejecutiva de Hygge Holding.
Analizá este proyecto inmobiliario con ojo crítico. Usá datos reales del mercado limeño.

DISTRITO: ${selectedDistrict.name}
Contexto: ${selectedDistrict.desc}
Absorción base del distrito: ${selectedDistrict.base} unidades/mes
Tendencia: ${selectedDistrict.trend} (score: ${selectedDistrict.trendScore})
Rango de precios del sector: USD ${selectedDistrict.priceRange[0]}–${selectedDistrict.priceRange[1]}/m²

PROYECTO:
- Tipología: ${TIPOLOGIA_OPTS[factors.tipologia]}
- Precio relativo al mercado: ${factors.priceDelta > 0 ? "+" : ""}${factors.priceDelta}%${factors.preciom2 ? ` (USD ${factors.preciom2}/m²)` : ""}
- Acabados: ${ACABADOS_OPTS[factors.acabados]}
- Total unidades: ${factors.totalUnits}
${revenueEst ? `- Revenue estimado: USD ${revenueEst}M` : ""}

FACTORES INTANGIBLES Y NARRATIVA:
- Storytelling / concepto de marca: ${STORY_LABELS[factors.storytelling]} (nivel ${factors.storytelling + 1}/5)
- Arquitecto: ${ARCHITECT_OPTS[factors.architect]}
- Developer: ${DEVELOPER_OPTS[factors.developer]}
- Pauta mediática: ${MEDIA_OPTS[factors.media]}
- Proyecto boutique / exclusivo: ${factors.exclusivity ? "Sí" : "No"}
- Vista o factor diferenciador especial: ${factors.specialView ? "Sí" : "No"}
- Score de diferenciación intangible: ${storyScore}/100

RESULTADO DEL MODELO:
- Velocidad proyectada: ${velocity.toFixed(1)} unidades/mes
- Absorción total estimada: ${absMonths} meses
${comps.length > 0 ? `\nCOMPARABLES EN EL SECTOR:\n${comps.map(c => `- ${c.nombre}: USD ${c.precio}/m², ${c.velocidad} u/mes, ${c.acabados}. ${c.nota}`).join("\n")}` : ""}
${news.length > 0 ? `\nCONTEXTO DE MERCADO Y NOTICIAS RELEVANTES:\n${news.map(n => `- [${n.tag}] ${n.title}${n.source ? ` (${n.source}${n.date ? ", " + n.date : ""})` : ""}${n.note ? ": " + n.note : ""}`).join("\n")}` : ""}
${photos.filter(p => p.url && p.caption).length > 0 ? `\nFOTOS DEL ENTORNO (${photos.filter(p => p.url).length} imágenes cargadas): ${photos.filter(p => p.caption).map(p => p.caption).join(", ")}` : ""}

Dame:
1. **Validación del precio** — ¿el precio relativo es realista para el perfil del proyecto y el distrito? ¿Hay espacio para subir o hay riesgo de over-pricing?
2. **Análisis del storytelling** — ¿el nivel de narrativa es consistente con los acabados y el posicionamiento? ¿Qué falta o qué sobra?
3. **Riesgos principales** — los 2-3 factores que más podrían desacelerar las ventas
4. **Palancas clave** — los 2-3 factores donde una mejora tiene mayor impacto en velocidad
5. **Velocidad de ventas** — ¿${velocity.toFixed(1)} u/mes es creíble? ¿Optimista o conservador para ${selectedDistrict.name}?
6. **Recomendación ejecutiva** — una decisión concreta que tomarías hoy

Sé directa. No des listas genéricas. Hablá de Lima, de este distrito, de este tipo de proyecto.`;

    try {
      const BRAIN_URL = "http://localhost:3001";
      let res = await fetch(`${BRAIN_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          systemPrompt: "Sos Alicia, asistente ejecutiva de Hygge Holding. Experta en mercado inmobiliario limeño.",
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        const apiKey = localStorage.getItem("alicia_api_key");
        if (!apiKey) throw new Error("No hay API key configurada — ve a Alicia > Settings para configurarla.");
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
        });
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || data.choices?.[0]?.message?.content || data.message || "";
      setAnalysis(text);
    } catch (err) {
      setAnalysis(`Error al conectar con Alicia: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }, [selectedDistrict, factors, velocity, absMonths, storyScore, comps, revenueEst]);

  // Velocity color
  const velocityColor = !velocity ? C.muted
    : velocity >= (selectedDistrict?.base * 1.3) ? C.green
    : velocity >= selectedDistrict?.base ? C.cobalt
    : velocity >= (selectedDistrict?.base * 0.7) ? C.ochre
    : C.brick;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", background: C.bg }}>

      {/* ── MAPA grande ─────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", height: 380, flexShrink: 0, borderBottom: `1px solid ${C.line}` }}>
        <DistrictMap selectedId={selectedDistrict?.id} onSelect={setSelectedDistrict} height={380} />

        {/* District pills flotando sobre el mapa */}
        <div style={{
          position: "absolute", bottom: 12, left: 12, right: 12,
          display: "flex", flexWrap: "wrap", gap: 6, pointerEvents: "none",
        }}>
          {DISTRICTS.map(d => (
            <button key={d.id} onClick={() => setSelectedDistrict(d)}
              style={{
                pointerEvents: "all", padding: "4px 10px", borderRadius: 2, border: "none",
                fontSize: 11, fontWeight: selectedDistrict?.id === d.id ? 700 : 500, cursor: "pointer",
                background: selectedDistrict?.id === d.id ? C.ink : "rgba(244,241,234,0.92)",
                color: selectedDistrict?.id === d.id ? "#fff" : C.inkSoft,
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                borderLeft: `3px solid ${TREND_COLOR[d.trend]}`,
              }}>
              {d.name}
            </button>
          ))}
        </div>

        {/* Header overlay top-left */}
        <div style={{
          position: "absolute", top: 14, left: 16,
          background: "rgba(244,241,234,0.92)", padding: "6px 12px", borderRadius: 2,
          boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
        }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>Análisis de mercado · Lima</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Simulador de Ventas
            {selectedDistrict && (
              <span style={{ fontSize: 12, fontWeight: 500, color: TREND_COLOR[selectedDistrict.trend], marginLeft: 8 }}>
                {selectedDistrict.name}
              </span>
            )}
          </div>
        </div>

        {/* Tycoon link top-right */}
        <div style={{ position: "absolute", top: 14, right: 16 }}>
          <a href="https://hygge-radar.netlify.app" target="_blank" rel="noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600,
              color: C.cobalt, textDecoration: "none", background: "rgba(244,241,234,0.92)",
              padding: "5px 10px", borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
            }}>
            <ExternalLink size={11} /> Radar + Tycoon AI
          </a>
        </div>
      </div>

      {/* ── CONTENIDO ABAJO ─────────────────────────────────────────────────── */}
      <div style={{ padding: "28px 32px 48px", maxWidth: 1100, width: "100%", alignSelf: "center" }}>

        {/* ── VARIABLES ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
            Parámetros del proyecto
          </div>

          {/* Row 1: tipología / precio / unidades / precio relativo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 5 }}>Tipología</div>
              <select value={factors.tipologia} onChange={e => setF("tipologia", Number(e.target.value))}
                style={{ width: "100%", padding: "7px 8px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 2, background: C.paper, color: C.ink }}>
                {TIPOLOGIA_OPTS.map((o, i) => <option key={i} value={i}>{o}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 5 }}>USD/m²</div>
              <input type="number" placeholder="ej. 3800" value={factors.preciom2}
                onChange={e => setF("preciom2", e.target.value)}
                style={{ width: "100%", padding: "7px 8px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 2, background: C.paper, color: C.ink, boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 5 }}>Unidades</div>
              <input type="number" min={1} max={500} value={factors.totalUnits}
                onChange={e => setF("totalUnits", Math.max(1, Number(e.target.value)))}
                style={{ width: "100%", padding: "7px 8px", fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 2, background: C.paper, color: C.ink, boxSizing: "border-box" }} />
            </div>
            <div>
              <Slider label="Precio relativo al mercado" value={factors.priceDelta} min={-25} max={25} step={5}
                onChange={v => setF("priceDelta", v)}
                format={v => v === 0 ? "En mercado" : `${v > 0 ? "+" : ""}${v}%`}
                hint={factors.priceDelta > 10 ? "⚠ Sobre-precio" : factors.priceDelta < -10 ? "✓ Precio agresivo" : ""} />
            </div>
          </div>

          {/* Row 2: acabados / storytelling / arquitecto / developer */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <RadioGroup label="Acabados" options={ACABADOS_OPTS} value={factors.acabados} onChange={v => setF("acabados", v)} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 5 }}>Storytelling</div>
              <input type="range" min={0} max={4} value={factors.storytelling}
                onChange={e => setF("storytelling", Number(e.target.value))}
                style={{ width: "100%", accentColor: C.cobalt, marginBottom: 4 }} />
              <div style={{ fontSize: 10, color: C.cobalt, fontStyle: "italic" }}>{STORY_LABELS[factors.storytelling]}</div>
            </div>
            <div>
              <RadioGroup label="Arquitecto" options={ARCHITECT_OPTS} value={factors.architect} onChange={v => setF("architect", v)} />
            </div>
            <div>
              <RadioGroup label="Developer" options={DEVELOPER_OPTS} value={factors.developer} onChange={v => setF("developer", v)} />
            </div>
          </div>

          {/* Row 3: pauta / boutique / vista */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div>
              <RadioGroup label="Pauta mediática" options={MEDIA_OPTS} value={factors.media} onChange={v => setF("media", v)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end" }}>
              <Toggle label="Boutique / exclusivo" value={factors.exclusivity} onChange={v => setF("exclusivity", v)}
                hint="Menos de 20 unidades · premium aspiracional" />
              <Toggle label="Vista o diferenciador especial" value={factors.specialView} onChange={v => setF("specialView", v)}
                hint="Mar, parque, altura, arquitectura icónica…" />
            </div>
          </div>
        </div>

        {/* ── OUTPUT ──────────────────────────────────────────────────────────── */}
        {!selectedDistrict ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", color: C.muted }}>
            <MapPin size={18} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 13 }}>Seleccioná un distrito en el mapa para ver el análisis</span>
          </div>
        ) : (
          <>
            {/* District context */}
            <div style={{ background: C.surface, borderRadius: 2, padding: "10px 16px", marginBottom: 24, fontSize: 12, color: C.inkSoft, fontStyle: "italic", borderLeft: `3px solid ${TREND_COLOR[selectedDistrict.trend]}` }}>
              <strong style={{ fontStyle: "normal", color: C.ink }}>{selectedDistrict.name}</strong> · {selectedDistrict.desc}
            </div>

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
              {[
                { label: "Velocidad estimada", value: velocity ? `${velocity.toFixed(1)} u/mes` : "—", color: velocityColor, sub: selectedDistrict ? `Base: ${selectedDistrict.base} u/mes` : "" },
                { label: "Absorción total", value: absMonths ? `${absMonths} meses` : "—", color: C.ink, sub: absMonths ? `${Math.round(absMonths / 12 * 10) / 10} años` : "" },
                { label: "Score narrativo", value: `${storyScore}/100`, color: storyScore >= 70 ? C.green : storyScore >= 45 ? C.ochre : C.brick, sub: storyScore >= 70 ? "Diferenciado" : storyScore >= 45 ? "Moderado" : "Débil" },
                { label: "Revenue bruto est.", value: revenueEst ? `USD ${revenueEst}M` : "—", color: C.navy, sub: "85m² promedio" },
              ].map(k => (
                <div key={k.label} style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "14px 16px" }}>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.color, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts: absorción + tornado side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
              {/* Absorption chart */}
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Curva de absorción proyectada
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={absorption} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="absGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.cobalt} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={C.cobalt} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.lineSoft} />
                    <XAxis dataKey="mes" tick={{ fontSize: 9, fill: C.muted }} tickLine={false} interval={Math.floor(absorption.length / 6)} />
                    <YAxis tick={{ fontSize: 9, fill: C.muted }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="vendidas" name="Vendidas" stroke={C.cobalt} fill="url(#absGrad)" strokeWidth={2} dot={false} />
                    {factors.totalUnits && (
                      <ReferenceLine y={factors.totalUnits} stroke={C.green} strokeDasharray="4 2" strokeWidth={1.5}
                        label={{ value: "Total", fontSize: 9, fill: C.green, position: "right" }} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Tornado chart */}
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Sensibilidad de factores
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tornado} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.lineSoft} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} tickLine={false}
                      tickFormatter={v => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: C.inkSoft }} tickLine={false} axisLine={false} width={76} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="impact" name="Impacto" radius={[0, 2, 2, 0]}>
                      {tornado.map((entry, index) => (
                        <Cell key={index} fill={index === 0 ? C.cobalt : index === 1 ? C.lavender : index < 4 ? C.sky : C.surface} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Spider + secondary row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  Perfil del proyecto
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={spider}>
                    <PolarGrid stroke={C.line} />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: C.muted }} />
                    <Radar name="Proyecto" dataKey="value" stroke={C.cobalt} fill={C.cobalt} fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Comparables inline */}
              <div style={{ padding: "14px 16px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2 }}>
                <button onClick={() => setShowComps(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted, fontWeight: 600,
                    letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", width: "100%", padding: 0, marginBottom: showComps ? 12 : 0 }}>
                  {showComps ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Comparables ({comps.length})
                </button>
                {showComps && <ComparableTable comps={comps} setComps={setComps} />}
              </div>
            </div>

            {/* Fotos + Noticias side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
              <div style={{ padding: "14px 16px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2 }}>
                <button onClick={() => setShowPhotos(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted, fontWeight: 600,
                    letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", width: "100%", padding: 0, marginBottom: showPhotos ? 12 : 0 }}>
                  {showPhotos ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Image size={11} /> Fotos del entorno ({photos.filter(p => p.url).length})
                </button>
                {showPhotos && <PhotoGallery photos={photos} setPhotos={setPhotos} district={selectedDistrict} />}
              </div>
              <div style={{ padding: "14px 16px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2 }}>
                <button onClick={() => setShowNews(s => !s)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted, fontWeight: 600,
                    letterSpacing: "0.1em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", width: "100%", padding: 0, marginBottom: showNews ? 12 : 0 }}>
                  {showNews ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <Newspaper size={11} /> Noticias & contexto ({news.length})
                </button>
                {showNews && <NewsPanel news={news} setNews={setNews} />}
              </div>
            </div>

            {/* Alicia analysis */}
            <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 2, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Análisis de Alicia</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Validación con IA · mercado limeño</div>
                </div>
                <button onClick={runAnalysis} disabled={analyzing}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
                    background: analyzing ? C.surface : C.ink, color: analyzing ? C.muted : "#fff",
                    border: "none", borderRadius: 2, fontSize: 12, fontWeight: 600, cursor: analyzing ? "not-allowed" : "pointer",
                  }}>
                  {analyzing ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Analizando…</> : <><Sparkles size={13} /> Analizar con Alicia</>}
                </button>
              </div>
              {analysis ? (
                <div style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {analysis.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                    part.startsWith("**") && part.endsWith("**")
                      ? <strong key={i} style={{ color: C.ink }}>{part.slice(2, -2)}</strong>
                      : part
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.muted, padding: "16px 0", fontStyle: "italic" }}>
                  Completá los parámetros y hacé click en "Analizar con Alicia" para obtener validación de mercado.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
