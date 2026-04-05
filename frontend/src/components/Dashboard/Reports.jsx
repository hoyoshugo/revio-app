import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { Download, RefreshCw, TrendingUp, Home, ShoppingCart, Wallet, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const COP = v => `$${Number(v || 0).toLocaleString('es-CO')}`;
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div className="rv-card p-4">
      <div className="text-xs text-[var(--text-3)] uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-[var(--text-1)]">{value}</div>
      {sub && <div className="text-xs text-[var(--text-3)] mt-1">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label, format = 'number' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rv-card p-3 text-xs shadow-xl border border-[var(--border)]">
      <p className="font-medium text-[var(--text-1)] mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {format === 'currency' ? COP(p.value) : format === 'pct' ? `${p.value}%` : p.value}
        </p>
      ))}
    </div>
  );
}

function csvDownload(data, filename) {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map(r => keys.map(k => r[k] ?? '').join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── TAB: Ocupación ────────────────────────────────────────────
function OccupancyTab({ from, to, token, pid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reports/occupancy?from=${from}&to=${to}&property_id=${pid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [from, to, token, pid]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[var(--text-3)]">Cargando...</div>;

  const s = data?.summary || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Ocupación promedio" value={`${s.avg_occupancy_pct ?? 0}%`} />
        <SummaryCard label="ADR" value={COP(s.adr)} sub="Tarifa media diaria" />
        <SummaryCard label="RevPAR" value={COP(s.revpar)} sub="Revenue por hab. disponible" />
        <SummaryCard label="Total reservas" value={s.total_reservations ?? 0} />
        <SummaryCard label="Ingresos alojamiento" value={COP(s.total_revenue)} />
        <SummaryCard label="Días del período" value={s.period_days ?? 0} />
      </div>

      <div className="rv-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-1)]">Ocupación diaria</h3>
          <button onClick={() => csvDownload(data.daily, 'ocupacion.csv')} className="rv-btn-ghost text-xs flex items-center gap-1">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data?.daily || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} unit="%" domain={[0, 100]} />
            <Tooltip content={<CustomTooltip format="pct" />} />
            <Area type="monotone" dataKey="occupancy" name="Ocupación" stroke="#6366F1" fill="#6366F1" fillOpacity={0.2} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rv-card p-4">
          <h3 className="font-semibold text-[var(--text-1)] mb-4">Por fuente de reserva</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data?.by_source || []} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={70} label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}>
                {(data?.by_source || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rv-card p-4">
          <h3 className="font-semibold text-[var(--text-1)] mb-3">Habitaciones ocupadas / disponibles</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={(data?.daily || []).filter((_, i) => i % 3 === 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="occupied_rooms" name="Ocupadas" fill="#6366F1" radius={[2, 2, 0, 0]} />
              <Bar dataKey="total_rooms" name="Total" fill="var(--border)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Revenue ──────────────────────────────────────────────
function RevenueTab({ from, to, token, pid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reports/revenue?from=${from}&to=${to}&property_id=${pid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [from, to, token, pid]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[var(--text-3)]">Cargando...</div>;

  const s = data?.summary || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Ingresos totales" value={COP(s.total)} />
        <SummaryCard label="Alojamiento" value={COP(s.reservations)} sub={`${s.total > 0 ? Math.round(s.reservations / s.total * 100) : 0}% del total`} />
        <SummaryCard label="POS / F&B" value={COP(s.pos)} sub={`${s.total > 0 ? Math.round(s.pos / s.total * 100) : 0}% del total`} />
      </div>

      <div className="rv-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-1)]">Ingresos diarios</h3>
          <button onClick={() => csvDownload(data.daily, 'revenue.csv')} className="rv-btn-ghost text-xs flex items-center gap-1">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data?.daily || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip format="currency" />} />
            <Legend />
            <Bar dataKey="reservations" name="Alojamiento" fill="#6366F1" stackId="a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="pos" name="POS" fill="#10B981" stackId="a" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rv-card p-4">
          <h3 className="font-semibold text-[var(--text-1)] mb-4">Por canal de distribución</h3>
          <div className="space-y-2">
            {(data?.by_source || []).sort((a, b) => b.amount - a.amount).map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-20 text-xs text-[var(--text-3)] truncate">{s.source}</div>
                <div className="flex-1 h-4 bg-[var(--surface-2)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${data.summary.reservations > 0 ? Math.round(s.amount / data.summary.reservations * 100) : 0}%`,
                    background: COLORS[i % COLORS.length]
                  }} />
                </div>
                <div className="text-xs text-[var(--text-2)] w-24 text-right">{COP(s.amount)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rv-card p-4">
          <h3 className="font-semibold text-[var(--text-1)] mb-4">Por centro de revenue</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data?.by_revenue_center || []} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {(data?.by_revenue_center || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => COP(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── TAB: POS ──────────────────────────────────────────────────
function POSTab({ from, to, token, pid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reports/pos?from=${from}&to=${to}&property_id=${pid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [from, to, token, pid]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[var(--text-3)]">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total órdenes" value={data?.total_orders ?? 0} />
        <SummaryCard label="Revenue POS" value={COP(data?.total_revenue)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rv-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--text-1)]">Top 10 productos</h3>
            <button onClick={() => csvDownload(data.top_products, 'top-productos.csv')} className="rv-btn-ghost text-xs flex items-center gap-1">
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(data?.top_products || []).slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
                <div>
                  <div className="text-sm text-[var(--text-1)]">{p.name}</div>
                  <div className="text-xs text-[var(--text-3)]">{p.quantity} unidades</div>
                </div>
                <div className="text-sm font-medium text-[var(--accent)]">{COP(p.revenue)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rv-card p-4">
          <h3 className="font-semibold text-[var(--text-1)] mb-4">Heatmap por hora</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.hourly_heatmap || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={h => `${h}h`} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip format="currency" />} />
              <Bar dataKey="revenue" name="Revenue" fill="#F59E0B" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Billeteras ───────────────────────────────────────────
function WalletsTab({ from, to, token, pid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reports/wallets?from=${from}&to=${to}&property_id=${pid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [from, to, token, pid]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[var(--text-3)]">Cargando...</div>;

  const s = data?.summary || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total cargado" value={COP(s.total_loaded)} />
        <SummaryCard label="Total gastado" value={COP(s.total_spent)} />
        <SummaryCard label="Reembolsado" value={COP(s.total_refunded)} />
        <SummaryCard label="Saldo promedio" value={COP(Math.round(s.avg_balance))} />
        <SummaryCard label="Wallets activas" value={s.active_wallets ?? 0} />
      </div>

      <div className="rv-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-1)]">Volumen diario</h3>
          <button onClick={() => csvDownload(data.daily, 'wallets.csv')} className="rv-btn-ghost text-xs flex items-center gap-1">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data?.daily || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip format="currency" />} />
            <Legend />
            <Line type="monotone" dataKey="loaded" name="Cargado" stroke="#10B981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="spent" name="Gastado" stroke="#6366F1" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── TAB: Housekeeping ─────────────────────────────────────────
function HousekeepingTab({ from, to, token, pid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reports/housekeeping?from=${from}&to=${to}&property_id=${pid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [from, to, token, pid]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[var(--text-3)]">Cargando...</div>;

  const s = data?.summary || {};
  const statusColors = { pending: '#F59E0B', in_progress: '#6366F1', done: '#10B981', skipped: '#64748B' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total tareas" value={s.total ?? 0} />
        <SummaryCard label="Completadas" value={s.by_status?.done ?? 0} sub={`${s.total > 0 ? Math.round((s.by_status?.done || 0) / s.total * 100) : 0}% del total`} />
        <SummaryCard label="Pendientes" value={s.by_status?.pending ?? 0} />
        <SummaryCard label="Tiempo promedio" value={`${s.avg_completion_min ?? 0} min`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rv-card p-4">
          <h3 className="font-semibold text-[var(--text-1)] mb-4">Por estado</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={Object.entries(s.by_status || {}).map(([k, v]) => ({ name: k, value: v }))}
                dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {Object.keys(s.by_status || {}).map((k, i) => <Cell key={i} fill={statusColors[k] || COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rv-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--text-1)]">Por colaborador</h3>
            <button onClick={() => csvDownload(data.by_staff, 'housekeeping-staff.csv')} className="rv-btn-ghost text-xs flex items-center gap-1">
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(data?.by_staff || []).sort((a, b) => b.count - a.count).map((st, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-sm text-[var(--text-2)] w-28 truncate">{st.name}</div>
                <div className="flex-1 h-4 bg-[var(--surface-2)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{
                    width: `${s.total > 0 ? Math.round(st.count / s.total * 100) : 0}%`
                  }} />
                </div>
                <div className="text-xs text-[var(--text-3)] w-8 text-right">{st.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rv-card p-4">
        <h3 className="font-semibold text-[var(--text-1)] mb-4">Por tipo de tarea</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data?.by_type || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-3)' }} />
            <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: 'var(--text-3)' }} width={80} />
            <Tooltip />
            <Bar dataKey="count" name="Tareas" fill="#8B5CF6" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
const TABS = [
  { id: 'occupancy', label: 'Ocupación', icon: Home },
  { id: 'revenue', label: 'Ingresos', icon: TrendingUp },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'wallets', label: 'Billeteras', icon: Wallet },
  { id: 'housekeeping', label: 'Housekeeping', icon: Wrench },
];

export default function Reports() {
  const { token, propertyId } = useAuth();
  const [tab, setTab] = useState('occupancy');
  const [from, setFrom] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const tabProps = { from, to, token, pid: propertyId };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-1)]">Reportes</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">Análisis de rendimiento del establecimiento</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rv-input text-sm py-1.5 px-3 w-36" />
          <span className="text-[var(--text-3)] text-sm">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rv-input text-sm py-1.5 px-3 w-36" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
        {TABS.map(t => (
          <TabBtn key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <span className="flex items-center gap-1.5">
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </span>
          </TabBtn>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'occupancy'    && <OccupancyTab    {...tabProps} />}
      {tab === 'revenue'      && <RevenueTab      {...tabProps} />}
      {tab === 'pos'          && <POSTab          {...tabProps} />}
      {tab === 'wallets'      && <WalletsTab      {...tabProps} />}
      {tab === 'housekeeping' && <HousekeepingTab {...tabProps} />}
    </div>
  );
}
