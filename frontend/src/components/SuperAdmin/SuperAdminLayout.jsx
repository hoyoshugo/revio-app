import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, Package, AlertTriangle,
  BarChart2, UserPlus, LogOut, Menu, X, Percent, Shield
} from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';
import { RevioIsotipo } from '../ui/Logo.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import GlobalDashboard from './GlobalDashboard.jsx';
import ClientsManager from './ClientsManager.jsx';
import PlansManager from './PlansManager.jsx';
import ErrorsMonitor from './ErrorsMonitor.jsx';
import UsageRegistry from './UsageRegistry.jsx';
import OnboardingWizard from './OnboardingWizard.jsx';
import DiscountsManager from './DiscountsManager.jsx';

const navItems = [
  { to: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/clients', label: 'Clientes', icon: Users },
  { to: '/superadmin/plans', label: 'Planes', icon: Package },
  { to: '/superadmin/discounts', label: 'Descuentos', icon: Percent },
  { to: '/superadmin/errors', label: 'Errores', icon: AlertTriangle },
  { to: '/superadmin/usage', label: 'Uso y Costos', icon: BarChart2 },
  { to: '/superadmin/onboarding', label: 'Nuevo Cliente', icon: UserPlus },
];

export default function SuperAdminLayout() {
  const { admin, logout } = useSuperAdmin();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/superadmin/login');
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `} style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        <div className="p-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <RevioIsotipo size={28} />
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
              rev<span style={{ color: 'var(--accent)' }}>io</span>
            </div>
            <div className="text-[9px] uppercase tracking-wider flex items-center gap-1" style={{ color: 'var(--warning)' }}>
              <Shield className="w-2.5 h-2.5" /> Super Admin
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
                  isActive ? 'rv-nav-active' : ''
                }`
              }
              style={({ isActive }) => isActive ? {} : { color: 'var(--text-2)' }}
              onMouseEnter={e => { if (!e.currentTarget.classList.contains('rv-nav-active')) { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text-1)'; } }}
              onMouseLeave={e => { if (!e.currentTarget.classList.contains('rv-nav-active')) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; } }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' }}>
              {(admin?.email?.[0] || 'A').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>{admin?.email || 'Admin'}</div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>Superadmin</div>
            </div>
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="px-4 py-3 flex items-center gap-4 lg:px-6 flex-shrink-0"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <button className="lg:hidden p-1.5 rounded-lg" style={{ color: 'var(--text-2)' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <span className="text-xs hidden sm:block" style={{ color: 'var(--text-3)' }}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<GlobalDashboard />} />
            <Route path="/clients" element={<ClientsManager />} />
            <Route path="/plans" element={<PlansManager />} />
            <Route path="/discounts" element={<DiscountsManager />} />
            <Route path="/errors" element={<ErrorsMonitor />} />
            <Route path="/usage" element={<UsageRegistry />} />
            <Route path="/onboarding" element={<OnboardingWizard />} />
            <Route path="*" element={<Navigate to="/superadmin" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
