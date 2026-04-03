import React, { createContext, useContext, useState, useCallback } from 'react';

const SuperAdminContext = createContext(null);

const SA_API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'sa_token';

export function SuperAdminProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [admin, setAdmin] = useState(() => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (!t) return null;
    try {
      // Decode JWT payload without verifying signature (verification is server-side)
      const payload = JSON.parse(atob(t.split('.')[1]));
      return { email: payload.email, role: payload.role };
    } catch { return null; }
  });

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${SA_API}/api/sa/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenciales incorrectas');
    sessionStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setAdmin(data.user || data.admin || null);
    return data;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAdmin(null);
  }, []);

  const saFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${SA_API}/api/sa${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    if (res.status === 401) { logout(); throw new Error('Sesión expirada'); }
    return res;
  }, [token, logout]);

  return (
    <SuperAdminContext.Provider value={{ token, admin, login, logout, saFetch }}>
      {children}
    </SuperAdminContext.Provider>
  );
}

export function useSuperAdmin() {
  return useContext(SuperAdminContext);
}
