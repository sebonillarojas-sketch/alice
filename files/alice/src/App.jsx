import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import HyggeOS from "./HyggeOS.jsx";
import { ALICIA_URL as BRAIN_ALICIA_URL } from "./lib/brain.js";

const C = {
  bg: "#EEEBE3",
  paper: "#F4F1EA",
  ink: "#0A0B0F",
  muted: "#6B6863",
  line: "#D9D5CD",
  navy: "#1E2A4A",
  cobalt: "#3D52D5",
};

const ALICE_BLOB_CSS = `
  @keyframes alice-morph      { 0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%} 34%{border-radius:60% 40% 42% 58%/60% 45% 55% 40%} 67%{border-radius:45% 55% 60% 40%/40% 62% 38% 60%} }
  @keyframes alice-morph-fast { 0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%} 34%{border-radius:60% 40% 42% 58%/60% 45% 55% 40%} 67%{border-radius:45% 55% 60% 40%/40% 62% 38% 60%} }
  @keyframes alice-morph-slow { 0%,100%{border-radius:42% 58% 65% 35%/45% 45% 55% 55%} 50%{border-radius:50% 50% 55% 45%/50% 50% 50% 50%} }
  @keyframes alice-float      { 0%,100%{transform:translateY(0px) scale(1)} 50%{transform:translateY(-14px) scale(1.015)} }
  @keyframes alice-dim        { 0%,100%{opacity:1} 50%{opacity:.65} }
  @keyframes alice-bounce-happy {
    0%,100%{transform:translateY(0) scaleX(1) scaleY(1)}
    30%{transform:translateY(-30px) scaleX(.92) scaleY(1.1)}
    50%{transform:translateY(-34px) scaleX(1.06) scaleY(.94)}
    70%{transform:translateY(0) scaleX(1.12) scaleY(.85)}
    85%{transform:translateY(0) scaleX(.96) scaleY(1.05)}
  }
  @keyframes alice-bounce-excited {
    0%,100%{transform:translateY(0) scale(1)}
    40%{transform:translateY(-38px) scale(1.08)}
    70%{transform:translateY(0) scale(.92)}
  }
  @keyframes alice-wobble {
    0%,100%{transform:rotate(0deg) translateX(0)}
    20%{transform:rotate(-9deg) translateX(-6px)}
    40%{transform:rotate(6deg) translateX(4px)}
    60%{transform:rotate(-5deg) translateX(-3px)}
    80%{transform:rotate(4deg) translateX(2px)}
  }
  @keyframes alice-shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-9px)}
    40%{transform:translateX(8px)}
    60%{transform:translateX(-6px)}
    80%{transform:translateX(5px)}
  }
  @keyframes alice-flop {
    0%,100%{transform:rotate(9deg) translateY(6px) scaleX(1.1) scaleY(.88)}
    50%{transform:rotate(11deg) translateY(9px) scaleX(1.12) scaleY(.86)}
  }
`;

const ALICE_STATES = {
  idle:      { bg: "#8b5cf6", anim: "alice-morph 8s ease-in-out infinite, alice-float 6s ease-in-out infinite" },
  listening: { bg: "#a78bfa", anim: "alice-morph-fast 4.5s ease-in-out infinite, alice-float 6s ease-in-out infinite" },
  thinking:  { bg: "#6d28d9", anim: "alice-morph-fast 3.2s ease-in-out infinite, alice-float 6s ease-in-out infinite, alice-dim 1.6s ease-in-out infinite" },
  happy:     { bg: "#c4b5fd", anim: "alice-morph 8s ease-in-out infinite, alice-bounce-happy 1.1s cubic-bezier(.36,1.4,.5,1) infinite" },
  excited:   { bg: "#c084fc", anim: "alice-morph 8s ease-in-out infinite, alice-bounce-excited .5s cubic-bezier(.36,1.4,.5,1) infinite" },
  confused:  { bg: "#9c93b8", anim: "alice-morph 5s ease-in-out infinite, alice-wobble 1.8s ease-in-out infinite" },
  error:     { bg: "#c2607e", anim: "alice-morph 6s ease-in-out infinite, alice-shake .5s ease-in-out infinite" },
  crashed:   { bg: "#7a7396", anim: "alice-morph-slow 10s ease-in-out infinite, alice-flop 3.5s ease-in-out infinite" },
};

function AliceBlob({ size = 100, state = "idle" }) {
  const s = ALICE_STATES[state] || ALICE_STATES.idle;
  return (
    <>
      <style>{ALICE_BLOB_CSS}</style>
      <div style={{
        width: size, height: size,
        background: s.bg,
        borderRadius: "42% 58% 65% 35%/45% 45% 55% 55%",
        animation: s.anim,
        transition: "background 0.5s ease",
        flexShrink: 0,
        position: "relative",
      }}>
        {state === "crashed" && (
          <div style={{ position: "absolute", left: "50%", top: "40%", transform: "translate(-50%,-50%)", display: "flex", gap: 20 }}>
            {[0,1].map(i => (
              <div key={i} style={{ position: "relative", width: 14, height: 14 }}>
                <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 3, background: "rgba(0,0,0,0.35)", borderRadius: 2, transform: "translateY(-50%) rotate(45deg)" }} />
                <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 3, background: "rgba(0,0,0,0.35)", borderRadius: 2, transform: "translateY(-50%) rotate(-45deg)" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ModalLeft({ step, title, sub, blobState = "idle" }) {
  return (
    <div className="ob-left" style={{
      width: 200, flexShrink: 0,
      backgroundColor: C.ink,
      padding: "32px 24px 28px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-between",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ width: "100%", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500 }}>
        ALICE · {step}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <AliceBlob size={100} state={blobState} />
      </div>

      <div style={{ width: "100%", textAlign: "center" }}>
        <div style={{ width: 24, height: 1, backgroundColor: "rgba(255,255,255,0.2)", margin: "0 auto 14px" }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "white", letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 8px" }}>
          {title}
        </h2>
        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, margin: 0 }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

function OnboardingOverlay({ children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      backgroundColor: "rgba(10,11,15,0.82)",
      backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {children}
    </div>
  );
}

const ALICIA_URL = BRAIN_ALICIA_URL;

function CalendarConsentModal({ user, onGrant }) {
  const [blobState, setBlobState] = useState("idle");
  const [connecting, setConnecting] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const avatarColor = user.color === "#0A0B0F" ? C.navy : (user.color || C.navy);

  // Escucha el aviso real del callback de Google (postMessage desde el popup)
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data && e.data.type === "google-connected") {
        setBlobState("happy");
        setTimeout(onGrant, 600); // recién acá marcamos el flag: conexión REAL confirmada
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onGrant]);

  const handleClick = () => {
    setErrMsg("");
    setConnecting(true);
    setBlobState("listening");
    // OAuth real de Google en popup — al terminar, el callback hace postMessage
    const w = 480, h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      `${ALICIA_URL}/auth/google?user=${encodeURIComponent(user.id)}`,
      "google-oauth",
      `width=${w},height=${h},left=${left},top=${top}`
    );
    if (!popup) { setConnecting(false); setBlobState("error"); setErrMsg("El navegador bloqueó la ventana. Permití popups y reintentá."); }
  };

  return (
    <OnboardingOverlay>
      <div className="ob-modal" style={{
        display: "flex",
        width: "100%", maxWidth: 560,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: "0 40px 100px rgba(10,11,15,0.5)",
      }}>
        <ModalLeft step="01 · Onboarding" title="Calendario" sub={"Brief diario · reuniones · sync con el equipo"} blobState={blobState} />

        <div className="ob-right" style={{ flex: 1, backgroundColor: C.bg, padding: "40px 32px" }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 28 }}>
            Paso 1 de 3
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            border: `1px solid ${C.line}`,
            borderRadius: 2,
            backgroundColor: C.paper,
            marginBottom: 24,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              backgroundColor: avatarColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
              letterSpacing: "0.02em",
            }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{user.firstName} {user.lastName}</div>
              <div style={{ fontSize: 10.5, color: C.muted }}>{user.email}</div>
            </div>
          </div>

          <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.75, margin: "0 0 28px" }}>
            ALICE necesita acceso a tu Google Calendar para el brief diario, reuniones y sync de eventos con el equipo.
          </p>

          <button
            onClick={handleClick}
            disabled={connecting}
            onMouseEnter={() => setBlobState(s => s === "idle" ? "excited" : s)}
            onMouseLeave={() => setBlobState(s => s === "excited" ? "idle" : s)}
            style={{
              width: "100%", padding: "13px 0",
              backgroundColor: C.ink, color: "white",
              border: "none", borderRadius: 2,
              fontSize: 12, fontWeight: 600, cursor: connecting ? "default" : "pointer",
              opacity: connecting ? 0.6 : 1,
              letterSpacing: "0.06em", textTransform: "uppercase",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "opacity 0.15s",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {connecting ? "Conectando con Google…" : "Conectar Google"}
            {!connecting && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            )}
          </button>

          {errMsg && <p style={{ fontSize: 11, color: "#c2607e", marginTop: 10, fontWeight: 600 }}>{errMsg}</p>}

          <p style={{ fontSize: 10, color: C.muted, marginTop: 14, lineHeight: 1.6, letterSpacing: "0.01em" }}>
            Solo lectura · ALICE nunca crea ni borra eventos sin confirmación explícita.
          </p>

        </div>
      </div>
    </OnboardingOverlay>
  );
}

const CAL_KEY = (userId) => `hygge:cal:granted:${userId}`;
const WA_KEY  = (userId) => `hygge:user:wa:${userId}`;

function WhatsAppModal({ user, onDone }) {
  const [phone, setPhone] = useState("");
  const [blobState, setBlobState] = useState("idle");
  const [errorCount, setErrorCount] = useState(0);
  const [errMsg, setErrMsg] = useState("");
  const avatarColor = user.color === "#0A0B0F" ? C.navy : (user.color || C.navy);

  const handleChange = (e) => {
    setPhone(e.target.value);
    if (e.target.value.trim()) setBlobState("listening");
    else setBlobState(errorCount >= 3 ? "crashed" : "idle");
    setErrMsg("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      const next = errorCount + 1;
      setErrorCount(next);
      setBlobState(next >= 3 ? "crashed" : "error");
      setErrMsg(next >= 3 ? "ALICE no puede continuar sin un número." : "Ingresá tu número de WhatsApp.");
      return;
    }
    setBlobState("happy");
    setTimeout(() => onDone(phone.trim()), 800);
  };

  const borderColor = blobState === "error" || blobState === "crashed" ? "#c2607e" : C.line;

  const inputStyle = {
    width: "100%", padding: "11px 13px",
    border: `1px solid ${borderColor}`, borderRadius: 2,
    backgroundColor: C.paper,
    fontSize: 13, color: C.ink,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <OnboardingOverlay>
      <div className="ob-modal" style={{
        display: "flex", width: "100%", maxWidth: 560,
        borderRadius: 2, overflow: "hidden",
        boxShadow: "0 40px 100px rgba(10,11,15,0.5)",
      }}>
        <ModalLeft step="02 · Onboarding" title="WhatsApp" sub={"Brief diario · alertas · comandos por voz"} blobState={blobState} />

        <div className="ob-right" style={{ flex: 1, backgroundColor: C.bg, padding: "38px 32px" }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 500, marginBottom: 26 }}>
            Paso 2 de 3
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 13px", border: `1px solid ${C.line}`,
            borderRadius: 2, backgroundColor: C.paper, marginBottom: 22,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              backgroundColor: avatarColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
            }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{user.firstName} {user.lastName}</div>
              <div style={{ fontSize: 10.5, color: C.muted }}>{user.email}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="tel"
              placeholder="+51 999 999 999"
              value={phone}
              onChange={handleChange}
              onFocus={() => { if (!phone.trim() && blobState === "idle") setBlobState("listening"); }}
              onBlur={() => { if (!phone.trim() && blobState === "listening") setBlobState("idle"); }}
              autoFocus
              style={inputStyle}
            />
            {errMsg && <div style={{ fontSize: 11, color: "#c2607e", letterSpacing: "0.01em", marginTop: -4 }}>{errMsg}</div>}
            <button
              type="submit"
              style={{
                width: "100%", padding: "13px 0", marginTop: 4,
                backgroundColor: C.ink, color: "white",
                border: "none", borderRadius: 2,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                letterSpacing: "0.06em", textTransform: "uppercase",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "opacity 0.15s", fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Vincular
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </form>

          <p style={{ fontSize: 10, color: C.muted, marginTop: 10, lineHeight: 1.6 }}>
            ALICE te enviará el brief diario a las 8am · podés cambiar el número en configuración.
          </p>
        </div>
      </div>
    </OnboardingOverlay>
  );
}

function SetPasswordModal({ user, onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [blobState, setBlobState] = useState("idle");
  const [errorCount, setErrorCount] = useState(0);
  const [errMsg, setErrMsg] = useState("");
  const avatarColor = user.color === "#0A0B0F" ? C.navy : (user.color || C.navy);

  const computeBlobFromFields = (p1, p2) => {
    if (!p1 && !p2) return errorCount >= 3 ? "crashed" : "idle";
    if (p1 && p2 && p1 === p2 && p1.length >= 8) return "happy";
    if (p1 || p2) return "listening";
    return "idle";
  };

  const handlePwChange = (val) => {
    setPw(val);
    setErrMsg("");
    if (blobState !== "error" && blobState !== "crashed") setBlobState(computeBlobFromFields(val, pw2));
    else if (val) setBlobState("listening");
  };

  const handlePw2Change = (val) => {
    setPw2(val);
    setErrMsg("");
    if (blobState !== "error" && blobState !== "crashed") setBlobState(computeBlobFromFields(pw, val));
    else if (val) setBlobState("listening");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pw.length < 8) {
      const next = errorCount + 1;
      setErrorCount(next);
      setBlobState(next >= 3 ? "crashed" : "error");
      setErrMsg(next >= 3 ? "ALICE está crasheada. Usá mínimo 8 caracteres." : "Mínimo 8 caracteres.");
      return;
    }
    if (pw !== pw2) {
      const next = errorCount + 1;
      setErrorCount(next);
      setBlobState(next >= 3 ? "crashed" : "error");
      setErrMsg(next >= 3 ? "ALICE no puede más. Las contraseñas no coinciden." : "Las contraseñas no coinciden.");
      return;
    }
    setBlobState("happy");
    setTimeout(() => onDone(pw), 800);
  };

  const isErr = blobState === "error" || blobState === "crashed";
  const inputStyle = {
    width: "100%", padding: "11px 14px",
    border: `1px solid ${isErr ? "#c2607e" : C.line}`, borderRadius: 2,
    backgroundColor: C.paper,
    fontSize: 13, color: C.ink,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none", boxSizing: "border-box",
    transition: "border-color 0.2s",
  };

  return (
    <OnboardingOverlay>
      <div className="ob-modal" style={{
        display: "flex",
        width: "100%", maxWidth: 560,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: "0 40px 100px rgba(10,11,15,0.5)",
      }}>
        <ModalLeft step="03 · Onboarding" title="Contraseña" sub={"Reemplaza la temporal · solo vos la sabés"} blobState={blobState} />

        <div className="ob-right" style={{ flex: 1, backgroundColor: C.bg, padding: "40px 32px" }}>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 28 }}>
            Paso 3 de 3
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
            border: `1px solid ${C.line}`,
            borderRadius: 2,
            backgroundColor: C.paper,
            marginBottom: 24,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              backgroundColor: avatarColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
            }}>
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{user.firstName} {user.lastName}</div>
              <div style={{ fontSize: 10.5, color: C.muted }}>{user.email}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="password" placeholder="Nueva contraseña (mín. 8 caracteres)" value={pw}
              onChange={e => handlePwChange(e.target.value)}
              onFocus={() => { if (blobState === "idle") setBlobState("listening"); }}
              autoFocus style={inputStyle} />
            <input type="password" placeholder="Confirmá la contraseña" value={pw2}
              onChange={e => handlePw2Change(e.target.value)}
              onFocus={() => { if (blobState === "idle") setBlobState("listening"); }}
              style={inputStyle} />
            {errMsg && <div style={{ fontSize: 11, color: "#c2607e", letterSpacing: "0.01em", marginTop: -4 }}>{errMsg}</div>}
            <button
              type="submit"
              style={{
                width: "100%", padding: "13px 0", marginTop: 4,
                backgroundColor: C.ink, color: "white",
                border: "none", borderRadius: 2,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                letterSpacing: "0.06em", textTransform: "uppercase",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "opacity 0.15s",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Guardar
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </OnboardingOverlay>
  );
}

function Gate() {
  const { user, loaded, setOwnPassword, hasSetOwnPassword } = useAuth();
  const [calGranted, setCalGranted] = useState(null);
  const [waSet, setWaSet]           = useState(null);
  const [pwSet, setPwSet]           = useState(null);

  useEffect(() => {
    if (user) {
      setCalGranted(localStorage.getItem(CAL_KEY(user.id)) === "1");
      setWaSet(localStorage.getItem(WA_KEY(user.id)) !== null);
      setPwSet(hasSetOwnPassword(user.id));
    } else {
      setCalGranted(null);
      setWaSet(null);
      setPwSet(null);
    }
  }, [user, hasSetOwnPassword]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>Cargando...</div>
      </div>
    );
  }
  if (!user) return <LoginScreen />;

  const handleGrant = () => {
    localStorage.setItem(CAL_KEY(user.id), "1");
    setCalGranted(true);
  };

  const handleWa = (phone) => {
    localStorage.setItem(WA_KEY(user.id), phone || "");
    setWaSet(true);
  };

  const handleSetPassword = (newPw) => {
    setOwnPassword(user.id, newPw);
    setPwSet(true);
  };

  // Onboarding obligatorio en orden: 01 Calendario → 02 WhatsApp → 03 Contraseña.
  // (null = flags aún no leídos → no flashear HyggeOS ni un paso equivocado)
  if (calGranted === null || waSet === null || pwSet === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.bg }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>Cargando...</div>
      </div>
    );
  }
  if (!calGranted) return <CalendarConsentModal user={user} onGrant={handleGrant} />;
  if (!waSet)      return <WhatsAppModal user={user} onDone={handleWa} />;
  if (!pwSet)      return <SetPasswordModal user={user} onDone={handleSetPassword} />;

  return <HyggeOS authUser={user} />;
}

// Auto-update: las SPAs viejas quedan en memoria tras cada deploy ("versión anterior"
// fue fuente constante de bugs fantasma el 13 jul). Chequea el bundle cada 5 min y
// recarga solo cuando hay uno nuevo.
function useAutoUpdate() {
  useEffect(() => {
    let current = null;
    const check = async () => {
      try {
        const html = await fetch("/", { cache: "no-store" }).then(r => r.text());
        const m = html.match(/assets\/index-[^"]+\.js/)?.[0] || null;
        if (current && m && m !== current) { window.location.reload(); return; }
        if (m) current = m;
      } catch { /* offline → reintenta en el próximo tick */ }
    };
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
}

export default function App() {
  useAutoUpdate();
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
