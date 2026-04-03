import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Calendar, CreditCard,
  BarChart2, Inbox, XCircle, LogOut, Menu, X,
  Activity, BookOpen, AlertTriangle, Settings
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
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

const navItems = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/conversations', label: 'Conversaciones', icon: MessageSquare },
  { to: '/ota-inbox', label: 'Inbox OTA', icon: Inbox },
  { to: '/bookings', label: 'Reservas', icon: Calendar },
  { to: '/payments', label: 'Pagos', icon: CreditCard },
  { to: '/occupancy', label: 'Ocupación', icon: BarChart2 },
  { to: '/cancellations', label: 'Cancelaciones', icon: XCircle },
  { to: '/reports', label: 'Reportes', icon: BarChart2 },
  { to: '/health', label: 'Monitor', icon: Activity },
  { to: '/knowledge', label: 'Conocimiento', icon: BookOpen },
  { to: '/escalations', label: 'Escalaciones', icon: AlertTriangle },
  { to: '/config', label: 'Configuración', icon: Settings }
];

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
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-gray-900 border-r border-gray-800
        flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌊</span>
            <div>
              <div className="font-bold text-white text-sm">Mística AI</div>
              <div className="text-gray-500 text-xs">Agent Dashboard</div>
            </div>
          </div>
        </div>

        {/* Selector de propiedad */}
        <div className="px-3 py-3 border-b border-gray-800">
          <select
            value={property}
            onChange={e => setProperty(e.target.value)}
            className="w-full bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-mystica-blue"
          >
            <option value="all">Todas las propiedades</option>
            <option value="isla-palma">Mística Isla Palma</option>
            <option value="tayrona">Mística Tayrona</option>
          </select>
        </div>

        {/* Navegación */}
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
                    ? 'bg-mystica-blue/10 text-mystica-blue font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-800 cursor-pointer" onClick={handleLogout}>
            <div className="w-7 h-7 rounded-full bg-mystica-blue/20 flex items-center justify-center text-mystica-blue text-xs font-bold">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user?.name || user?.email}</div>
              <div className="text-gray-500 text-xs">{user?.role}</div>
            </div>
            <LogOut className="w-3.5 h-3.5 text-gray-500" />
          </div>
        </div>
      </aside>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between lg:px-6">
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Rutas */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<MetricsOverview property={property} />} />
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
            <Route path="/config" element={<ConfigPanel />} />
            <Route path="/config/:tab" element={<ConfigPanel />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
