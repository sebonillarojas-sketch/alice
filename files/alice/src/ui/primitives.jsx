// primitives.jsx — primitivas visuales compartidas del cockpit ALICE.
//
// Componentes de presentación puros (sólo dependen de los tokens `C`). Se extrajeron
// de HyggeOS.jsx para que los módulos grandes puedan reusarlos sin duplicar estilos.

import React from "react";
import { C } from "./theme";

export const NavyRule = ({ width = 28 }) => (
  <div style={{ width, height: 2, backgroundColor: C.navy }} />
);

export const Eyebrow = ({ children, color = C.muted }) => (
  <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color, fontWeight: 500 }}>{children}</div>
);

export const fieldClass = "w-full px-3 py-2 text-[14px] outline-none";
export const fieldStyle = { backgroundColor: C.surface, border: `1px solid ${C.lineSoft}`, borderRadius: 2, color: C.ink };

export const SectionHead = ({ title, blurb, action, onAction }) => (
  <div className="mb-7">
    <NavyRule />
    <div className="mt-3 flex items-end justify-between gap-6 flex-wrap">
      <h2 className="text-[22px]" style={{ color: C.ink, fontWeight: 600, letterSpacing: "-0.012em" }}>{title}</h2>
      {action && <button onClick={onAction} className="text-[11px] tracking-[0.16em] uppercase inline-flex items-center gap-1.5 hover:opacity-60" style={{ color: C.ink, fontWeight: 500 }}>{action} →</button>}
    </div>
    {blurb && <p className="text-[13px] mt-2 max-w-2xl" style={{ color: C.inkSoft, lineHeight: 1.6 }}>{blurb}</p>}
  </div>
);

export const Panel = ({ children, className = "" }) => (
  <div className={"p-6 " + className} style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2 }}>{children}</div>
);

export const Hero = ({ eyebrow, code, intro }) => (
  <div className="mb-14">
    <NavyRule /><div className="mt-4"><Eyebrow>{eyebrow}</Eyebrow></div>
    <h1 className="text-[72px] leading-[0.95] mt-5" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.04em" }}>{code}</h1>
    <p className="text-[15px] mt-6 max-w-2xl" style={{ color: C.inkSoft, lineHeight: 1.65 }}>{intro}</p>
  </div>
);

export const KpiBar = ({ items }) => (
  <div className="grid" style={{ backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, borderRadius: 2, gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 120px), 1fr))` }}>
    {items.map((k, i) => (
      <div key={i} className="px-6 py-6" style={{ borderRight: i < items.length - 1 ? `1px solid ${C.lineSoft}` : "none" }}>
        <Eyebrow>{k.label}</Eyebrow>
        <div className="text-[28px] mt-3 mb-2" style={{ color: C.ink, fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1 }}>{k.value}</div>
        <div className="flex items-center gap-2 text-[11px]">
          {k.delta && <span style={{ color: k.positive ? C.cobalt : C.brick, fontWeight: 600 }}>{k.positive ? "↗" : "↘"} {k.delta}</span>}
          {k.sub && <span style={{ color: C.muted }}>{k.sub}</span>}
        </div>
      </div>
    ))}
  </div>
);
