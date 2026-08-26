import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { login as apiLogin, selectRole as apiSelectRole } from '../api/auth.api';

const AuthContext = createContext(null);

const INACTIVITY_MS = 30 * 60 * 1000;

function decodeTokenPayload(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

export function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

export function homeByRole(user) {
  if (!user) return '/login';
  if (user.role === 'operador') return user.mesaId ? `/mesas/${user.mesaId}/jura` : '/dashboard';
  return '/dashboard';
}

export const ROLE_LABELS = {
  admin_general:  'Administrador General',
  admin_sociedad: 'Administrador de Sociedad',
  socio:          'Criador',
  operador:       'Operador de Jura'
};

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  // Estado para el flujo de selección de rol (usuario con múltiples roles)
  const [pendingRoles,    setPendingRoles]    = useState(null); // string[] | null
  const [pendingTempToken, setPendingTempToken] = useState(null); // string | null

  const inactivityTimer = useRef(null);

  const logout = useCallback((redirectToLogin = true) => {
    clearTimeout(inactivityTimer.current);
    setToken(null);
    setUser(null);
    setPendingRoles(null);
    setPendingTempToken(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    if (redirectToLogin) window.location.href = '/login';
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => logout(true), INACTIVITY_MS);
  }, [logout]);

  useEffect(() => {
    if (!token) return;
    const EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    EVENTS.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [token, resetInactivityTimer]);

  useEffect(() => {
    if (token && !isTokenValid(token)) logout(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login ──────────────────────────────────────────────────────────────────
  // Retorna { requiresRoleSelection, roles } si hay múltiples roles,
  // o { user } si el login fue directo.
  const login = useCallback(async (dni, password) => {
    setLoading(true);
    try {
      const data = await apiLogin(dni, password);

      if (data.requiresRoleSelection) {
        // Guardar estado pendiente para que LoginPage muestre el selector
        setPendingRoles(data.roles);
        setPendingTempToken(data.tempToken);
        return { requiresRoleSelection: true, roles: data.roles };
      }

      // Login directo (un solo rol)
      setToken(data.token);
      setUser(data.user);
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      return { requiresRoleSelection: false, user: data.user };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Selección de rol (segundo paso del login multi-rol) ────────────────────
  const selectRole = useCallback(async (role) => {
    if (!pendingTempToken) throw new Error('No hay sesión pendiente de selección de rol');
    setLoading(true);
    try {
      const data = await apiSelectRole(role, pendingTempToken);
      setToken(data.token);
      setUser(data.user);
      setPendingRoles(null);
      setPendingTempToken(null);
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      return data.user;
    } finally {
      setLoading(false);
    }
  }, [pendingTempToken]);

  const hasRole = useCallback((...roles) => {
    return !!(user && roles.includes(user.role));
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      pendingRoles, pendingTempToken,
      login, logout, selectRole, hasRole,
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
