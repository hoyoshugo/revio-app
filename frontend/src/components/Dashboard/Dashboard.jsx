import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Calendar, CreditCard,
  BarChart2, Inbox, XCircle, LogOut, Menu, X,
  Activity, BookOpen, AlertTriangle, Settings, ChevronDown,
  Beaker, Bot, Receipt
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { RevioIsotipo, RevioWordmark } from '../ui/Logo.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import MetricsOverview from './MetricsOverview.jsx';
import ConversationList from './ConversationList.jsx';
import ConversationDetail from './ConversationDetail.jsx';
import BookingsList from './BookingsList.jsx';
import OccupancyChart from './OccupancyChart.jsx';
import PaymentsPanel from './PaymentsPanel.jsx';
import OtaInbox from './OtaInbox.jsx';
import CancellationsPanel from './CancellationsPanel.jsx';
import WeeklyReport from '../Reports/WeeklyReport.jsx';
import HealthMonitor from './HealthMonitor.jsx';
import KnowledgeBase from './KnowledgeBase.jsx';
import EscalationsPanel from './EscalationsPanel.jsx';
import ConfigPanel from './ConfigPanel.jsx';
import SandboxPanel from './SandboxPanel.jsx';
import BillingPanel from './BillingPanel.jsx';

const navGroups = [
  {
    label: 'Principal',
    items: [
      { to: '/panel', label: 'Panel', icon: LayoutDashboard, end: true },
      { to: '/conversations', label: 'Conversaciones', icon: MessageSquare },
      { to: '/ota-inbox', label: 'Inbox OTA', icon: Inbox },
    ]
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/bookings', label: 'Reservas', icon: Calendar },
      { to: '/payments', label: 'Pagos', icon: CreditCard },
      { to: '/occupancy', label: 'Ocupación', icon: BarChart2 },
      { to: '/cancellations', label: 'Cancelaciones', icon: XCircle },
      { to: '/reports', label: 'Reportes', icon: BarChart2 },
    ]
  },
  {
    label: 'Agente IA',
    items: [
      { to: '/sandbox', label: 'Ensayo', icon: Beaker },
      { to: '/knowledge', label: 'Conocimiento', icon: BookOpen },
      { to: '/escalations', label: 'Escalaciones', icon: AlertTriangle },
    ]
  },
  {
    label: 'Sistema',
    items: [
      { to: '/health', label: 'Monitor', icon: Activity },
      { to: '/billing', label: 'Facturación', icon: Receipt },
      { to: '/config', label: 'Configuración', icon: Settings },
    ]
  }
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
          isActive ? 'rv-nav-active' : ''
        }`
      }
      style={({ isActive }) => isActive ? {} : { color: 'var(--text-2)' }}
      onMouseEnter={e => {
        if (!e.currentTarget.classList.contains('rv-nav-active')) {
          e.currentTarget.style.color = 'var(--text-1)';
          e.currentTarget.style.background = 'var(--card)';
        }
      }}
      onMouseLeave={e => {
        if (!e.currentTarget.classList.contains('rv-nav-active')) {
          e.currentTarget.style.color = 'var(--text-2)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

function BillingPage() {
  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{color:'var(--text-1)'}}>Facturación</h1>
        <p className="text-sm mt-0.5" style={{color:'var(--text-2)'}}>Estado de tu suscripción, plan y facturas</p>
      </div>
      <BillingPanel />
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [property, setProperty] = useState('all');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-60 flex flex-col
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0
        `}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <RevioLogo />
        </div>

        {/* Property selector */}
        <div className="px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <select
            value={property}
            onChange={e => setProperty(e.target.value)}
            className="rv-select text-xs"
          >
            <option value="all">Todas las propiedades</option>
            <option value="isla-palma">Isla Palma</option>
            <option value="tayrona">Tayrona</option>
          </select>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navGroups.map(group => (
            <div key={group.label}>
              <div
                className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-3)' }}
              >
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.to} {...item} onClick={() => setSidebarOpen(false)} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
            >
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>
                {user?.name || user?.email}
              </div>
              <div className="text-xs capitalize" style={{ color: 'var(--text-3)' }}>{user?.role}</div>
            </div>
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header
          className="px-4 py-3 flex items-center justify-between lg:px-6 flex-shrink-0"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <button
            className="lg:hidden p-1.5 rounded-lg"
            style={{ color: 'var(--text-2)' }}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <span className="text-xs hidden sm:block" style={{ color: 'var(--text-3)' }}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <ThemeToggle />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Routes>
            <Route path="/panel" element={<MetricsOverview property={property} />} />
            <Route path="/" element={<Navigate to="/panel" replace />} />
            <Route path="/dashboard" element={<Navigate to="/panel" replace />} />
            <Route path="/conversations" element={<ConversationList property={property} />} />
            <Route path="/conversations/:id" element={<ConversationDetail />} />
            <Route path="/ota-inbox" element={<OtaInbox property={property} />} />
            <Route path="/bookings" element={<BookingsList property={property} />} />
            <Route path="/payments" element={<PaymentsPanel property={property} />} />
            <Route path="/occupancy" element={<OccupancyChart property={property} />} />
            <Route path="/cancellations" element={<CancellationsPanel property={property} />} />
            <Route path="/reports" element={<WeeklyReport property={property} />} />
            <Route path="/health" element={<HealthMonitor />} />
            <Route path="/knowledge" element={<KnowledgeBase property={property} />} />
            <Route path="/escalations" element={<EscalationsPanel property={property} />} />
            <Route path="/sandbox" element={<SandboxPanel property={property} />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/config" element={<ConfigPanel property={property} />} />
            <Route path="/config/*" element={<ConfigPanel property={property} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

// Inline logo for sidebar
function RevioLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <RevioIsotipo size={30} />
      <div>
        <div className="text-base leading-none font-normal tracking-tight" style={{ color: 'var(--text-1)' }}>
          rev<span className="font-bold" style={{ color: 'var(--accent)' }}>io</span>
        </div>
        <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-3)' }}>
          Revenue intelligence
        </div>
      </div>
    </div>
  );
}
