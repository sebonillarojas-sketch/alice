import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { USERS } from "./users.js";

const AuthContext = createContext(null);

// Map username → email for login form (keeps username-based UX)
const USERNAME_TO_EMAIL = Object.fromEntries(USERS.map(u => [u.username.toLowerCase(), u.email]));

// ── DEV bypass ──────────────────────────────────────────────────────────────
// Solo activo en `vite dev` (import.meta.env.DEV). En el build de producción DEV
// es false ⇒ este bloque queda muerto y jamás llega al bundle público. Permite
// abrir el ERP en local sin credenciales para revisar UI (popups, responsive).
const DEV_BYPASS = import.meta.env.DEV;
const DEV_USER = DEV_BYPASS
  ? (() => { const u = USERS[0]; return { ...u, initials: (u.firstName[0] + u.lastName[0]).toUpperCase() }; })()
  : null;

async function fetchProfile(supabaseUser) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", supabaseUser.id)
    .single();
  if (error || !data) return null;
  return {
    id: data.alice_id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    role: data.role,
    color: data.color,
    initials: data.initials,
    isAdmin: data.is_admin,
    isCEO: data.is_ceo,
    allowedSpaces: data.allowed_spaces,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEV_USER);
  const [pwSetMeta, setPwSetMeta] = useState(DEV_BYPASS); // dev: salta onboarding de password
  const [loaded, setLoaded] = useState(DEV_BYPASS);       // dev: cargado sin esperar a Supabase

  useEffect(() => {
    if (DEV_BYPASS) return; // dev: sin Supabase Auth, ya estamos logueados como sb
    // Restore existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user);
        if (profile) setUser(profile);
        setPwSetMeta(session.user.user_metadata?.pw_set === true);
      }
      setLoaded(true);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user);
        if (profile) setUser(profile);
        setPwSetMeta(session.user.user_metadata?.pw_set === true);
      } else {
        setUser(null);
        setPwSetMeta(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (identifier, password) => {
    const trimmed = (identifier || "").trim().toLowerCase();
    // Login por CORREO (decisión 13 jul 2026). El username viejo sigue funcionando como fallback.
    const email = trimmed.includes("@") ? trimmed : USERNAME_TO_EMAIL[trimmed];
    if (!email) return { ok: false, error: "Correo o contraseña incorrectos" };

    const { error } = await supabase.auth.signInWithPassword({ email, password: (password || "").trim() });
    if (error) return { ok: false, error: "Correo o contraseña incorrectos" };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const setOwnPassword = useCallback(async (userId, newPassword) => {
    // password real + marca pw_set en metadata (la señal que lee hasSetOwnPassword)
    await supabase.auth.updateUser({ password: newPassword, data: { pw_set: true } });
    setPwSetMeta(true);
  }, []);

  const hasSetOwnPassword = useCallback(() => pwSetMeta, [pwSetMeta]);

  return (
    <AuthContext.Provider value={{ user, login, logout, loaded, setOwnPassword, hasSetOwnPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
