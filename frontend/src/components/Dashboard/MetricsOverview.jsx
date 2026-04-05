import React, { useEffect, useState, useCallback } from 'react';
import {
  BedDouble, DollarSign, LogIn, LogOut, Wallet, Sparkles,
  RefreshCw, TrendingUp, TrendingDown, Minus, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import OccupancyBarChart from '../charts/OccupancyBarChart.jsx';
import RevenueAreaChart from '../charts/RevenueAreaChart.jsx';
import { formatCOP, formatDate, getInitials, avatarColor } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function SkeletonCard() {
  return (
    <div className="rv-card p-5 animate-pulse">
      <div className="h-4 w-24 bg-[var(--surface-2)] rounded mb-3" />
      <div className="h-8 w-16 bg-[var(--surface-2)] rounded mb-2" />
      <div className="h-3 w-20 bg-[var(--surface-2)] rounded" />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color = 'indigo', trend, loading, link }) {
  const colors = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
  };
  if (loading) return <SkeletonCard />;
  return (
    <div className="rv-card p-5 hover:border-[var(--accent)]/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs flex items-center gap-0.5 ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-rose-400' : 'text-[var(--text-3)]'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-[var(--text-1)] tabular-nums">{value ?? '—'}</div>
      <div className="text-xs text-[var(--text-3)] mt-0.5">{label}</div>
      {sub && <div className="text-xs text-[var(--text-3)] mt-1">{sub}</div>}
    </div>
  );
}

function GuestRow({ reservation, type, onAction }) {
  const guest = reservation.guests || {};
  const room = reservation.rooms || {};
  const initials = getInitials(guest.first_name, guest.last_name);
  const bg = avatarColor(`${guest.first_name}${guest.last_name}`);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${bg}`}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-1)] truncate">
          {guest.first_name} {guest.last_name}
        </div>
        <div className="text-xs text-[var(--text-3)]">
          {room.name || room.number || 'Sin habitación'}
        </div>
      </div>
      <button
        onClick={() => onAction(reservation)}
        className={`text-xs px-2 py-1 rounded-md font-medium flex-shrink-0 transition-colors ${
          type === 'checkin'
            ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
        }`}
      >
        {type === 'checkin' ? 'Check-in' : 'Check-out'}
      </button>
    </div>
  );
}

export default function MetricsOverview() {
  const { token, propertyId, authHeaders } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadKpis = useCallback(async () => {
    if (!token || !propertyId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/dashboard/kpis?property_id=${propertyId}`, {
        headers: authHeaders
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch {}
    setLoading(false);
  }, [token, propertyId]);

  const loadAiInsight = useCallback(async () => {
    if (!token || !propertyId || aiInsight) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API}/api/ai/forecast`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId })
      });
      if (res.ok) {
        const json = await res.json();
        setAiInsight(json.narrative || json.raw || '');
      }
    } catch {}
    setAiLoading(false);
  }, [token, propertyId, aiInsight]);

  useEffect(() => { loadKpis(); }, [loadKpis]);
  useEffect(() => { loadAiInsight(); }, [loadAiInsight]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(loadKpis, 30000);
    return () => clearInterval(id);
  }, [loadKpis]);

  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-1)]">Panel de Control</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">
            {lastUpdated
              ? `Actualizado ${lastUpdated.toLocaleTimeString('es-CO')}`
              : 'Cargando datos...'}
          </p>
        </div>
        <button
          onClick={() => { setData(null); setAiInsight(''); loadKpis(); loadAiInsight(); }}
          className="rv-btn-ghost flex items-center gap-1.5 text-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={BedDouble} label="Ocupación" value={loading ? null : `${kpis.occupancy_pct ?? 0}%`} sub={`${kpis.occupied_rooms ?? 0}/${kpis.total_rooms ?? 0} habitaciones`} color="indigo" loading={loading} />
        <KpiCard icon={DollarSign} label="Ingresos hoy" value={loading ? null : formatCOP(kpis.revenue_today)} color="emerald" loading={loading} />
        <KpiCard icon={LogIn} label="Llegadas hoy" value={loading ? null : kpis.arrivals_today ?? 0} color="violet" loading={loading} />
        <KpiCard icon={LogOut} label="Salidas hoy" value={loading ? null : kpis.departures_today ?? 0} color="amber" loading={loading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Occupancy chart */}
        <div className="rv-card p-4 lg:col-span-3">
          <h3 className="text-sm font-semibold text-[var(--text-1)] mb-4">Ocupación — Últimos 30 días</h3>
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <OccupancyBarChart data={data?.occupancy_30d || []} height={208} />
          )}
        </div>
        {/* Revenue chart */}
        <div className="rv-card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-[var(--text-1)] mb-4">Ingresos diarios</h3>
          {loading ? (
            <div className="h-52 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <RevenueAreaChart data={data?.revenue_30d || []} height={208} />
          )}
        </div>
      </div>

      {/* Operations row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Arrivals */}
        <div className="rv-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-1)]">Llegadas hoy</h3>
            <span className="text-xs text-[var(--accent)] font-medium">{(data?.arrivals || []).length}</span>
          </div>
          <div className="space-y-0">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-10 bg-[var(--surface-2)] rounded animate-pulse mb-2" />)
            ) : (data?.arrivals || []).length === 0 ? (
              <p className="text-sm text-[var(--text-3)] py-3 text-center">Sin llegadas hoy</p>
            ) : (
              (data.arrivals || []).slice(0, 5).map(r => (
                <GuestRow key={r.id} reservation={r} type="checkin" onAction={() => {}} />
              ))
            )}
          </div>
        </div>

        {/* Departures */}
        <div className="rv-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-1)]">Salidas hoy</h3>
            <span className="text-xs text-emerald-400 font-medium">{(data?.departures || []).length}</span>
          </div>
          <div className="space-y-0">
            {loading ? (
              [1, 2].map(i => <div key={i} className="h-10 bg-[var(--surface-2)] rounded animate-pulse mb-2" />)
            ) : (data?.departures || []).length === 0 ? (
              <p className="text-sm text-[var(--text-3)] py-3 text-center">Sin salidas hoy</p>
            ) : (
              (data.departures || []).slice(0, 5).map(r => (
                <GuestRow key={r.id} reservation={r} type="checkout" onAction={() => {}} />
              ))
            )}
          </div>
        </div>

        {/* Housekeeping + Wallets */}
        <div className="space-y-4">
          {/* HK grid */}
          <div className="rv-card p-4">
            <h3 className="text-sm font-semibold text-[var(--text-1)] mb-3">Housekeeping hoy</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Pendiente', key: 'pending', color: 'bg-amber-500/10 text-amber-400' },
                { label: 'En progreso', key: 'in_progress', color: 'bg-blue-500/10 text-blue-400' },
                { label: 'Listo', key: 'done', color: 'bg-emerald-500/10 text-emerald-400' },
                { label: 'Verificado', key: 'verified', color: 'bg-indigo-500/10 text-indigo-400' },
              ].map(({ label, key, color }) => (
                <div key={key} className={`rounded-lg p-2.5 text-center ${color}`}>
                  <div className="text-xl font-bold">{data?.housekeeping?.[key] ?? 0}</div>
                  <div className="text-[10px] font-medium">{label}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Wallet summary */}
          <div className="rv-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--text-1)]">Billeteras activas</h3>
            </div>
            <div className="text-2xl font-bold text-[var(--text-1)]">{kpis.active_wallets ?? 0}</div>
            <div className="text-xs text-[var(--text-3)]">{formatCOP(kpis.wallet_balance_total)} en circulación</div>
          </div>
        </div>
      </div>

      {/* AI insight */}
      <div className="rv-card p-5" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-semibold text-[var(--text-1)]">Insight de hoy — generado por Revio AI</h3>
          <button onClick={() => { setAiInsight(''); loadAiInsight(); }} className="ml-auto rv-btn-ghost text-xs">
            Regenerar
          </button>
        </div>
        {aiLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-3)]">
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            Analizando datos de tu propiedad...
          </div>
        ) : aiInsight ? (
          <p className="text-sm text-[var(--text-2)] leading-relaxed">{aiInsight}</p>
        ) : (
          <p className="text-sm text-[var(--text-3)]">
            Agrega tu <code className="bg-[var(--surface-2)] px-1 rounded text-xs">ANTHROPIC_API_KEY</code> para activar insights automáticos de ocupación y revenue.
          </p>
        )}
      </div>
    </div>
  );
}
