import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('mystica_token'));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('mystica_user');
    return u ? JSON.parse(u) : null;
  });

  function login(token, userData) {
    setToken(token);
    setUser(userData);
    localStorage.setItem('mystica_token', token);
    localStorage.setItem('mystica_user', JSON.stringify(userData));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('mystica_token');
    localStorage.removeItem('mystica_user');
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
