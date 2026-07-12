import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { USERS } from "./users.js";

const AuthContext = createContext(null);

const STORAGE_KEY = "hygge:auth:session";
const PW_KEY = (id) => `hygge:user:pw:${id}`;

// Returns the effective password for a user (localStorage override > hardcoded default)
function getEffectivePassword(user) {
  try {
    const stored = localStorage.getItem(PW_KEY(user.id));
    if (stored) return stored;
  } catch {}
  return user.password;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Restore session on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        const u = USERS.find(x => x.id === session.userId);
        if (u) {
          const { password, ...safe } = u;
          setUser(safe);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {}
    setLoaded(true);
  }, []);

  const login = useCallback((username, password) => {
    const trimmedUser = (username || "").trim().toLowerCase();
    const trimmedPass = (password || "").trim();
    const match = USERS.find(u => u.username.toLowerCase() === trimmedUser);
    if (!match || getEffectivePassword(match) !== trimmedPass) {
      return { ok: false, error: "Usuario o contraseña incorrectos" };
    }
    const { password: _pw, ...safe } = match;
    setUser(safe);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: match.id, ts: Date.now() }));
    } catch {}
    return { ok: true };
  }, []);

  const setOwnPassword = useCallback((userId, newPassword) => {
    try {
      localStorage.setItem(PW_KEY(userId), newPassword);
    } catch {}
  }, []);

  const hasSetOwnPassword = useCallback((userId) => {
    try { return !!localStorage.getItem(PW_KEY(userId)); } catch { return false; }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

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
