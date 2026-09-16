// Las burbujas y el composer, en un solo lugar. El dock y el space `alicia`
// muestran la MISMA conversación: si cada uno la dibujara por su cuenta,
// cualquier ajuste habría que repetirlo en los dos y con el tiempo se
// separarían. La paleta y las proporciones (radios asimétricos, sombra de la
// burbuja del usuario, tamaños de fuente) son las mismas que ya usaba el hilo
// de AliciaView — esto no inventa un sistema visual nuevo, lo hereda.
import { useCallback, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { useCopiloto } from "./CopilotoProvider.jsx";
import AliciaAvatar from "./AliciaAvatar.jsx";
import Markdown from "./Markdown.jsx";
import TrazaTool from "./TrazaTool.jsx";

const C = {
  bg: "#EEEBE3", paper: "#F4F1EA", ink: "#0A0B0F", inkSoft: "#2E2E33",
  muted: "#6B6863", line: "#D9D5CD", lineSoft: "#E5E1D6", bam: "#A855F7",
};

// Las cuatro preguntas de arranque, tal cual estaban en AliciaView. No son
// decoración: es lo primero que ve el CEO cada vez que abre el chat vacío.
const SUGERENCIAS = [
  "¿Qué tareas tengo pendientes?",
  "Crea una reunión con el equipo BAM",
  "¿Cómo va el proyecto DC01?",
  "Quiero revisar mis objetivos de crecimiento",
];

// El resultado de una acción legada (las del array `actions` que devuelve `done`,
// no las manos de la Fase 3). Vivía inline en AliciaView y se vino con las
// burbujas: si se quedaba allá, el hilo del dock renderizaba `msg.actions` como
// nada y el usuario no se enteraba de que Alicia había creado la tarea.
function ActionResult({ action }) {
  const icons = { create_task: "✅", create_event: "📅", add_alicia_note: "🧠", update_growth: "🎯", update_skills: "⚡", search_file: "🔍" };
  const labels = {
    create_task: `Tarea creada: "${action.title}"`,
    create_event: `Evento agendado: "${action.title}" el ${action.date} a las ${action.time}`,
    add_alicia_note: `Nota guardada en perfil`,
    update_growth: `Objetivos de crecimiento actualizados`,
    update_skills: `Skills actualizados`,
    search_file: `Búsqueda: "${action.query}"`,
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 2, backgroundColor: C.bam + "12", border: `1px solid ${C.bam}30`, fontSize: 11, color: C.bam, fontWeight: 500, margin: "2px 0" }}>
      <span>{icons[action.type] || "•"}</span>
      <span>{labels[action.type] || action.type}</span>
    </div>
  );
}

// `nombre` sólo lo pasa el space `alicia`, que es el único que conoce los
// perfiles (el saludo dice el nombre de pila de la persona con la que Alicia
// está hablando, que con el "ver como" del CEO no es siempre la logueada). El
// dock no tiene de dónde sacarlo, así que saluda sin nombre.
export default function Conversacion({ ancho = "dock", nombre = "" }) {
  const { mensajes, enviando, enviar, hiloFallo, borrador, setBorrador } = useCopiloto();
  const finRef = useRef(null);
  const esFull = ancho === "full";

  // ¿El usuario está mirando el fondo del hilo? Se registra en el evento de
  // scroll y NO midiendo dentro del effect: para cuando el effect corre, el
  // mensaje nuevo ya está en el DOM y `scrollHeight` creció, así que alguien que
  // estaba pegado al fondo mide "lejos" y no se lo volvería a seguir nunca más.
  // Basta un mensaje de unas pocas líneas para dispararlo. Esta cicatriz venía de
  // AliciaView; el hilo se mudó acá y el mecanismo tenía que venirse con él.
  const pegadoAlFondo = useRef(true);
  const soltarScroll = useRef(null);
  // Callback ref y no useRef + useEffect([]): el contenedor del hilo no existe
  // siempre en el primer render (el dock arranca cerrado y el space `alicia`
  // arranca detrás del gate de la API key), así que un effect con deps vacías
  // correría antes de que el nodo exista y el listener no se ataría nunca.
  const hiloRef = useCallback((nodo) => {
    soltarScroll.current?.();
    soltarScroll.current = null;
    if (!nodo) return;
    const onScroll = () => {
      pegadoAlFondo.current = nodo.scrollHeight - nodo.scrollTop - nodo.clientHeight < 100;
    };
    nodo.addEventListener("scroll", onScroll, { passive: true });
    soltarScroll.current = () => nodo.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll sólo si ya estabas abajo: si subiste a leer algo, el stream no
  // te arrastra de vuelta. Mismo criterio que cubre humo-stream.mjs (control
  // positivo y negativo).
  //
  // Sin `behavior: "smooth"` a propósito: a 60 repintados por segundo la
  // animación suave se reinicia en cada frame (no se ve suave, se ve temblando)
  // y además sus posiciones intermedias disparan eventos de scroll que apagarían
  // `pegadoAlFondo` a mitad de camino — o sea que el smooth sabotea la guarda de
  // acá arriba. Instantáneo es lo correcto para un feed que crece, y es lo que
  // hacen las terminales y los chats.
  useEffect(() => {
    if (pegadoAlFondo.current) finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes]);

  // `enviar` vacía el borrador por su cuenta: el estado es suyo ahora.
  const mandar = () => enviar(borrador);

  // Los tres puntitos: el turno arrancó pero todavía no llegó un solo token. En
  // cuanto hay texto, la burbuja en vivo con su cursor `▍` cuenta la misma
  // historia mejor, así que los puntitos se apagan y no quedan los dos a la vez.
  const ultimo = mensajes[mensajes.length - 1];
  const esperandoTexto = enviando && (!ultimo || ultimo.role !== "assistant" || !ultimo.content);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: C.paper }}>
      <div
        ref={hiloRef}
        style={{
          flex: 1, overflowY: "auto",
          padding: esFull ? "20px 15% 8px" : "16px 16px 8px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        {/* El hilo vive en el servidor: si no se pudo traer, lo que se ve es el
            caché del navegador y puede estar viejo. Callarlo es el síntoma de
            "Alicia no se acuerda" con otra causa. */}
        {hiloFallo && (
          <div style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: "2px 0" }}>
            No pude cargar el hilo — estás viendo una copia local.
          </div>
        )}

        {/* El hilo vacío: saludo, avatar grande y las cuatro preguntas de
            arranque, recuperados de AliciaView. En el dock (380px) es la misma
            cosa en chico y con los chips en columna: cuatro preguntas largas en
            fila ahí adentro se cortan en dos palabras por renglón. */}
        {mensajes.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: esFull ? 20 : 14, opacity: 0.7 }}>
            <AliciaAvatar size={esFull ? 56 : 40} state="idle" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: esFull ? 18 : 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
                Hola{nombre ? `, ${nombre}` : ""} 👋
              </div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: esFull ? 380 : 260 }}>
                Soy Alicia. Puedo ayudarte a crear tareas, agendar reuniones, buscar archivos o simplemente conversar sobre cómo va el trabajo.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: esFull ? "row" : "column", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center", maxWidth: esFull ? 420 : 300 }}>
              {SUGERENCIAS.map(q => (
                <button key={q} onClick={() => enviar(q)} disabled={enviando}
                  style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.line}`, backgroundColor: C.paper, fontSize: 12, color: C.inkSoft, cursor: enviando ? "default" : "pointer", transition: "all 0.12s", maxWidth: "100%" }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = C.bam; e.currentTarget.style.color = C.bam; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.inkSoft; }}>
                  {q}
                </button>
              ))}
            </div>
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
              {!esUsuario && m.actions?.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingInline: 4 }}>
                  {m.actions.map((a, j) => <ActionResult key={j} action={a} />)}
                </div>
              )}
              {m.ts && (
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: "0.04em", paddingInline: 4 }}>
                  {new Date(m.ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  {/* El badge existe para avisar que el mensaje entró por OTRA puerta
                      (WhatsApp, voz). "app" y "copilot" son las dos formas en que el
                      ERP se identificó a lo largo del tiempo: "app" en los mensajes
                      viejos, "copilot" desde la Fase 2 (el cerebro lo necesita para el
                      tope de iteraciones y para turn_usage). Los dos significan "esto
                      salió de acá", así que ninguno lleva badge — no borres uno. */}
                  {m.channel && m.channel !== "app" && m.channel !== "copilot" && (
                    <span style={{ fontSize: 9, color: C.muted, marginLeft: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {m.channel === "whatsapp" ? "· whatsapp" : m.channel === "embodied" ? "· voz" : `· ${m.channel}`}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {esperandoTexto && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <AliciaAvatar size={26} state="thinking" />
            <div style={{ padding: "10px 14px", borderRadius: "12px 12px 12px 2px", backgroundColor: C.paper, border: `1px solid ${C.lineSoft}`, display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: C.bam, animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={finRef} />
      </div>

      {/* `bounce` se vino de AliciaView con los puntitos: es su único usuario y
          tiene que estar donde se monten, que ahora es también el dock. */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>

      <div style={{ padding: esFull ? "12px 15%" : "12px 16px", borderTop: `1px solid ${C.line}`, backgroundColor: C.paper, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", backgroundColor: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px" }}>
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
            placeholder={enviando ? "Alicia está trabajando…" : "Escribile a Alicia…"}
            rows={esFull ? 1 : 2}
            style={{ flex: 1, resize: "none", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit", border: "none", outline: "none", background: "none", color: C.ink, maxHeight: 120 }}
          />
          <button
            onClick={mandar}
            disabled={enviando || !borrador.trim()}
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0, border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: enviando || !borrador.trim() ? C.line : C.bam,
              cursor: enviando || !borrador.trim() ? "default" : "pointer",
            }}
          >
            <Send size={14} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}
