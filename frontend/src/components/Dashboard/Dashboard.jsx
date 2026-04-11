import React, { useState, lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Calendar, CreditCard,
  BarChart2, Inbox, XCircle, LogOut, Menu, X,
  Activity, BookOpen, AlertTriangle, Settings,
  Beaker, Bot, Receipt, TrendingUp, Users, BedDouble,
  ShoppingCart, Wallet, Wrench, CalendarDays, Sparkles,
  ChevronLeft, ChevronRight, Building2, Package
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useModules, RequireModule } from '../../hooks/useModules.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

// Existing components
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
const MonitorPage = lazy(() => import('./MonitorPage.jsx'));
import KnowledgeBase from './KnowledgeBase.jsx';
import PropertyKnowledgePanel from './PropertyKnowledgePanel.jsx';
import PropertyInfoPanel from './PropertyInfoPanel.jsx';
import RevenueIntelligence from './RevenueIntelligence.jsx';
import EscalationsPanel from './EscalationsPanel.jsx';
import ConfigPanel from './ConfigPanel.jsx';
import SandboxPanel from './SandboxPanel.jsx';
import BillingPanel from './BillingPanel.jsx';
import ConnectionsPanel from './ConnectionsPanel.jsx';

// New PMS components (lazy loaded)
const GanttCalendar     = lazy(() => import('./GanttCalendar.jsx'));
const GuestDetail       = lazy(() => import('./GuestDetail.jsx'));
const POSTerminal       = lazy(() => import('./POSTerminal.jsx'));
const WalletPanel       = lazy(() => import('./WalletPanel.jsx'));
const HousekeepingBoard = lazy(() => import('./HousekeepingBoard.jsx'));
const GuestsPanel       = lazy(() => import('./GuestsPanel.jsx'));
const AIConcierge       = lazy(() => import('./AIConcierge.jsx'));
const EventsPanel       = lazy(() => import('./EventsPanel.jsx'));
const RoomsManager      = lazy(() => import('./RoomsManager.jsx'));
const Reports           = lazy(() => import('./Reports.jsx'));
const ChannelManager    = lazy(() => import('./ChannelManager.jsx'));
const ChannelManagerHub = lazy(() => import('./ChannelManagerHub.jsx'));
const SettingsPage      = lazy(() => import('./Settings.jsx'));
const Inventory         = lazy(() => import('./Inventory.jsx'));
const TransportPanel    = lazy(() => import('./TransportPanel.jsx'));
import NotificationsBell from './NotificationsBell.jsx';

// Cada ítem/grupo declara qué módulo requiere para ser visible.
// El filtrado real lo hace `visibleNavGroups` según los módulos activos
// del tenant (`tenant_modules` en Supabase, vía hook useModules).
// Items sin `module` son siempre visibles (core del Agente IA).
const navGroups = [
  {
    label: 'Agente IA',
    items: [
      { to: '/panel',              label: 'Panel',          icon: LayoutDashboard, end: true },
      { to: '/conversations',      label: 'Conversaciones', icon: MessageSquare },
      { to: '/ai',                 label: 'AI Concierge',   icon: Sparkles },
      { to: '/sandbox',            label: 'Ensayo',         icon: Beaker },
      { to: '/knowledge',          label: 'Aprendizaje IA', icon: BookOpen },
      { to: '/property-knowledge', label: 'Info Propiedad', icon: Bot },
      { to: '/escalations',        label: 'Escalaciones',   icon: AlertTriangle },
    ],
  },
  {
    label: 'PMS',
    module: 'pms',
    items: [
      { to: '/gantt',        label: 'Calendario',   icon: CalendarDays },
      { to: '/rooms',        label: 'Habitaciones', icon: BedDouble },
      { to: '/guests',       label: 'Huéspedes',    icon: Users },
      { to: '/housekeeping', label: 'Housekeeping', icon: Wrench },
    ],
  },
  {
    label: 'Revenue',
    module: 'nfc_pos',
    items: [
      { to: '/pos',       label: 'POS Terminal',   icon: ShoppingCart, module: 'nfc_pos' },
      { to: '/wallets',   label: 'Billeteras NFC', icon: Wallet,       module: 'nfc_pos' },
      { to: '/inventory', label: 'Inventario',     icon: Package,      module: 'inventory' },
      { to: '/transport', label: 'Transporte',     icon: Package,      module: 'transport' },
      { to: '/payments',  label: 'Pagos',          icon: CreditCard,   module: 'payments' },
      { to: '/revenue',   label: 'Revenue Intel',  icon: TrendingUp,   module: 'revenue_intel' },
      { to: '/ota-inbox', label: 'Inbox OTA',      icon: Inbox,        module: 'channel_manager' },
    ],
  },
  {
    label: 'Canales',
    module: 'channel_manager',
    items: [
      { to: '/channel-manager', label: 'Channel Manager',   icon: Building2, module: 'channel_manager' },
      { to: '/channels',        label: 'Channels (legacy)', icon: Building2, module: 'channel_manager' },
    ],
  },
  {
    label: 'Informes',
    module: 'reports',
    items: [
      { to: '/bookings',      label: 'Reservas',      icon: Calendar },
      { to: '/occupancy',     label: 'Ocupación',     icon: BarChart2 },
      { to: '/cancellations', label: 'Cancelaciones', icon: XCircle },
      { to: '/reports',       label: 'Reportes',      icon: BarChart2 },
      { to: '/events',        label: 'Eventos',       icon: CalendarDays },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/health',      label: 'Monitor',       icon: Activity },
      { to: '/billing',     label: 'Facturación',   icon: Receipt,   module: 'billing' },
      { to: '/settings',    label: 'Configuración', icon: Settings },
    ],
  },
];

function NavItem({ to, label, icon: Icon, end, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-all duration-150 group ${
          isActive ? 'rv-nav-active' : ''
        } ${collapsed ? 'justify-center px-0' : ''}`
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
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
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
  const { user, logout, properties, currentProperty, switchProperty } = useAuth();
  const { hasModule, loaded: modulesLoaded } = useModules();

  // Whitelist de módulos con UI terminada (los demás existen en DB pero
  // no aparecen en el sidebar hasta que su UI esté lista).
  // Items sin `module` declarado son siempre visibles (core del Agente IA).
  const RELEASED_MODULES = ['revenue_agent'];

  const canShowModule = (moduleKey) =>
    RELEASED_MODULES.includes(moduleKey) && (hasModule?.(moduleKey) !== false);

  // Filtrar grupos y items del menú según módulos released + tenant_modules activos
  const visibleNavGroups = React.useMemo(() => {
    if (!modulesLoaded) return navGroups;
    return navGroups
      .map(group => {
        // Si el grupo entero tiene un module requerido, chequear whitelist
        if (group.module && !canShowModule(group.module)) return null;
        // Filtrar items individuales
        const items = group.items.filter(item => !item.module || canShowModule(item.module));
        if (items.length === 0) return null;
        return { ...group, items };
      })
      .filter(Boolean);
  }, [modulesLoaded, hasModule]);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [property, setProperty] = useState('all');

  function handleLogout() { logout(); navigate('/login'); }

  const sidebarWidth = collapsed ? 72 : 260;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 transition-all duration-200"
        style={{ width: sidebarWidth, background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Gradient brand section */}
        <div
          className="flex items-center gap-3 px-4 py-4 relative flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #818CF8 100%)',
            minHeight: 72
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', fontSize: 18 }}
          >
            🏨
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-white font-bold text-lg leading-none tracking-tight">revio</div>
              <div className="text-white/70 text-[10px] uppercase tracking-wider mt-0.5">Revenue Intelligence</div>
            </div>
          )}
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg z-10"
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}
          >
            {collapsed
              ? <ChevronRight className="w-3 h-3" />
              : <ChevronLeft className="w-3 h-3" />
            }
          </button>
        </div>

        {/* Property selector + group_name */}
        {!collapsed && (
          <div className="px-3 py-2 flex-shrink-0 space-y-1" style={{ borderBottom: '1px solid var(--border)' }}>
            <select
              value={currentProperty?.id || 'all'}
              onChange={e => {
                const p = properties?.find(x => x.id === e.target.value);
                if (p) switchProperty(p);
                setProperty(e.target.value);
              }}
              className="rv-select text-xs"
            >
              <option value="all">Todas las propiedades</option>
              {(properties || []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {currentProperty?.group_name && (
              <div className="text-[10px] px-1" style={{ color: 'var(--text-3)' }}>
                Grupo: {currentProperty.group_name}
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {visibleNavGroups.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <div
                  className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-3)' }}
                >
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.to} {...item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left ${collapsed ? 'justify-center' : ''}`}
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
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-1)' }}>
                  {user?.name || user?.email}
                </div>
                <div className="text-[10px] capitalize" style={{ color: 'var(--text-3)' }}>{user?.role}</div>
              </div>
            )}
            {!collapsed && <LogOut className="w-3.5 h-3.5 flex-shrink-0" />}
          </button>
        </div>
      </aside>

      {/* ── Mobile Sidebar ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-3 px-4 py-4"
              style={{ background: 'linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #818CF8 100%)', minHeight: 72 }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', fontSize: 18 }}>🏨</div>
              <div>
                <div className="text-white font-bold text-lg leading-none">revio</div>
                <div className="text-white/70 text-[10px] uppercase tracking-wider mt-0.5">Revenue Intelligence</div>
              </div>
              <button className="ml-auto text-white/80" onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
              {visibleNavGroups.map(group => (
                <div key={group.label}>
                  <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(item => (
                      <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header
          className="px-4 py-3 flex items-center justify-between flex-shrink-0 gap-3"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', height: 56 }}
        >
          <button
            className="lg:hidden p-1.5 rounded-lg flex-shrink-0"
            style={{ color: 'var(--text-2)' }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Property switcher */}
          {properties && properties.length > 1 && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
              <select
                value={currentProperty?.id || ''}
                onChange={e => {
                  const p = properties.find(x => x.id === e.target.value);
                  if (p) switchProperty(p);
                }}
                className="rv-select text-sm max-w-[180px]"
              >
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:block" style={{ color: 'var(--text-3)' }}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <NotificationsBell />
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Core */}
              <Route path="/panel" element={<MetricsOverview property={property} />} />
              <Route path="/" element={<Navigate to="/panel" replace />} />
              <Route path="/dashboard" element={<Navigate to="/panel" replace />} />
              <Route path="/conversations" element={<ConversationList property={property} />} />
              <Route path="/conversations/:id" element={<ConversationDetail />} />
              <Route path="/ota-inbox" element={<OtaInbox property={property} />} />

              {/* PMS */}
              <Route path="/gantt" element={<RequireModule moduleId="pms"><GanttCalendar property={property} /></RequireModule>} />
              <Route path="/rooms" element={<RequireModule moduleId="pms"><RoomsManager property={property} /></RequireModule>} />
              <Route path="/guests" element={<GuestsPanel property={property} />} />
              <Route path="/guests/:id" element={<GuestDetail />} />
              <Route path="/housekeeping" element={<RequireModule moduleId="pms"><HousekeepingBoard property={property} /></RequireModule>} />

              {/* Revenue */}
              <Route path="/pos" element={<RequireModule moduleId="nfc_pos"><POSTerminal property={property} /></RequireModule>} />
              <Route path="/wallets" element={<RequireModule moduleId="nfc_pos"><WalletPanel property={property} /></RequireModule>} />
              <Route path="/inventory" element={<RequireModule moduleId="inventory"><Inventory /></RequireModule>} />
              <Route path="/transport" element={<TransportPanel />} />
              <Route path="/payments" element={<PaymentsPanel property={property} />} />
              <Route path="/revenue" element={<RevenueIntelligence property={property} />} />

              {/* AI */}
              <Route path="/ai" element={<AIConcierge property={property} />} />
              <Route path="/sandbox" element={<SandboxPanel property={property} />} />
              <Route path="/knowledge" element={<KnowledgeBase property={property} />} />
              <Route path="/property-knowledge" element={<PropertyInfoPanel />} />
              <Route path="/property-knowledge/advanced" element={<PropertyKnowledgePanel propertyId={property?.id} />} />
              <Route path="/escalations" element={<EscalationsPanel property={property} />} />

              {/* Channels */}
              <Route path="/channels" element={<RequireModule moduleId="channel_manager"><ChannelManager /></RequireModule>} />
              <Route path="/channel-manager" element={<ChannelManagerHub />} />

              {/* Reports */}
              <Route path="/bookings" element={<BookingsList property={property} />} />
              <Route path="/occupancy" element={<OccupancyChart property={property} />} />
              <Route path="/cancellations" element={<CancellationsPanel property={property} />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/events" element={<EventsPanel property={property} />} />

              {/* System */}
              <Route path="/connections" element={<ConnectionsPanel property={property} />} />
              <Route path="/health"        element={<MonitorPage />} />
              <Route path="/health/legacy" element={<HealthMonitor />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/settings" element={<ConfigPanel property={property} />} />
              <Route path="/settings/*" element={<ConfigPanel property={property} />} />
              <Route path="/settings/legacy" element={<SettingsPage />} />
              <Route path="/config" element={<ConfigPanel property={property} />} />
              <Route path="/config/*" element={<ConfigPanel property={property} />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
