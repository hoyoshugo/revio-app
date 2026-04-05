import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SuperAdminProvider, useSuperAdmin } from './context/SuperAdminContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';

// Lazy imports for code splitting
const LoginPage          = React.lazy(() => import('./components/Admin/LoginPage.jsx'));
const Dashboard          = React.lazy(() => import('./components/Dashboard/Dashboard.jsx'));
const SuperAdminLogin    = React.lazy(() => import('./components/SuperAdmin/SuperAdminLogin.jsx'));
const SuperAdminLayout   = React.lazy(() => import('./components/SuperAdmin/SuperAdminLayout.jsx'));
const LandingPage        = React.lazy(() => import('./pages/Landing/LandingPage.jsx'));
const RegisterPage       = React.lazy(() => import('./pages/Register/RegisterPage.jsx'));
const OnboardingWizard   = React.lazy(() => import('./pages/Onboarding/OnboardingWizard.jsx'));
const LegalPage          = React.lazy(() => import('./pages/Legal/LegalPage.jsx'));
const BookingPage        = React.lazy(() => import('./pages/BookingEngine/BookingPage.jsx'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
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
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Public landing ── */}
            <Route
              path="/"
              element={
                <AuthProvider>
                  <PublicOnlyRoute>
                    <LandingPage />
                  </PublicOnlyRoute>
                </AuthProvider>
              }
            />

            {/* ── Register & Onboarding (public) ── */}
            <Route path="/register" element={
              <AuthProvider>
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              </AuthProvider>
            } />

            <Route path="/onboarding" element={
              <AuthProvider>
                <OnboardingWizard />
              </AuthProvider>
            } />

            {/* ── Legal docs (public) ── */}
            <Route path="/legal/:slug" element={<LegalPage />} />
            <Route path="/legal" element={<Navigate to="/legal/terminos" replace />} />

            {/* ── Public booking engine ── */}
            <Route path="/book/:slug" element={<BookingPage />} />

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
                  <Routes>
                    <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
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
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
