// masa volumétrica orbitable de la cabida — metros reales (hPiso 2.8 · hSot 3.0).
// Si llega `lotePoly` (contorno real del CAD) extruye la forma real; si no, cae al
// rectángulo frente×fondo. three/r3f/drei viven solo aquí (carga lazy).
import { useMemo } from "react";
import { Shape, ExtrudeGeometry, DoubleSide } from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges, Grid, ContactShadows, Html } from "@react-three/drei";
import { bbox as polyBbox } from "../planos/geometry.js";
import { footprintReal } from "./loteReal.js";

const wh = (pts) => { const b = polyBbox(pts); return { w: b.maxX - b.minX, h: b.maxY - b.minY }; };

const C = {
  ink: "#373737", peri: "#95ABE8", orange: "#F7643B",
  paper: "#EFEDE8", card: "#F4F2EE", line: "#C9C7C0", soft: "#9B998F",
};
const H_PISO = 2.8;
const H_SOT = 3.0;
const mono = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// caja con aristas nítidas
function Caja({ size, position, color, edge = C.ink, opacity = 1, edgeOpacity = 1 }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} transparent={opacity < 1} opacity={opacity} />
      <Edges threshold={15} color={edge} transparent={edgeOpacity < 1} opacity={edgeOpacity} />
    </mesh>
  );
}

// prisma extruido de un polígono (pts en metros, plano XZ) — se levanta en +Y
function Prisma({ pts, height, base = 0, color, edge = C.ink, opacity = 1, edgeOpacity = 1 }) {
  const geom = useMemo(() => {
    const s = new Shape();
    s.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: height, bevelEnabled: false, steps: 1 });
    g.rotateX(-Math.PI / 2); // shape XY → suelo XZ, extrusión hacia +Y
    return g;
  }, [pts, height]);
  return (
    <mesh geometry={geom} position={[0, base, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} side={DoubleSide}
        transparent={opacity < 1} opacity={opacity} />
      <Edges threshold={15} color={edge} transparent={edgeOpacity < 1} opacity={edgeOpacity} />
    </mesh>
  );
}

function Luces({ span, h }) {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[span, h + 20, span]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-span, h, -span]} intensity={0.35} />
      <Grid args={[span * 2.4, span * 2.4]} position={[0, 0.01, 0]} cellSize={1} cellColor={C.line}
        sectionSize={5} sectionColor={C.soft} fadeDistance={span * 3} fadeStrength={1.5} infiniteGrid={false} />
    </>
  );
}

// —— masa desde la FORMA REAL del lote (polígono del CAD) ——
function EscenaPoly({ lotePoly, frenteIdx = 0, tipoLote, retiros, pisos, pisosSot }) {
  const alturaTorre = pisos * H_PISO;
  const { lote, footprint } = footprintReal(lotePoly, frenteIdx, tipoLote, retiros);
  const bb = wh(lote);
  const span = Math.max(bb.w, bb.h);

  return (
    <group>
      <Luces span={span} h={alturaTorre} />
      {/* plancha del lote (forma real, con ochavo si aplica) */}
      <Prisma pts={lote} height={0.18} base={-0.18} color={C.paper} edge={C.line} />
      {/* torre: un prisma por piso (las juntas dan las líneas de nivel) */}
      {Array.from({ length: Math.max(pisos, 0) }, (_, i) => (
        <Prisma key={i} pts={footprint} height={H_PISO} base={i * H_PISO}
          color={i === 0 ? C.paper : C.card} edge={C.ink} />
      ))}
      {/* sótanos a huella completa del lote */}
      {pisosSot > 0 && (
        <Prisma pts={lote} height={pisosSot * H_SOT} base={-(pisosSot * H_SOT) - 0.18}
          color={C.soft} edge={C.soft} opacity={0.16} edgeOpacity={0.5} />
      )}
      <Html position={[bb.w / 2 + 1.5, alturaTorre / 2, 0]} center distanceFactor={span * 1.1}
        style={{ fontFamily: mono, fontSize: 11, color: C.ink, whiteSpace: "nowrap", pointerEvents: "none" }}>
        {pisos} pisos · ±{fmt(alturaTorre + H_PISO, 1)} m
      </Html>
      {pisosSot > 0 && (
        <Html position={[bb.w / 2 + 1.5, -(pisosSot * H_SOT) / 2, 0]} center distanceFactor={span * 1.1}
          style={{ fontFamily: mono, fontSize: 11, color: C.soft, whiteSpace: "nowrap", pointerEvents: "none" }}>
          {pisosSot} sót · −{fmt(pisosSot * H_SOT, 1)} m
        </Html>
      )}
      <ContactShadows position={[0, 0.02, 0]} scale={span * 2} far={alturaTorre + 5} blur={2.4} opacity={0.28} color={C.ink} />
    </group>
  );
}

// —— masa desde el rectángulo frente×fondo (sin CAD) ——
function EscenaCaja({ e, frente, retiros, pisos, pisosSot, azoteaTechada }) {
  const rf = retiros?.frontal?.on ? retiros.frontal.v : 0;
  const ri = retiros?.izquierda?.on ? retiros.izquierda.v : 0;
  const fondo = e.fondo || 1;
  const anchoEdif = Math.max(e.anchoEdif, 0.1);
  const fondoEdif = Math.max(e.fondoEdif, 0.1);
  const alturaTorre = pisos * H_PISO;
  const azW = anchoEdif * Math.min(Math.max(azoteaTechada, 0), 100) / 100;
  const edifCz = -fondo / 2 + rf + fondoEdif / 2;
  const edifCx = -frente / 2 + ri + anchoEdif / 2;   // corrido según retiros izq/der
  const coreCx = edifCx - anchoEdif / 2 + (e.core?.x || 0) + (e.core?.w || 0) / 2;
  const span = Math.max(frente, fondo);

  return (
    <group>
      <Luces span={span} h={alturaTorre} />
      <Caja size={[frente, 0.18, fondo]} position={[0, -0.09, 0]} color={C.paper} edge={C.line} />
      <Caja size={[frente * 1.02, 0.05, 1.2]} position={[0, 0.03, -fondo / 2 - 0.9]} color={C.ink} edge={C.ink} />
      <Html position={[0, 0.4, -fondo / 2 - 0.9]} center distanceFactor={span * 1.1}
        style={{ fontFamily: mono, fontSize: 11, color: C.soft, whiteSpace: "nowrap", pointerEvents: "none" }}>
        calle · frente {fmt(frente, 1)} m
      </Html>
      {Array.from({ length: Math.max(pisos, 0) }, (_, i) => (
        <Caja key={i} size={[anchoEdif, H_PISO, fondoEdif]}
          position={[edifCx, i * H_PISO + H_PISO / 2, edifCz]} color={i === 0 ? C.paper : C.card} edge={C.ink} />
      ))}
      <Caja size={[Math.max(e.core?.w || 0, 0.1), alturaTorre + H_PISO * 0.6, fondoEdif + 0.25]}
        position={[coreCx, (alturaTorre + H_PISO * 0.6) / 2, edifCz]} color={C.ink} edge="#1f1f1f" />
      {azW > 0.2 && (
        <Caja size={[azW, H_PISO, fondoEdif]}
          position={[edifCx - anchoEdif / 2 + azW / 2, alturaTorre + H_PISO / 2, edifCz]} color={C.peri} edge={C.ink} />
      )}
      {pisosSot > 0 && (
        <Caja size={[frente, pisosSot * H_SOT, fondo]} position={[0, -(pisosSot * H_SOT) / 2 - 0.18, 0]}
          color={C.soft} edge={C.soft} opacity={0.16} edgeOpacity={0.5} />
      )}
      <Html position={[frente / 2 + 1.5, alturaTorre / 2, edifCz]} center distanceFactor={span * 1.1}
        style={{ fontFamily: mono, fontSize: 11, color: C.ink, whiteSpace: "nowrap", pointerEvents: "none" }}>
        {pisos} pisos · ±{fmt(alturaTorre + H_PISO, 1)} m
      </Html>
      {pisosSot > 0 && (
        <Html position={[frente / 2 + 1.5, -(pisosSot * H_SOT) / 2, 0]} center distanceFactor={span * 1.1}
          style={{ fontFamily: mono, fontSize: 11, color: C.soft, whiteSpace: "nowrap", pointerEvents: "none" }}>
          {pisosSot} sót · −{fmt(pisosSot * H_SOT, 1)} m
        </Html>
      )}
      <ContactShadows position={[0, 0.02, 0]} scale={span * 2} far={alturaTorre + 5} blur={2.4} opacity={0.28} color={C.ink} />
    </group>
  );
}

export default function Masa3D(props) {
  const usaPoly = Array.isArray(props.lotePoly) && props.lotePoly.length >= 3;
  const bb = usaPoly ? wh(props.lotePoly) : null;
  const span = usaPoly
    ? Math.max(bb.w, bb.h, (props.pisos || 8) * H_PISO)
    : Math.max(props.frente || 20, props.e?.fondo || 20, (props.pisos || 8) * H_PISO);
  const yTarget = (props.pisos || 8) * H_PISO / 2;

  return (
    <div style={{ width: "100%", height: 460, borderRadius: 3, overflow: "hidden", background: C.paper, border: `1px solid ${C.line}` }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 1.2, span * 1.0, span * 1.5], fov: 42, near: 0.1, far: span * 30 }}>
        <color attach="background" args={[C.paper]} />
        {usaPoly ? <EscenaPoly {...props} /> : <EscenaCaja {...props} />}
        <OrbitControls makeDefault enableDamping dampingFactor={0.08}
          minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.05} target={[0, yTarget, 0]} />
      </Canvas>
    </div>
  );
}
