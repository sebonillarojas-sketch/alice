// preamble de @vitejs/plugin-react — solo en DEV: permite importar módulos JSX
// (simbolos.jsx vía lamina.js) desde una página fuera del index.html del app.
// en el build de producción esta página es una entrada más de rollup y no lo necesita.
const $ = (id) => document.getElementById(id);
let mods = null, partis = [], elegido = null, amoblado = null;
let overrides = {};   // { unitId: { tipologiaId, banos } } — tweaks por bloque

async function boot() {
  if (import.meta.env.DEV) {
    const { default: RefreshRuntime } = await import(/* @vite-ignore */ "/@react-refresh");
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => (type) => type;
    window.__vite_plugin_react_preamble_installed__ = true;
  }
  $("status").textContent = "cargando módulos…";
  const [plantas, lamina, geometry, tipologias] = await Promise.all([
    import("./modules/planos/plantas.js"),
    import("./modules/planos/lamina.js"),
    import("./modules/planos/geometry.js"),
    import("./modules/planos/tipologias.js"),
  ]);
  mods = { plantas, lamina, geometry, tipologias };
  $("status").textContent = "módulos listos";
  footInfo();
  generarPartis();
}

$("tipo").addEventListener("change", () => {
  $("latWrap").style.display = $("tipo").value === "esquina" ? "flex" : "none";
  footInfo();
});
["frente", "fondo", "retiro", "retiroLat"].forEach((id) => $(id).addEventListener("input", footInfo));

// footprint según tipo de lote: medianera → retiro solo al frente;
// esquina → frente + calle lateral (borde derecho). los demás son colindantes.
function footprintActual() {
  const f = +$("frente").value, d = +$("fondo").value;
  const rf = +$("retiro").value;
  const rl = $("tipo").value === "esquina" ? +$("retiroLat").value : 0;
  // frente = borde inferior (y = d); calle lateral = borde derecho (x = f)
  const x1 = f - rl, y1 = d - rf;
  if (x1 < 4 || y1 < 4) return null;
  return [{ x: 0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: 0 }, { x: 0, y: 0 }];
}

function footInfo() {
  const foot = footprintActual();
  $("footInfo").textContent = foot
    ? `footprint ${mods.geometry.area(foot).toFixed(0)} m² · ${(foot[1].x - foot[0].x).toFixed(1)}×${foot[0].y.toFixed(1)} m`
    : "⚠ los retiros dejan el lote sin área construible";
}

// preview simple de un parti (bloques): tinta + core oscuro + etiquetas moradas
function partiSVG(p, W = 300, H = 200) {
  const all = p.rooms.flatMap((r) => r.pts);
  const xs = all.map((q) => q.x), ys = all.map((q) => q.y);
  const w = Math.max(...xs) - Math.min(...xs) || 1, h = Math.max(...ys) - Math.min(...ys) || 1;
  const k = Math.min((W - 16) / w, (H - 16) / h);
  const tx = (W - w * k) / 2 - Math.min(...xs) * k, ty = (H - h * k) / 2 - Math.min(...ys) * k;
  const T = (q) => `${(q.x * k + tx).toFixed(1)},${(q.y * k + ty).toFixed(1)}`;
  const polys = p.rooms.map((r) => {
    const c = r.pts.reduce((a, q) => ({ x: a.x + q.x / r.pts.length, y: a.y + q.y / r.pts.length }), { x: 0, y: 0 });
    const fill = r.tipo === "core" ? "#4A4A4A" : "#fff";
    const label = r.tipo === "core" ? "" :
      `<text x="${(c.x * k + tx).toFixed(1)}" y="${(c.y * k + ty).toFixed(1)}" font-family="monospace" font-size="9" fill="#95ABE8" text-anchor="middle" font-weight="700">${r.name}</text>`;
    return `<polygon points="${r.pts.map(T).join(" ")}" fill="${fill}" stroke="#373737" stroke-width="2"/>` + label;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="background:#fff;width:100%;height:auto;display:block">${polys}</svg>`;
}

function cfgDistrib() {
  return { udsPiso: +$("uds").value || 4, pct1: +$("p1").value || 0, pct2: +$("p2").value || 0, areaObjetivo: +$("area").value || 60 };
}

function generarPartis() {
  const foot = footprintActual();
  if (!foot) { $("status").textContent = "⚠ lote sin área construible"; return; }
  const t0 = performance.now();
  partis = mods.plantas.generarDistribuciones(foot, 0, cfgDistrib());
  $("status").textContent = `${partis.length} distribuciones en ${(performance.now() - t0).toFixed(0)} ms`;
  elegido = null; amoblado = null;
  $("amoblar").disabled = true;
  $("tituloPartis").style.display = "block";
  $("tituloRes").style.display = "none";
  $("resultado").style.display = "none";
  $("alicia").style.display = "none";
  const grid = $("partis");
  grid.innerHTML = "";
  partis.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.id = `parti-${p.id}`;
    card.innerHTML = `${partiSVG(p)}
      <h3><span class="n">${i + 1}</span> ${p.nombre} <span class="uds">${p.stats.uds} uds</span></h3>
      ${p.notas.map((n) => `<div class="nota">· ${n}</div>`).join("")}
      <button>elegir esta → 3 · tipologías</button>`;
    card.querySelector("button").addEventListener("click", () => {
      elegido = p;
      overrides = {};
      document.querySelectorAll("#partis .card").forEach((c) => c.classList.remove("sel"));
      card.classList.add("sel");
      $("amoblar").disabled = false;
      renderUnidades();
      amoblarElegido();
    });
    grid.appendChild(card);
  });
  $("unidades").style.display = "none";
}

// tipología POR BLOQUE: candidatas ordenadas por calce + tweak de baños, en vivo
function renderUnidades() {
  const box = $("unidades");
  box.innerHTML = `<span class="tag">bloques ▸</span>`;
  const unidades = elegido.res.units.filter((u) => !mods.plantas.esDeposito(u));
  unidades.forEach((u, i) => {
    const W = u.frame.ub - u.frame.ua;
    const cands = mods.tipologias.tipologiasCandidatas(u.areaReal, W, 4);
    const selId = u.tipologia?.id || cands[0].id;
    const wrap = document.createElement("label");
    wrap.innerHTML = `<b style="color:var(--orange)">${i + 1}</b>
      <span>${W.toFixed(1)}×${(u.frame.v1 - u.frame.v0).toFixed(1)} · ${u.areaReal.toFixed(0)} m²</span>
      <select data-k="tipologiaId">${cands.map((t) =>
        `<option value="${t.id}" ${t.id === selId ? "selected" : ""}>${t.dorms}D · ${t.nombre} · ~${t.area[1]} m²</option>`).join("")}
      </select>
      baños <select data-k="banos">${[1, 2, 3].map((n) =>
        `<option value="${n}" ${n === (mods.tipologias.porTipologia[selId]?.banos || 2) ? "selected" : ""}>${n}</option>`).join("")}
      </select>`;
    wrap.querySelectorAll("select").forEach((sel) => sel.addEventListener("change", () => {
      overrides[u.id] = {
        tipologiaId: wrap.querySelector('[data-k="tipologiaId"]').value,
        banos: parseInt(wrap.querySelector('[data-k="banos"]').value),
      };
      amoblarElegido();
    }));
    box.appendChild(wrap);
  });
  box.style.display = "flex";
}

function amoblarElegido() {
  if (!elegido) return;
  const t0 = performance.now();
  amoblado = mods.plantas.amoblarParti(elegido, { nse: $("nse").value, terraza: $("terr").checked }, overrides);
  $("status").textContent = `amoblado en ${(performance.now() - t0).toFixed(0)} ms`;
  const svg = mods.lamina.laminaSVG({ rooms: amoblado.rooms, items: amoblado.items, muro: 0.15 }, {
    proyecto: `${elegido.nombre}`, tipo: "Edificio Multifamiliar",
    ubicacion: `lote ${$("tipo").value} · ${$("frente").value}×${$("fondo").value} m`,
    cliente: "—", responsable: "generador BAM", plano: "Planta típica", escala: "s/e", lamina: "T-01",
  });
  $("lam").innerHTML = svg;
  $("lam").querySelector("svg").addEventListener("click", () => {
    $("zoomIn").innerHTML = svg;
    $("zoom").showModal();
  });
  $("notas").innerHTML = amoblado.notas.map((n) => `· ${n}`).join("<br>");
  $("tituloRes").style.display = "block";
  $("resultado").style.display = "block";
  $("resultado").scrollIntoView({ behavior: "smooth" });
}

async function preguntarAlicia() {
  if (!amoblado) { $("status").textContent = "amuebla primero"; return; }
  const box = $("alicia");
  box.style.display = "block";
  box.textContent = "consultando a alicia…";
  try {
    const res = await fetch("https://aliceai.bam.pe/api/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: "Sos Alicia, arquitecta senior de BAM (vivienda multifamiliar en Lima). Evaluás una planta típica amoblada con criterio de diseño, RNE A.010/A.020 y mercado limeño. Respondé en máx. 6 líneas.",
        prompt: `Lote ${$("tipo").value} ${$("frente").value}×${$("fondo").value} m. Parti: ${elegido.nombre}. NSE ${$("nse").value}.\nResultado: ${amoblado.notas.join(" | ")}`,
        max_tokens: 500,
      }),
    });
    const data = await res.json();
    box.textContent = data.text || data.error || "sin respuesta";
  } catch (e) { box.textContent = "no se pudo consultar: " + e.message; }
}

$("gen").addEventListener("click", generarPartis);
$("amoblar").addEventListener("click", amoblarElegido);
$("nse").addEventListener("change", () => amoblado && amoblarElegido());
$("terr").addEventListener("change", () => amoblado && amoblarElegido());
$("ask").addEventListener("click", preguntarAlicia);
$("zoom").addEventListener("click", () => $("zoom").close());

boot();
