// visor 3D vivo del plano que estás editando: ambientes → piso + muros extruidos,
// muebles como volúmenes bajos. Reacciona a rooms/items/muro/altura en vivo.
// three/r3f/drei se cargan lazy (solo cuando abres el visor).
import { useMemo } from "react";
import { Shape, ExtrudeGeometry, DoubleSide } from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Edges, Grid, ContactShadows } from "@react-three/drei";
import { bbox, centroid } from "./geometry.js";

const C = { ink: "#3D4D59", paper: "#EFEDE8", muro: "#E7E4DE", piso: "#F4F2EE", verde: "#8AA678", verdeE: "#6f8a5e", line: "#C9C7C0", soft: "#9B998F" };
const H_MUEBLE = { cama: 0.55, sofa: 0.75, sillon: 0.75, comedor: 0.75, closet: 2.0, refri: 1.8, counter: 0.9, inodoro: 0.4, lavamanos: 0.85, ducha: 0.05, tina: 0.55, velador: 0.55, comoda: 0.9, escritorio: 0.75, "rack-tv": 0.5, "mesa-centro": 0.4 };
const esAbertura = (ref = "") => /puerta|ventana|vano/.test(ref);
const esVerde = (r) => r.tipo === "terraza" || /jardin|terraza|balcón|balcon/.test(r.name || "");

// prisma extruido de un polígono (metros, plano XZ), se levanta en +Y
function Prisma({ pts, height, base = 0, color, edge = C.ink, opacity = 1 }) {
  const geom = useMemo(() => {
    const s = new Shape();
    s.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: height, bevelEnabled: false, steps: 1 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [pts, height]);
  return (
    <mesh geometry={geom} position={[0, base, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} metalness={0} side={DoubleSide} transparent={opacity < 1} opacity={opacity} />
      <Edges threshold={15} color={edge} />
    </mesh>
  );
}

// muro = caja delgada a lo largo de una arista (a→b), grosor `muro`, alto `altura`
function Muro({ a, b, grosor, altura }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  if (L < 0.05) return null;
  return (
    <mesh position={[(a.x + b.x) / 2, altura / 2, (a.y + b.y) / 2]} rotation={[0, -Math.atan2(dy, dx), 0]} castShadow receiveShadow>
      <boxGeometry args={[L + grosor, altura, grosor]} />
      <meshStandardMaterial color={C.muro} roughness={0.9} />
      <Edges threshold={15} color={C.ink} />
    </mesh>
  );
}

function Escena({ rooms, items, muro, altura, cx, cy }) {
  const R = (r) => r.pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));   // recentrado
  const span = Math.max(1, ...rooms.map((r) => { const b = bbox(r.pts); return Math.max(b.maxX - b.minX, b.maxY - b.minY); }), altura);

  return (
    <group>
      <ambientLight intensity={0.8} />
      <directionalLight position={[span, altura + 12, span]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-span, altura, -span]} intensity={0.35} />
      <Grid args={[span * 3, span * 3]} position={[0, -0.02, 0]} cellSize={1} cellColor={C.line} sectionSize={5} sectionColor={C.soft} fadeDistance={span * 4} infiniteGrid={false} />

      {rooms.map((r) => {
        const pts = R(r);
        const verde = esVerde(r);
        return (
          <group key={r.id}>
            {/* piso del ambiente */}
            <Prisma pts={pts} height={0.12} base={-0.12} color={verde ? C.verde : (r.tipo === "core" ? "#3D4D59" : C.piso)} edge={verde ? C.verdeE : C.line} />
            {/* muros perimetrales (los interiores compartidos se ven dobles, ok para vista) */}
            {!verde && r.tipo !== "core" && pts.map((p, i) => (
              <Muro key={i} a={p} b={pts[(i + 1) % pts.length]} grosor={muro} altura={altura} />
            ))}
            {/* core sube como bloque sólido */}
            {r.tipo === "core" && <Prisma pts={pts} height={altura + 0.6} base={0} color="#3D4D59" edge="#1f1f1f" />}
          </group>
        );
      })}

      {/* muebles como volúmenes bajos */}
      {items.filter((t) => !esAbertura(t.ref)).map((t) => {
        const h = H_MUEBLE[(t.ref || "").replace(/-\d.*$/, "").split("-")[0]] || H_MUEBLE[t.ref] || 0.5;
        return (
          <mesh key={t.id} position={[t.x - cx, h / 2 + 0.12, t.y - cy]} rotation={[0, -(t.rot || 0) * Math.PI / 180, 0]} castShadow>
            <boxGeometry args={[t.w || 0.6, h, t.d || 0.6]} />
            <meshStandardMaterial color="#DCD8D0" roughness={0.85} />
            <Edges threshold={15} color={C.ink} />
          </mesh>
        );
      })}

      <ContactShadows position={[0, -0.01, 0]} scale={span * 2.4} far={altura + 4} blur={2.2} opacity={0.3} color={C.ink} />
    </group>
  );
}

export default function Vista3D({ rooms = [], items = [], muro = 0.15, altura = 2.4 }) {
  const all = rooms.flatMap((r) => r.pts);
  const c = all.length ? centroid(all) : { x: 0, y: 0 };
  const b = all.length ? bbox(all) : { minX: -5, maxX: 5, minY: -5, maxY: 5 };
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, altura, 4);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [span * 0.9, span * 0.85, span * 1.1], fov: 45, near: 0.1, far: span * 30 }}>
      <color attach="background" args={[C.paper]} />
      {rooms.length ? <Escena rooms={rooms} items={items} muro={muro} altura={altura} cx={c.x} cy={c.y} /> : null}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minPolarAngle={0.05} maxPolarAngle={Math.PI / 2.05} target={[0, altura / 2, 0]} />
    </Canvas>
  );
}
