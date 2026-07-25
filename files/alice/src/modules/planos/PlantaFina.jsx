// Planta amueblada FINA (paso 3): toma un parti del esquema, lo amuebla con
// amoblarParti y lo dibuja en papel — muros finos, mobiliario (Simbolo) y
// rótulos ambiente + área. Estilo BAM (negro sobre papel, hairlines).
import { useMemo } from "react";
import { amoblarParti } from "./plantas.js";
import { Simbolo } from "./simbolos.jsx";
import { bbox as polyBbox, area as polyArea, centroid } from "./geometry.js";

const PAPER = "#F6F5F1", INK = "#2E2E33", WALL = "#2E2E33", MUT = "#8A8782";
const FILL = { core: "#E6E2D8", pasillo: "#EEEBE3", servicio: "#F1EDE5", unidad: "#FBFAF7", def: "#FBFAF7" };
const mono = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

export default function PlantaFina({ parti, brief = {} }) {
  const amob = useMemo(() => {
    try { return amoblarParti(parti, brief); } catch { return null; }
  }, [parti, brief]);

  if (!amob || !amob.rooms?.length) {
    return <div style={{ padding: 20, fontFamily: mono, fontSize: 11, color: MUT }}>
      No se pudo amueblar este parti (recorte sin distribución interna).
    </div>;
  }

  const { rooms, items } = amob;
  const allPts = rooms.flatMap((r) => r.pts);
  const b = polyBbox(allPts);
  const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
  const PAD = 42;
  const s = Math.min(660 / w, 480 / h);
  const W = w * s + PAD * 2, H = h * s + PAD * 2;
  const T = (p) => ({ x: PAD + (p.x - b.minX) * s, y: PAD + (p.y - b.minY) * s });
  const P = (pts) => pts.map(T).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillFor = (r) => FILL[r.tipo] || (r.unidad ? FILL.unidad : FILL.def);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", background: PAPER }}>
      {/* ambientes + muros finos */}
      {rooms.map((r, i) => {
        const c = centroid(r.pts), cs = T(c), a = polyArea(r.pts);
        const nm = (r.name || "").split(" · ")[0];
        const big = a * s * s;
        return (
          <g key={r.id || i}>
            <polygon points={P(r.pts)} fill={fillFor(r)} stroke={WALL}
              strokeWidth={r.tipo === "core" ? 1.3 : 0.7} strokeLinejoin="round" />
            {r.tipo === "core" && big > 240 && (
              <text x={cs.x} y={cs.y + 2} textAnchor="middle" fontFamily={mono} fontSize="6.5" fill={MUT}>CORE</text>
            )}
            {r.tipo !== "core" && big > 420 && (
              <>
                <text x={cs.x} y={cs.y - 1} textAnchor="middle" fontFamily={mono} fontSize="6.4"
                  fill={INK} letterSpacing="0.3">{nm.toUpperCase()}</text>
                <text x={cs.x} y={cs.y + 6.5} textAnchor="middle" fontFamily={mono} fontSize="5.4"
                  fill={MUT}>{a.toFixed(1)} m²</text>
              </>
            )}
          </g>
        );
      })}
      {/* mobiliario (reusa el renderer del editor) */}
      {items.map((t, i) => {
        const q = T({ x: t.x, y: t.y });
        return <Simbolo key={t.id || i} it={t} px={q.x} py={q.y} k={s} selected={false} />;
      })}
    </svg>
  );
}
