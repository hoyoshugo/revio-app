import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SuperAdminProvider, useSuperAdmin } from './context/SuperAdminContext.jsx';
import LoginPage from './components/Admin/LoginPage.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import SuperAdminLogin from './components/SuperAdmin/SuperAdminLogin.jsx';
import SuperAdminLayout from './components/SuperAdmin/SuperAdminLayout.jsx';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function SuperAdminRoute({ children }) {
  const { token } = useSuperAdmin();
  return token ? children : <Navigate to="/superadmin/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ---- Superadmin (auth separada) ---- */}
        <Route
          path="/superadmin/login"
          element={
            <SuperAdminProvider>
              <SuperAdminLogin />
            </SuperAdminProvider>
          }
        />
        <Route
          path="/superadmin/*"
          element={
            <SuperAdminProvider>
              <SuperAdminRoute>
                <SuperAdminLayout />
              </SuperAdminRoute>
            </SuperAdminProvider>
          }
        />

        {/* ---- Dashboard de clientes ---- */}
        <Route
          path="/*"
          element={
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
