import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { login as apiLogin } from '../api/auth.api';

const AuthContext = createContext(null);

const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

/** Decodifica el payload del JWT sin verificar firma (solo para leer exp en cliente). */
function decodeTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

/** Devuelve true si el token existe y su campo exp aún no venció. */
export function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

/** Ruta home por rol, usada para redirigir tras login y evitar heredar ruta de otro usuario. */
export function homeByRole(user) {
  if (!user) return '/login';
  if (user.role === 'operador') return user.mesaId ? `/mesas/${user.mesaId}/jura` : '/dashboard';
  return '/dashboard';
}

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  const inactivityTimer = useRef(null);

  // ── Logout limpio ──────────────────────────────────────────────────────────
  const logout = useCallback((redirectToLogin = true) => {
    clearTimeout(inactivityTimer.current);
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    if (redirectToLogin) {
      // Forzar recarga completa para limpiar todo el estado de React Query, etc.
      window.location.href = '/login';
    }
  }, []);

  // ── Reiniciar temporizador de inactividad ──────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      logout(true);
    }, INACTIVITY_MS);
  }, [logout]);

  // ── Registrar eventos de actividad del usuario ─────────────────────────────
  useEffect(() => {
    if (!token) return;

    const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    EVENTS.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer(); // arrancar el temporizador al montar

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [token, resetInactivityTimer]);

  // ── Verificar expiración del token al montar (ej: refresh de página) ───────
  useEffect(() => {
    if (token && !isTokenValid(token)) {
      logout(true);
    }
  }, []); // solo al montar — los requests 401 se manejan en axiosClient

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (dni, password) => {
    setLoading(true);
    try {
      const data = await apiLogin(dni, password);
      setToken(data.token);
      setUser(data.user);
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const hasRole = useCallback((...roles) => {
    return !!(user && roles.includes(user.role));
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout, hasRole,
      isAuthenticated: !!token && isTokenValid(token)
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
