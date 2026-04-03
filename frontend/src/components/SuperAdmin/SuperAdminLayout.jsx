import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, Package, AlertTriangle,
  BarChart2, UserPlus, LogOut, Menu, X
} from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';
import GlobalDashboard from './GlobalDashboard.jsx';
import ClientsManager from './ClientsManager.jsx';
import PlansManager from './PlansManager.jsx';
import ErrorsMonitor from './ErrorsMonitor.jsx';
import UsageRegistry from './UsageRegistry.jsx';
import OnboardingWizard from './OnboardingWizard.jsx';

const navItems = [
  { to: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/clients', label: 'Clientes', icon: Users },
  { to: '/superadmin/plans', label: 'Planes y Precios', icon: Package },
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
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-56 bg-gray-900 border-r border-gray-800
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🌊</span>
            <div>
              <div className="font-bold text-white text-sm">Mística Tech</div>
              <div className="text-cyan-500 text-xs font-medium">Super Admin</div>
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
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-cyan-600/15 text-cyan-400 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <div
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-800 cursor-pointer"
            onClick={handleLogout}
          >
            <div className="w-7 h-7 rounded-full bg-cyan-600/20 flex items-center justify-center text-cyan-400 text-xs font-bold">
              {(admin?.email?.[0] || 'A').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{admin?.email || 'Admin'}</div>
              <div className="text-gray-500 text-xs">Superadmin</div>
            </div>
            <LogOut className="w-3.5 h-3.5 text-gray-500" />
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4 lg:px-6">
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <span className="text-xs text-gray-500">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<GlobalDashboard />} />
            <Route path="/clients" element={<ClientsManager />} />
            <Route path="/plans" element={<PlansManager />} />
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
