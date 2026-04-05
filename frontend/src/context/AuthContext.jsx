import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY   = 'revio_token';
const USER_KEY    = 'revio_user';
const TENANT_KEY  = 'revio_tenant';
const PROPS_KEY   = 'revio_properties';
const CURPROP_KEY = 'revio_current_property';

const AuthContext = createContext(null);

function safeParse(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [token, setToken]           = useState(() => localStorage.getItem(TOKEN_KEY) || localStorage.getItem('mystica_token'));
  const [user, setUser]             = useState(() => safeParse(USER_KEY) || safeParse('mystica_user'));
  const [tenant, setTenant]         = useState(() => safeParse(TENANT_KEY));
  const [properties, setProperties] = useState(() => safeParse(PROPS_KEY) || []);
  const [currentProperty, setCurrentProperty] = useState(() => safeParse(CURPROP_KEY));
  const [isLoading, setIsLoading]   = useState(false);

  function login(newToken, userData, tenantData, propertiesData) {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    // Clean up legacy keys
    localStorage.removeItem('mystica_token');
    localStorage.removeItem('mystica_user');
    if (tenantData) {
      setTenant(tenantData);
      localStorage.setItem(TENANT_KEY, JSON.stringify(tenantData));
    }
    if (propertiesData && propertiesData.length > 0) {
      setProperties(propertiesData);
      localStorage.setItem(PROPS_KEY, JSON.stringify(propertiesData));
      setCurrentProperty(propertiesData[0]);
      localStorage.setItem(CURPROP_KEY, JSON.stringify(propertiesData[0]));
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setTenant(null);
    setProperties([]);
    setCurrentProperty(null);
    [TOKEN_KEY, USER_KEY, TENANT_KEY, PROPS_KEY, CURPROP_KEY,
     'mystica_token', 'mystica_user'].forEach(k => localStorage.removeItem(k));
  }

  function switchProperty(prop) {
    setCurrentProperty(prop);
    localStorage.setItem(CURPROP_KEY, JSON.stringify(prop));
  }

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('mystica_token');
    if (!t) return;
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user)        { setUser(data.user);        localStorage.setItem(USER_KEY, JSON.stringify(data.user)); }
        if (data.tenant)      { setTenant(data.tenant);    localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant)); }
        if (data.properties?.length) {
          setProperties(data.properties);
          localStorage.setItem(PROPS_KEY, JSON.stringify(data.properties));
          if (!currentProperty) {
            setCurrentProperty(data.properties[0]);
            localStorage.setItem(CURPROP_KEY, JSON.stringify(data.properties[0]));
          }
        }
      }
    } catch {}
  }, []);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const propertyId  = currentProperty?.id || user?.property_id;

  return (
    <AuthContext.Provider value={{
      token, user, tenant, properties, currentProperty, isLoading,
      login, logout, switchProperty, refreshUser, authHeaders, propertyId
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function PrivateRoute({ children, requiredRole }) {
  const { token, user } = useAuth();
  if (!token) {
    window.location.href = '/login';
    return null;
  }
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-3)' }}>
        Sin permisos para esta sección.
      </div>
    );
  }
  return children;
}
