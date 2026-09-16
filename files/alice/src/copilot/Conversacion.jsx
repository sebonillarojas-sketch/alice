// Las burbujas y el composer, en un solo lugar. El dock y el space `alicia`
// muestran la MISMA conversación: si cada uno la dibujara por su cuenta,
// cualquier ajuste habría que repetirlo en los dos y con el tiempo se
// separarían. La paleta y las proporciones (radios asimétricos, sombra de la
// burbuja del usuario, tamaños de fuente) son las mismas que ya usaba el hilo
// de AliciaView — esto no inventa un sistema visual nuevo, lo hereda.
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useCopiloto } from "./CopilotoProvider.jsx";
import Markdown from "./Markdown.jsx";
import TrazaTool from "./TrazaTool.jsx";

const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", ink: "#0A0B0F",
  muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6", bam: "#A855F7",
};

export default function Conversacion({ ancho = "dock" }) {
  const { mensajes, enviando, enviar } = useCopiloto();
  const [texto, setTexto] = useState("");
  const finRef = useRef(null);
  const scrollRef = useRef(null);
  const esFull = ancho === "full";

  // Auto-scroll sólo si ya estabas abajo: si subiste a leer algo, el stream no
  // te arrastra de vuelta. Mismo criterio que cubre humo-stream.mjs.
  useEffect(() => {
    const cont = scrollRef.current;
    if (!cont) return;
    const alFondo = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 120;
    if (alFondo) finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  const mandar = () => {
    if (!texto.trim() || enviando) return;
    enviar(texto);
    setTexto("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.paper }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto",
          padding: esFull ? "20px 15% 8px" : "16px 16px 8px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        {mensajes.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: 320, color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
            Preguntale algo a Alicia — tareas, agenda, un archivo, o simplemente
            cómo va el trabajo.
          </div>
        )}
        {mensajes.map((m, i) => {
          const esUsuario = m.role === "user";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: esUsuario ? "flex-end" : "flex-start", gap: 4 }}>
              <div
                style={{
                  maxWidth: esFull ? "72%" : "88%",
                  padding: "10px 14px",
                  borderRadius: esUsuario ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  backgroundColor: esUsuario ? C.bam : C.paper,
                  border: esUsuario ? "none" : `1px solid ${C.lineSoft}`,
                  color: esUsuario ? "#fff" : m.isError ? "#A85B5B" : C.ink,
                  fontSize: 13, lineHeight: 1.6,
                  boxShadow: esUsuario ? `0 2px 8px ${C.bam}30` : "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                {esUsuario ? (
                  // El texto del usuario NO se renderiza como markdown: lo que
                  // escribiste se ve tal cual lo escribiste.
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                ) : (
                  <>
                    {m.pasos?.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        {m.pasos.map(p => <TrazaTool key={p.id} tool={p.tool} ok={p.ok} input={p.input} />)}
                      </div>
                    )}
                    <Markdown texto={m.content} />
                    {m.streaming && <span style={{ opacity: 0.4 }}>▍</span>}
                  </>
                )}
              </div>
              {m.ts && (
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.04em", paddingInline: 4 }}>
                  {new Date(m.ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      <div style={{ padding: esFull ? "12px 15%" : "12px 16px", borderTop: `1px solid ${C.line}`, backgroundColor: C.paper, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px" }}>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
            placeholder={enviando ? "Alicia está trabajando…" : "Escribile a Alicia…"}
            rows={esFull ? 1 : 2}
            style={{ flex: 1, resize: "none", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit", border: "none", outline: "none", background: "none", color: C.ink, maxHeight: 120 }}
          />
          <button
            onClick={mandar}
            disabled={enviando || !texto.trim()}
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: enviando || !texto.trim() ? C.line : C.bam,
              cursor: enviando || !texto.trim() ? "default" : "pointer",
            }}
          >
            <Send size={14} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}
