import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    // Pequeño delay para feedback visual de submit
    setTimeout(() => {
      const result = login(username, password);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
      }
      // Si ok, el AuthProvider cambia user → App muestra HyggeOS
    }, 200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: "#EEEBE3" }}>
      <div className="w-full max-w-[420px]">

        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div style={{ fontSize: 11, color: "#6B6863", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
            Hygge Holding
          </div>
          <div style={{ fontSize: 32, color: "#0A0B0F", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1 }}>
            ALICE
          </div>
          <div style={{ fontSize: 11, color: "#6B6863", marginTop: 8, fontStyle: "italic", letterSpacing: "0.02em" }}>
            Cockpit ejecutivo · ingresá con tu usuario
          </div>
        </div>

        {/* Card del login */}
        <form onSubmit={handleSubmit} style={{
          backgroundColor: "#F4F1EA",
          border: "1px solid #D9D5CD",
          borderRadius: 4,
          padding: 32,
        }}>

          <div className="mb-5">
            <label className="block">
              <span style={{ fontSize: 9, color: "#6B6863", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 6 }}>
                Usuario
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                className="w-full px-3 py-2.5 outline-none transition-colors focus:border-black"
                style={{
                  backgroundColor: "#EEEBE3",
                  border: "1px solid #D9D5CD",
                  borderRadius: 2,
                  fontSize: 14,
                  color: "#0A0B0F",
                }}
              />
            </label>
          </div>

          <div className="mb-5">
            <label className="block">
              <span style={{ fontSize: 9, color: "#6B6863", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 6 }}>
                Contraseña
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 outline-none transition-colors focus:border-black"
                style={{
                  backgroundColor: "#EEEBE3",
                  border: "1px solid #D9D5CD",
                  borderRadius: 2,
                  fontSize: 14,
                  color: "#0A0B0F",
                }}
              />
            </label>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2" style={{
              backgroundColor: "#A85B5B15",
              border: "1px solid #A85B5B40",
              borderRadius: 2,
              fontSize: 11,
              color: "#A85B5B",
              fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || submitting}
            className="w-full py-2.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{
              backgroundColor: "#0A0B0F",
              color: "#EEEBE3",
              borderRadius: 2,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {submitting ? "Ingresando..." : "Ingresar"}
          </button>

          <div className="mt-6 pt-5" style={{ borderTop: "1px solid #D9D5CD" }}>
            <div style={{ fontSize: 9, color: "#6B6863", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
              ¿No tenés acceso?
            </div>
            <div style={{ fontSize: 11, color: "#6B6863", lineHeight: 1.5 }}>
              Contactá a <a href="mailto:sebastian@hygge.pe" style={{ color: "#3D52D5", fontWeight: 600 }}>sebastian@hygge.pe</a> para que te asigne una cuenta.
            </div>
          </div>
        </form>

        <div className="mt-6 text-center" style={{ fontSize: 10, color: "#6B6863", letterSpacing: "0.04em" }}>
          v0.1.0 · MVP · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
