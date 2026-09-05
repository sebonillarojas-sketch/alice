// Alicia responde en markdown (listas, tablas, negritas, code). Hasta ahora el ERP
// lo pintaba crudo, con los asteriscos a la vista.
import { createContext, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const C = { ink: "#0A0B0F", muted: "#6B6863", line: "#D9D5CD", surface: "#E5E1D6" };

// OJO: react-markdown v9+ (instala la 10.x) YA NO pasa la prop `inline`, y el
// className tampoco sirve como discriminador: mdast-util-to-hast solo agrega
// `className` al <code> cuando la cerca trae lenguaje (```js), pero una cerca sin
// lenguaje o un bloque indentado también terminan en <pre><code> sin className.
// Por eso el `pre` marca "estoy dentro de un bloque" vía contexto, y `code` lo
// lee: si está dentro de un <pre> nunca lleva el estilo de chip inline, sin
// importar si trae className o no.
const DentroDePre = createContext(false);

export default function Markdown({ texto }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "0 0 8px", paddingLeft: 18 }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: "2px 0" }}>{children}</li>,
        pre: ({ children }) => (
          <pre style={{ background: C.surface, padding: 10, borderRadius: 2, overflowX: "auto", fontSize: 12, margin: "0 0 8px" }}>
            <DentroDePre.Provider value={true}>{children}</DentroDePre.Provider>
          </pre>
        ),
        code: ({ className, children }) => {
          const dentroDePre = useContext(DentroDePre);
          return (
            <code
              className={className}
              style={dentroDePre ? undefined : { background: C.surface, padding: "1px 4px", borderRadius: 2, fontSize: "0.92em" }}
            >{children}</code>
          );
        },
        // Las tablas del ERP pueden ser anchas: scrollean en su propio contenedor
        // en vez de estirar la burbuja.
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "0 0 8px" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12 }}>{children}</table>
          </div>
        ),
        th: ({ children }) => <th style={{ border: `1px solid ${C.line}`, padding: "3px 6px", textAlign: "left", color: C.muted, fontWeight: 700 }}>{children}</th>,
        td: ({ children }) => <td style={{ border: `1px solid ${C.line}`, padding: "3px 6px" }}>{children}</td>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: C.ink, textDecoration: "underline" }}>{children}</a>,
      }}
    >
      {texto || ""}
    </ReactMarkdown>
  );
}
