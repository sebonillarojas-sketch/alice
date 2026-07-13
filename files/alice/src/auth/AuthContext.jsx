import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { USERS } from "./users.js";

const AuthContext = createContext(null);

// Map username → email for login form (keeps username-based UX)
const USERNAME_TO_EMAIL = Object.fromEntries(USERS.map(u => [u.username.toLowerCase(), u.email]));

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
  const [user, setUser] = useState(null);
  const [pwSetMeta, setPwSetMeta] = useState(false); // user_metadata.pw_set — vive en Supabase, cross-device
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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

  const login = useCallback(async (username, password) => {
    const trimmed = (username || "").trim().toLowerCase();
    const email = USERNAME_TO_EMAIL[trimmed];
    if (!email) return { ok: false, error: "Usuario o contraseña incorrectos" };

    const { error } = await supabase.auth.signInWithPassword({ email, password: (password || "").trim() });
    if (error) return { ok: false, error: "Usuario o contraseña incorrectos" };
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
