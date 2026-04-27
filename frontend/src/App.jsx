import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SuperAdminProvider, useSuperAdmin } from './context/SuperAdminContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ModulesProvider } from './hooks/useModules.jsx';
import ToastContainer from './components/Toast.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { installGlobalErrorHandlers } from './lib/notify.js';

// Lazy imports for code splitting
const LoginPage = React.lazy(() => import('./components/Admin/LoginPage.jsx'));
const Dashboard = React.lazy(() => import('./components/Dashboard/Dashboard.jsx'));
const SuperAdminLogin = React.lazy(() => import('./components/SuperAdmin/SuperAdminLogin.jsx'));
const SuperAdminLayout = React.lazy(() => import('./components/SuperAdmin/SuperAdminLayout.jsx'));
const LandingPage = React.lazy(() => import('./pages/Landing/LandingPage.jsx'));
const RegisterPage = React.lazy(() => import('./pages/Register/RegisterPage.jsx'));
const OnboardingWizard = React.lazy(() => import('./pages/Onboarding/OnboardingWizard.jsx'));
const LegalPage = React.lazy(() => import('./pages/Legal/LegalPage.jsx'));
const BookingPage = React.lazy(() => import('./pages/BookingEngine/BookingPage.jsx'));
const EcosystemVisualizer = React.lazy(() => import('./pages/Ecosystem/EcosystemVisualizer.jsx'));
const POSTerminalPage = React.lazy(() => import('./pages/POS/POSTerminalPage.jsx'));

function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

function SuperAdminRoute({ children }) {
  const { token } = useSuperAdmin();
  return token ? children : <Navigate to="/superadmin/login" replace />;
}

// Redirect authenticated users away from landing/login/register
function PublicOnlyRoute({ children }) {
  const { token } = useAuth();
  return token ? <Navigate to="/panel" replace /> : children;
}

export default function App() {
  // E-AGENT-11 H-FE-1: capturar unhandled rejections / errors globales
  // y mostrar toast al user en lugar de console.error silencioso.
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <ThemeProvider>
      <ToastContainer />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* ── Root: redirect to /login (marketing vive en alzio.co, no aqui) ── */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* ── Landing interna SPA (reservada — alzio.co es el marketing canonico) ── */}
            <Route
              path="/landing"
              element={
                <AuthProvider>
                  <PublicOnlyRoute>
                    <LandingPage />
                  </PublicOnlyRoute>
                </AuthProvider>
              }
            />

            {/* ── Register & Onboarding (public) ── */}
            <Route
              path="/register"
              element={
                <AuthProvider>
                  <PublicOnlyRoute>
                    <RegisterPage />
                  </PublicOnlyRoute>
                </AuthProvider>
              }
            />

            <Route
              path="/onboarding"
              element={
                <AuthProvider>
                  <OnboardingWizard />
                </AuthProvider>
              }
            />

            {/* ── Legal docs (public) ── */}
            <Route path="/legal/:slug" element={<LegalPage />} />
            <Route path="/legal" element={<Navigate to="/legal/terminos" replace />} />

            {/* ── Public booking engine ── */}
            <Route path="/book/:slug" element={<BookingPage />} />

            {/* ── Ecosystem visualizer ── */}
            <Route path="/ecosystem" element={<EcosystemVisualizer />} />

            {/* ── POS Terminal standalone (tablet mode) ── */}
            <Route
              path="/pos"
              element={
                <AuthProvider>
                  <ProtectedRoute>
                    <POSTerminalPage />
                  </ProtectedRoute>
                </AuthProvider>
              }
            />

            {/* ── Superadmin (auth separada) ── */}
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

            {/* ── Dashboard de clientes ── */}
            <Route
              path="/*"
              element={
                <AuthProvider>
                  <ModulesProvider>
                    <Routes>
                      <Route
                        path="/login"
                        element={
                          <PublicOnlyRoute>
                            <LoginPage />
                          </PublicOnlyRoute>
                        }
                      />
                      <Route
                        path="/*"
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </ModulesProvider>
                </AuthProvider>
              }
            />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
