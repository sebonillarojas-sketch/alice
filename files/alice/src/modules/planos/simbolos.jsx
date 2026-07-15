// símbolos 2D de mobiliario en planta (vista superior), calidad CAD, paramétricos a w×d (m).
// marco local centrado en (0,0); el caller aplica translate/rotate/scale. líneas non-scaling.
import { porId } from "./mobiliario.js";

const PAPER = "#EFEDE8";
const STROKE = "#3D4D59";
const SEL = "#F7643B";

export function Simbolo({ it: t, px, py, k, selected }) {
  const w = t.w, d = t.d, id = t.ref;
  const s = selected ? SEL : STROKE;
  // estilos base
  const SB = { fill: "#fff", stroke: s, strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" };      // cuerpo
  const LN = { fill: "none", stroke: s, strokeWidth: 1, vectorEffect: "non-scaling-stroke" };          // línea
  const TH = { fill: "none", stroke: s, strokeWidth: 0.7, vectorEffect: "non-scaling-stroke" };         // fina
  const r = (x, y, W, D, rx = 0.02) => <rect x={x} y={y} width={W} height={D} rx={rx} ry={rx} {...SB} />;
  let body;

  if (id.startsWith("cama")) {
    // colchón + edredón (línea de doblez) + almohadas
    const dob = -d / 2 + Math.min(0.55, d * 0.32);      // línea de vuelta del edredón
    const single = w < 1.2;
    const pW = single ? w - 0.24 : w / 2 - 0.16, pH = 0.34;
    body = (
      <>
        {r(-w / 2, -d / 2, w, d, 0.04)}
        <line x1={-w / 2} y1={dob} x2={w / 2} y2={dob} {...LN} />
        {single ? (
          <rect x={-pW / 2} y={-d / 2 + 0.08} width={pW} height={pH} rx={0.08} {...SB} />
        ) : (
          <>
            <rect x={-w / 2 + 0.12} y={-d / 2 + 0.08} width={pW} height={pH} rx={0.08} {...SB} />
            <rect x={0.04} y={-d / 2 + 0.08} width={pW} height={pH} rx={0.08} {...SB} />
          </>
        )}
        {/* pliegues del edredón */}
        <line x1={-w / 2 + 0.12} y1={dob + 0.12} x2={-w / 2 + 0.12} y2={d / 2 - 0.08} {...TH} />
        <line x1={w / 2 - 0.12} y1={dob + 0.12} x2={w / 2 - 0.12} y2={d / 2 - 0.08} {...TH} />
      </>
    );
  } else if (id.startsWith("sofa") || id === "sillon") {
    const arm = 0.16, back = 0.20, n = id === "sofa-3c" ? 3 : id === "sofa-2c" ? 2 : 1;
    const seatX = -w / 2 + arm, seatW = w - 2 * arm, seg = seatW / n;
    body = (
      <>
        {r(-w / 2, -d / 2, w, d, 0.08)}
        {/* respaldo */}
        <line x1={-w / 2 + arm} y1={-d / 2 + back} x2={w / 2 - arm} y2={-d / 2 + back} {...LN} />
        {/* brazos */}
        <line x1={-w / 2 + arm} y1={-d / 2 + back} x2={-w / 2 + arm} y2={d / 2 - 0.06} {...LN} />
        <line x1={w / 2 - arm} y1={-d / 2 + back} x2={w / 2 - arm} y2={d / 2 - 0.06} {...LN} />
        {/* cojines de asiento */}
        {Array.from({ length: n }, (_, i) => (
          <rect key={i} x={seatX + i * seg + 0.03} y={-d / 2 + back + 0.04} width={seg - 0.06} height={d - back - arm} rx={0.05} {...TH} />
        ))}
      </>
    );
  } else if (id.startsWith("comedor")) {
    const c = porId[id], n = c?.sillas === 6 ? 3 : 2, ch = 0.44, cd = 0.44, gap = w / n;
    body = (
      <>
        {Array.from({ length: n }, (_, i) => {
          const cx = -w / 2 + (i + 0.5) * gap;
          return (
            <g key={i}>
              <rect x={cx - ch / 2} y={-d / 2 - cd - 0.04} width={ch} height={cd} rx={0.08} {...SB} />
              <rect x={cx - ch / 2 + 0.05} y={-d / 2 - cd - 0.04} width={ch - 0.1} height={0.1} rx={0.04} {...TH} />
              <rect x={cx - ch / 2} y={d / 2 + 0.04} width={ch} height={cd} rx={0.08} {...SB} />
              <rect x={cx - ch / 2 + 0.05} y={d / 2 + cd - 0.06} width={ch - 0.1} height={0.1} rx={0.04} {...TH} />
            </g>
          );
        })}
        {r(-w / 2, -d / 2, w, d, 0.03)}
      </>
    );
  } else if (id === "counter") {
    body = (
      <>
        {r(-w / 2, -d / 2, w, d)}
        <line x1={-w / 2} y1={-d / 2 + 0.04} x2={w / 2} y2={-d / 2 + 0.04} {...TH} />
        {w >= 1.5 && (
          <>
            {/* lavadero */}
            <rect x={-w / 2 + 0.12} y={-0.16} width={0.42} height={0.32} rx={0.05} {...LN} />
            <circle cx={-w / 2 + 0.33} cy={-d / 2 + 0.12} r={0.03} {...TH} />
            {/* hornillas */}
            <rect x={0.08} y={-0.19} width={0.5} height={0.4} {...LN} />
            {[[0.21, -0.07], [0.45, -0.07], [0.21, 0.09], [0.45, 0.09]].map(([cx, cy], i) =>
              <circle key={i} cx={cx} cy={cy} r={0.07} {...TH} />)}
          </>
        )}
      </>
    );
  } else if (id === "refri") {
    body = (<>
      {r(-w / 2, -d / 2, w, d, 0.03)}
      <line x1={-w / 2} y1={d / 2 - 0.06} x2={w / 2} y2={d / 2 - 0.06} {...TH} />
      <line x1={w / 2 - 0.05} y1={-d / 2 + 0.08} x2={w / 2 - 0.05} y2={-0.02} {...LN} />
    </>);
  } else if (id === "lavadora") {
    body = (<>{r(-w / 2, -d / 2, w, d, 0.03)}<circle cx={0} cy={0.02} r={w / 3} {...LN} /><circle cx={0} cy={0.02} r={w / 5} {...TH} /></>);
  } else if (id === "inodoro") {
    body = (
      <>
        <rect x={-w / 2} y={-d / 2} width={w} height={0.19} rx={0.03} {...SB} />
        <ellipse cx={0} cy={-d / 2 + 0.16} rx={0.06} ry={0.04} {...TH} />
        <path d={`M ${-w / 2 + 0.05} ${-d / 2 + 0.19} q ${w / 2 - 0.05} -0.05 ${w - 0.1} 0 l -0.02 ${d - 0.28} q ${-(w - 0.14) / 2} 0.16 ${-(w - 0.14)} 0 z`} {...SB} />
        <ellipse cx={0} cy={0.02} rx={w / 2 - 0.11} ry={d / 2 - 0.24} {...TH} />
      </>
    );
  } else if (id === "lavamanos") {
    body = (<>{r(-w / 2, -d / 2, w, d, 0.03)}<ellipse cx={0} cy={0.03} rx={w / 2 - 0.09} ry={d / 2 - 0.09} {...LN} /><circle cx={0} cy={-d / 2 + 0.08} r={0.03} {...TH} /><circle cx={0} cy={0.03} r={0.025} {...TH} /></>);
  } else if (id === "ducha") {
    body = (<>
      {r(-w / 2, -d / 2, w, d)}
      <line x1={-w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} {...TH} />
      <line x1={w / 2} y1={-d / 2} x2={-w / 2} y2={d / 2} {...TH} />
      <circle cx={-w / 2 + 0.14} cy={-d / 2 + 0.14} r={0.07} {...LN} /><circle cx={0} cy={0} r={0.035} {...TH} />
    </>);
  } else if (id === "tina") {
    body = (<>{r(-w / 2, -d / 2, w, d, 0.06)}<rect x={-w / 2 + 0.1} y={-d / 2 + 0.1} width={w - 0.28} height={d - 0.2} rx={0.12} {...LN} /><circle cx={w / 2 - 0.12} cy={0} r={0.035} {...TH} /></>);
  } else if (id === "closet") {
    const nd = Math.max(2, Math.round(w / 0.5));
    body = (
      <>
        {r(-w / 2, -d / 2, w, d)}
        {/* barra de colgar (línea punteada) */}
        <line x1={-w / 2 + 0.06} y1={0} x2={w / 2 - 0.06} y2={0} {...TH} strokeDasharray="0.06 0.05" />
        {/* puertas corredizas */}
        {Array.from({ length: nd }, (_, i) => (
          <line key={i} x1={-w / 2 + (i + 1) * (w / nd)} y1={-d / 2} x2={-w / 2 + (i + 1) * (w / nd)} y2={-d / 2 + 0.05} {...TH} />
        ))}
      </>
    );
  } else if (id === "velador" || id === "comoda" || id === "escritorio" || id === "rack-tv" || id === "mesa-centro") {
    body = (<>{r(-w / 2, -d / 2, w, d, 0.02)}<rect x={-w / 2 + 0.05} y={-d / 2 + 0.05} width={w - 0.1} height={d - 0.1} rx={0.02} {...TH} /></>);
  } else if (id.startsWith("puerta")) {
    body = (
      <>
        <rect x={-w / 2 - 0.02} y={-d / 2 - 0.02} width={w + 0.04} height={d + 0.04} fill={PAPER} stroke="none" />
        {/* hoja */}
        <line x1={-w / 2} y1={0} x2={-w / 2} y2={-w} {...LN} />
        {/* barrido */}
        <path d={`M ${-w / 2} ${-w} A ${w} ${w} 0 0 1 ${w / 2} 0`} {...TH} />
        {/* jambas */}
        <line x1={-w / 2} y1={-d / 2} x2={-w / 2} y2={d / 2} {...LN} />
        <line x1={w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} {...LN} />
      </>
    );
  } else if (id.startsWith("ventana")) {
    body = (
      <>
        <rect x={-w / 2 - 0.02} y={-d / 2 - 0.02} width={w + 0.04} height={d + 0.04} fill={PAPER} stroke="none" />
        <line x1={-w / 2} y1={-d / 2} x2={w / 2} y2={-d / 2} {...LN} />
        <line x1={-w / 2} y1={d / 2} x2={w / 2} y2={d / 2} {...LN} />
        <line x1={-w / 2} y1={0} x2={w / 2} y2={0} {...TH} />
        <line x1={-w / 2} y1={-d / 2} x2={-w / 2} y2={d / 2} {...LN} />
        <line x1={w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} {...LN} />
      </>
    );
  } else if (id.startsWith("vano")) {
    body = (
      <>
        <rect x={-w / 2 - 0.02} y={-d / 2 - 0.02} width={w + 0.04} height={d + 0.04} fill={PAPER} stroke="none" />
        <line x1={-w / 2} y1={-d / 2} x2={-w / 2} y2={d / 2} {...LN} />
        <line x1={w / 2} y1={-d / 2} x2={w / 2} y2={d / 2} {...LN} />
      </>
    );
  } else {
    body = r(-w / 2, -d / 2, w, d, 0.02);
  }

  return (
    <g transform={`translate(${px} ${py}) rotate(${t.rot}) scale(${k})`}>
      {body}
      {selected && (
        <rect x={-w / 2 - 0.08} y={-d / 2 - 0.08} width={w + 0.16} height={d + 0.16}
          fill="none" stroke={SEL} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" strokeWidth={1.4} />
      )}
    </g>
  );
}
