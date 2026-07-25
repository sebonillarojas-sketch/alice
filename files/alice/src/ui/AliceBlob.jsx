// AliceBlob.jsx — el blob emocional de Alice para popups/modales del ERP.
//
// Estados: idle / listening / thinking / happy / excited / confused / error / crashed.
// `useModalBlob()` maneja la máquina de estados (3 errores seguidos → crashed).
// Extraído de HyggeOS.jsx; se usa en todos los modales del cockpit.

import { useState, useCallback } from "react";

const _BLOB_STYLE_ID = "hygge-blob-keyframes";
const BLOB_CSS = `
  @keyframes hb-morph      {0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%}34%{border-radius:60% 40% 42% 58%/60% 45% 55% 40%}67%{border-radius:45% 55% 60% 40%/40% 62% 38% 60%}}
  @keyframes hb-morph-slow {0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%}50%{border-radius:50% 50% 55% 45%/50% 50% 50% 50%}}
  @keyframes hb-float      {0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.01)}}
  @keyframes hb-dim        {0%,100%{opacity:1}50%{opacity:.6}}
  @keyframes hb-happy      {0%,100%{transform:translateY(0) scaleX(1) scaleY(1)}30%{transform:translateY(-18px) scaleX(.93) scaleY(1.1)}50%{transform:translateY(-20px) scaleX(1.06) scaleY(.92)}70%{transform:translateY(0) scaleX(1.1) scaleY(.86)}85%{transform:translateY(0) scaleX(.97) scaleY(1.04)}}
  @keyframes hb-excited    {0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-22px) scale(1.08)}70%{transform:translateY(0) scale(.93)}}
  @keyframes hb-wobble     {0%,100%{transform:rotate(0) translateX(0)}20%{transform:rotate(-8deg) translateX(-4px)}40%{transform:rotate(6deg) translateX(3px)}60%{transform:rotate(-5deg) translateX(-2px)}80%{transform:rotate(4deg) translateX(2px)}}
  @keyframes hb-shake      {0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}
  @keyframes hb-flop       {0%,100%{transform:rotate(9deg) translateY(5px) scaleX(1.1) scaleY(.88)}50%{transform:rotate(11deg) translateY(8px) scaleX(1.12) scaleY(.85)}}
`;
const BLOB_STATES_HG = {
  idle:      { bg: "#8b5cf6", anim: "hb-morph 8s ease-in-out infinite, hb-float 5s ease-in-out infinite" },
  listening: { bg: "#a78bfa", anim: "hb-morph 4.5s ease-in-out infinite, hb-float 5s ease-in-out infinite" },
  thinking:  { bg: "#6d28d9", anim: "hb-morph 3.2s ease-in-out infinite, hb-float 5s ease-in-out infinite, hb-dim 1.6s ease-in-out infinite" },
  happy:     { bg: "#c4b5fd", anim: "hb-morph 8s ease-in-out infinite, hb-happy 1s cubic-bezier(.36,1.4,.5,1) infinite" },
  excited:   { bg: "#c084fc", anim: "hb-morph 8s ease-in-out infinite, hb-excited .5s cubic-bezier(.36,1.4,.5,1) infinite" },
  confused:  { bg: "#9c93b8", anim: "hb-morph 5s ease-in-out infinite, hb-wobble 1.8s ease-in-out infinite" },
  error:     { bg: "#c2607e", anim: "hb-morph 6s ease-in-out infinite, hb-shake .5s ease-in-out infinite" },
  crashed:   { bg: "#7a7396", anim: "hb-morph-slow 10s ease-in-out infinite, hb-flop 3.5s ease-in-out infinite" },
};

export function ModalBlob({ state = "idle", size = 34 }) {
  if (!document.getElementById(_BLOB_STYLE_ID)) {
    const s = document.createElement("style");
    s.id = _BLOB_STYLE_ID;
    s.textContent = BLOB_CSS;
    document.head.appendChild(s);
  }
  const s = BLOB_STATES_HG[state] || BLOB_STATES_HG.idle;
  return (
    <div style={{
      width: size, height: size, borderRadius: "42% 58% 65% 35%/45% 45% 55% 55%",
      background: s.bg, animation: s.anim,
      transition: "background 0.5s ease", flexShrink: 0, position: "relative",
    }}>
      {state === "crashed" && (
        <div style={{ position: "absolute", top: "38%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", gap: 7 }}>
          {[0,1].map(i => (
            <div key={i} style={{ position: "relative", width: 7, height: 7 }}>
              <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1.5, background: "rgba(0,0,0,0.35)", borderRadius: 1, transform: "translateY(-50%) rotate(45deg)" }} />
              <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1.5, background: "rgba(0,0,0,0.35)", borderRadius: 1, transform: "translateY(-50%) rotate(-45deg)" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useModalBlob() {
  const [state, setState] = useState("idle");
  const [errors, setErrors] = useState(0);
  const onType = useCallback(() => setState(s => s === "crashed" ? "crashed" : "listening"), []);
  const onValid = useCallback(() => setState("happy"), []);
  const onError = useCallback(() => {
    setErrors(n => {
      const next = n + 1;
      setState(next >= 3 ? "crashed" : "error");
      return next;
    });
  }, []);
  const onHappy = useCallback((cb) => { setState("happy"); setTimeout(cb, 650); }, []);
  const reset = useCallback(() => { setState("idle"); setErrors(0); }, []);
  return { state, onType, onValid, onError, onHappy, reset };
}
