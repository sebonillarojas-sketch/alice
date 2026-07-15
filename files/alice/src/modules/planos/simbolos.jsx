// símbolos 2D de mobiliario en planta (vista superior), calidad CAD, paramétricos a w×d (m).
// marco local centrado en (0,0); el caller aplica translate/rotate/scale. líneas non-scaling.
// REGLA DE COLOR BAM: todo en una sola tinta; solo vegetación (y anotaciones del plano)
// van en morado BAM. Aberturas (puertas/ventanas) se tratan como anotación → morado.
import { porId } from "./mobiliario.js";

const PAPER = "#FFFFFF";
const INK = "#373737";          // única tinta del plano
const MORADO = "#95ABE8";       // morado BAM: vegetación + anotaciones
const SEL = "#F7643B";

export function Simbolo({ it: t, px, py, k, selected }) {
  const w = t.w, d = t.d, id = t.ref;
  const abertura = id.startsWith("puerta") || id.startsWith("ventana") || id.startsWith("vano");
  const vegetal = id === "jardinera" || id === "maceta";
  const s = selected ? SEL : (abertura || vegetal) ? MORADO : INK;
  // estilos base
  const SB = { fill: PAPER, stroke: s, strokeWidth: 1.1, vectorEffect: "non-scaling-stroke" };   // cuerpo
  const LN = { fill: "none", stroke: s, strokeWidth: 0.9, vectorEffect: "non-scaling-stroke" };  // línea
  const TH = { fill: "none", stroke: s, strokeWidth: 0.6, vectorEffect: "non-scaling-stroke" };  // fina
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
  } else if (id === "silla" || id === "silla-ext") {
    body = (
      <>
        {r(-w / 2, -d / 2, w, d, 0.06)}
        <rect x={-w / 2 + 0.04} y={-d / 2} width={w - 0.08} height={0.09} rx={0.03} {...TH} />
      </>
    );
  } else if (id.startsWith("comedor") || id === "mesa-ext") {
    const c = porId[id], n = id === "mesa-ext" ? 1 : c?.sillas === 6 ? 3 : 2, ch = 0.44, cd = 0.44, gap = w / n;
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
  } else if (id === "cocina") {
    // UN layout de cocina paramétrico: counter (largo w) + lavadero + hornillas + refri.
    // t.hornillas (2|4) · t.refriW (m) · t.abierta solo cambia el ambiente, no el símbolo.
    const horn = t.hornillas ?? porId.cocina.hornillas;
    const refriW = t.refriW ?? porId.cocina.refriW;
    const runW = w - refriW;                        // counter útil (refri al extremo derecho)
    const sinkW = Math.min(0.42, runW * 0.3);
    const stoveW = horn >= 4 ? 0.55 : 0.32;
    const stoveX = runW / 2 - w / 2 - stoveW / 2 + runW * 0.22;
    const burners = horn >= 4
      ? [[-0.12, -0.08], [0.12, -0.08], [-0.12, 0.1], [0.12, 0.1]]
      : [[0, -0.08], [0, 0.1]];
    body = (
      <>
        {/* counter */}
        {r(-w / 2, -d / 2, runW, d)}
        <line x1={-w / 2} y1={-d / 2 + 0.04} x2={-w / 2 + runW} y2={-d / 2 + 0.04} {...TH} />
        {/* lavadero */}
        <rect x={-w / 2 + 0.1} y={-0.16} width={sinkW} height={0.32} rx={0.05} {...LN} />
        <circle cx={-w / 2 + 0.1 + sinkW / 2} cy={-d / 2 + 0.12} r={0.03} {...TH} />
        {/* hornillas */}
        <g transform={`translate(${stoveX + stoveW / 2} 0)`}>
          <rect x={-stoveW / 2} y={-0.19} width={stoveW} height={0.4} {...LN} />
          {burners.map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={0.07} {...TH} />)}
        </g>
        {/* refri al extremo (cuadrado con diagonal) */}
        <rect x={w / 2 - refriW} y={-d / 2} width={refriW} height={Math.min(d, refriW)} rx={0.03} {...SB} />
        <line x1={w / 2 - refriW} y1={-d / 2} x2={w / 2} y2={-d / 2 + Math.min(d, refriW)} {...TH} />
      </>
    );
  } else if (id === "lavanderia") {
    // lavadora (tambor) + poza de lavar en un solo símbolo
    const half = w / 2;
    body = (
      <>
        {r(-w / 2, -d / 2, half, d, 0.03)}
        <circle cx={-w / 2 + half / 2} cy={0.02} r={Math.min(half, d) / 3} {...LN} />
        <circle cx={-w / 2 + half / 2} cy={0.02} r={Math.min(half, d) / 5.5} {...TH} />
        {r(0, -d / 2, half, d, 0.03)}
        <rect x={0.08} y={-d / 2 + 0.08} width={half - 0.16} height={d - 0.16} rx={0.04} {...LN} />
        <circle cx={half / 2} cy={0} r={0.03} {...TH} />
      </>
    );
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
  } else if (id === "escritorio") {
    body = (
      <>
        {r(-w / 2, -d / 2, w, d, 0.02)}
        <rect x={-w / 2 + 0.05} y={-d / 2 + 0.05} width={w - 0.1} height={d - 0.1} rx={0.02} {...TH} />
        {/* silla del escritorio */}
        <rect x={-0.22} y={d / 2 + 0.05} width={0.44} height={0.44} rx={0.08} {...SB} />
      </>
    );
  } else if (id === "tumbona") {
    body = (
      <>
        {r(-w / 2, -d / 2, w, d, 0.06)}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={i} x1={-w / 2 + 0.06} y1={-d / 2 + 0.35 + i * (d - 0.5) / 5} x2={w / 2 - 0.06} y2={-d / 2 + 0.35 + i * (d - 0.5) / 5} {...TH} />
        ))}
        <line x1={-w / 2 + 0.04} y1={-d / 2 + 0.26} x2={w / 2 - 0.04} y2={-d / 2 + 0.26} {...LN} />
      </>
    );
  } else if (id === "jardinera") {
    // vegetación en morado BAM: caja + copas orgánicas
    const n = Math.max(2, Math.round(w / 0.45));
    body = (
      <>
        <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="none" {...LN} />
        {Array.from({ length: n }, (_, i) => {
          const cx = -w / 2 + (i + 0.5) * (w / n);
          const rr = Math.min(d * 0.42, 0.2) * (i % 2 ? 1 : 0.8);
          return (
            <g key={i}>
              <circle cx={cx} cy={0} r={rr} {...TH} />
              <circle cx={cx - rr * 0.4} cy={-rr * 0.3} r={rr * 0.55} {...TH} />
              <circle cx={cx + rr * 0.45} cy={rr * 0.25} r={rr * 0.5} {...TH} />
            </g>
          );
        })}
      </>
    );
  } else if (id === "maceta") {
    body = (
      <>
        <circle cx={0} cy={0} r={w / 2} {...LN} />
        <circle cx={-w * 0.15} cy={-w * 0.12} r={w * 0.28} {...TH} />
        <circle cx={w * 0.16} cy={w * 0.1} r={w * 0.24} {...TH} />
        <circle cx={0} cy={0} r={w * 0.1} {...TH} />
      </>
    );
  } else if (id === "velador" || id === "rack-tv" || id === "mesa-centro") {
    body = (<>{r(-w / 2, -d / 2, w, d, 0.02)}<rect x={-w / 2 + 0.05} y={-d / 2 + 0.05} width={w - 0.1} height={d - 0.1} rx={0.02} {...TH} /></>);
  } else if (id.startsWith("puerta")) {
    body = (
      <>
        <rect x={-w / 2 - 0.02} y={-d / 2 - 0.02} width={w + 0.04} height={d + 0.04} fill={PAPER} stroke="none" />
        {/* hoja */}
        <line x1={-w / 2} y1={0} x2={-w / 2} y2={-w} {...LN} />
        {/* barrido */}
        <path d={`M ${-w / 2} ${-w} A ${w} ${w} 0 0 1 ${w / 2} 0`} {...TH} strokeDasharray="0.07 0.05" />
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
