// masa volumétrica orbitable de la cabida — mismas dimensiones que la planta/corte 2D
// (metros reales · hPiso 2.8 · hSot 3.0). Se carga lazy: three/r3f/drei viven solo aquí.
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges, Grid, ContactShadows, Html } from "@react-three/drei";

const C = {
  ink: "#373737",
  peri: "#95ABE8",
  orange: "#F7643B",
  paper: "#EFEDE8",
  card: "#F4F2EE",
  line: "#C9C7C0",
  soft: "#9B998F",
};
const H_PISO = 2.8;
const H_SOT = 3.0;
const mono = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const fmt = (n, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// caja con aristas nítidas (estilo arquitectónico de una tinta)
function Caja({ size, position, color, edge = C.ink, opacity = 1, edgeOpacity = 1 }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color} roughness={0.85} metalness={0}
        transparent={opacity < 1} opacity={opacity}
      />
      <Edges threshold={15} color={edge} transparent={edgeOpacity < 1} opacity={edgeOpacity} />
    </mesh>
  );
}

function Escena({ e, frente, retiroFrontal, retiroLateral, pisos, pisosSot, azoteaTechada }) {
  const fondo = e.fondo || 1;
  const anchoEdif = Math.max(e.anchoEdif, 0.1);
  const fondoEdif = Math.max(e.fondoEdif, 0.1);
  const alturaTorre = pisos * H_PISO;
  const azW = anchoEdif * Math.min(Math.max(azoteaTechada, 0), 100) / 100;

  // edificio: centrado en X, arrancando a `retiroFrontal` desde la calle (z = -fondo/2)
  const edifCz = -fondo / 2 + retiroFrontal + fondoEdif / 2;
  // core en coords locales del edificio (0..anchoEdif) → mundo
  const coreCx = -anchoEdif / 2 + (e.core?.x || 0) + (e.core?.w || 0) / 2;

  return (
    <group>
      {/* luces */}
      <ambientLight intensity={0.75} />
      <directionalLight position={[frente, alturaTorre + 20, fondo]} intensity={1.15} castShadow
        shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-frente, alturaTorre, -fondo]} intensity={0.35} />

      {/* piso / grilla de referencia */}
      <Grid args={[Math.max(frente, fondo) * 2.4, Math.max(frente, fondo) * 2.4]}
        position={[0, 0.01, 0]} cellSize={1} cellColor={C.line}
        sectionSize={5} sectionColor={C.soft} fadeDistance={Math.max(frente, fondo) * 3}
        fadeStrength={1.5} infiniteGrid={false} />

      {/* plancha del lote (área libre) */}
      <Caja size={[frente, 0.18, fondo]} position={[0, -0.09, 0]} color={C.paper} edge={C.line} />

      {/* calle (barra oscura al frente) */}
      <Caja size={[frente * 1.02, 0.05, 1.2]} position={[0, 0.03, -fondo / 2 - 0.9]} color={C.ink} edge={C.ink} />
      <Html position={[0, 0.4, -fondo / 2 - 0.9]} center distanceFactor={Math.max(frente, fondo) * 1.1}
        style={{ fontFamily: mono, fontSize: 11, color: C.soft, whiteSpace: "nowrap", pointerEvents: "none" }}>
        calle · frente {fmt(frente, 1)} m
      </Html>

      {/* torre: un box por piso (las caras compartidas dan las líneas de nivel) */}
      {Array.from({ length: Math.max(pisos, 0) }, (_, i) => (
        <Caja key={i} size={[anchoEdif, H_PISO, fondoEdif]}
          position={[0, i * H_PISO + H_PISO / 2, edifCz]}
          color={i === 0 ? C.paper : C.card} edge={C.ink} />
      ))}

      {/* core de circulación (escalera + ascensor) — sobresale del techo */}
      <Caja
        size={[Math.max(e.core?.w || 0, 0.1), alturaTorre + H_PISO * 0.6, fondoEdif + 0.25]}
        position={[coreCx, (alturaTorre + H_PISO * 0.6) / 2, edifCz]}
        color={C.ink} edge="#1f1f1f" />

      {/* azotea techada (penthouse) — cubre azoteaTechada% de la huella */}
      {azW > 0.2 && (
        <Caja size={[azW, H_PISO, fondoEdif]}
          position={[-anchoEdif / 2 + azW / 2, alturaTorre + H_PISO / 2, edifCz]}
          color={C.peri} edge={C.ink} />
      )}

      {/* sótanos — caja translúcida bajo tierra, a huella completa del lote */}
      {pisosSot > 0 && (
        <Caja size={[frente, pisosSot * H_SOT, fondo]}
          position={[0, -(pisosSot * H_SOT) / 2 - 0.18, 0]}
          color={C.soft} edge={C.soft} opacity={0.16} edgeOpacity={0.5} />
      )}

      {/* etiquetas de altura */}
      <Html position={[frente / 2 + 1.5, alturaTorre / 2, edifCz]} center
        distanceFactor={Math.max(frente, fondo) * 1.1}
        style={{ fontFamily: mono, fontSize: 11, color: C.ink, whiteSpace: "nowrap", pointerEvents: "none" }}>
        {pisos} pisos · ±{fmt(alturaTorre + H_PISO, 1)} m
      </Html>
      {pisosSot > 0 && (
        <Html position={[frente / 2 + 1.5, -(pisosSot * H_SOT) / 2, 0]} center
          distanceFactor={Math.max(frente, fondo) * 1.1}
          style={{ fontFamily: mono, fontSize: 11, color: C.soft, whiteSpace: "nowrap", pointerEvents: "none" }}>
          {pisosSot} sót · −{fmt(pisosSot * H_SOT, 1)} m
        </Html>
      )}

      {/* sombra de contacto suave */}
      <ContactShadows position={[0, 0.02, 0]} scale={Math.max(frente, fondo) * 2}
        far={alturaTorre + 5} blur={2.4} opacity={0.28} color={C.ink} />
    </group>
  );
}

export default function Masa3D(props) {
  const span = Math.max(props.frente || 20, props.e?.fondo || 20, (props.pisos || 8) * H_PISO);
  return (
    <div style={{ width: "100%", height: 460, borderRadius: 3, overflow: "hidden", background: C.paper, border: `1px solid ${C.line}` }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 1.2, span * 1.0, span * 1.5], fov: 42, near: 0.1, far: span * 30 }}>
        <color attach="background" args={[C.paper]} />
        <Escena {...props} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08}
          minPolarAngle={0.1} maxPolarAngle={Math.PI / 2.05}
          target={[0, (props.pisos || 8) * H_PISO / 2, 0]} />
      </Canvas>
    </div>
  );
}
