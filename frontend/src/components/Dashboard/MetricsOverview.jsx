import React, { useEffect, useState } from 'react';
import { MessageSquare, DollarSign, Calendar, TrendingUp, AlertCircle, Users, RefreshCw } from 'lucide-react';
import axios from 'axios';

function MetricCard({ icon: Icon, label, value, sub, color = 'blue', loading }) {
  const colors = {
    blue: 'from-mystica-blue/20 to-mystica-blue/5 border-mystica-blue/20 text-mystica-blue',
    green: 'from-mystica-green/20 to-mystica-green/5 border-mystica-green/20 text-mystica-green',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400',
    orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/20 text-orange-400',
    red: 'from-red-500/20 to-red-500/5 border-red-500/20 text-red-400'
  };

  return (
    <div className={`card bg-gradient-to-br ${colors[color]} border`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-current/10`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mt-1">
        {loading ? <div className="h-7 w-16 bg-gray-800 animate-pulse rounded" /> : value}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function MetricsOverview({ property }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadMetrics() {
    setLoading(true);
    try {
      const token = localStorage.getItem('mystica_token');
      const params = property !== 'all' ? { property_slug: property } : {};
      const { data } = await axios.get('/api/dashboard/metrics', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      // Consolidar si hay múltiples propiedades
      const all = data.metrics || [];
      const consolidated = all.reduce((acc, m) => ({
        conversations_today: (acc.conversations_today || 0) + (m.conversations_today || 0),
        prospects: (acc.prospects || 0) + (m.prospects || 0),
        quoted: (acc.quoted || 0) + (m.quoted || 0),
        reserved: (acc.reserved || 0) + (m.reserved || 0),
        paid: (acc.paid || 0) + (m.paid || 0),
        checked_in: (acc.checked_in || 0) + (m.checked_in || 0),
        bookings_today: (acc.bookings_today || 0) + (m.bookings_today || 0),
        revenue_today: (acc.revenue_today || 0) + (m.revenue_today || 0),
        checkins_today: (acc.checkins_today || 0) + (m.checkins_today || 0),
        checkouts_today: (acc.checkouts_today || 0) + (m.checkouts_today || 0),
        pending_payments: (acc.pending_payments || 0) + (m.pending_payments || 0),
        pending_payments_amount: (acc.pending_payments_amount || 0) + (m.pending_payments_amount || 0)
      }), {});
      setMetrics(consolidated);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error cargando métricas:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMetrics(); }, [property]);

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [property]);

  const revenue = metrics?.revenue_today
    ? `$${(metrics.revenue_today / 1000000).toFixed(1)}M`
    : '$0';

  const conversionRate = metrics
    ? metrics.conversations_today > 0
      ? Math.round(((metrics.reserved + metrics.paid) / metrics.conversations_today) * 100)
      : 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Panel de Control</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-CO')}` : 'Cargando...'}
          </p>
        </div>
        <button onClick={loadMetrics} className="btn-ghost flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={MessageSquare}
          label="Conversaciones hoy"
          value={metrics?.conversations_today ?? 0}
          color="blue"
          loading={loading}
        />
        <MetricCard
          icon={DollarSign}
          label="Ingresos hoy"
          value={revenue}
          sub={`${metrics?.bookings_today ?? 0} reservas`}
          color="green"
          loading={loading}
        />
        <MetricCard
          icon={TrendingUp}
          label="Tasa conversión"
          value={`${conversionRate}%`}
          sub="Prospecto → Reserva"
          color="purple"
          loading={loading}
        />
        <MetricCard
          icon={AlertCircle}
          label="Pagos pendientes"
          value={metrics?.pending_payments ?? 0}
          sub={metrics?.pending_payments_amount ? `$${(metrics.pending_payments_amount/1000000).toFixed(1)}M` : ''}
          color="red"
          loading={loading}
        />
      </div>

      {/* Check-ins / Check-outs del día */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Check-ins hoy</div>
          <div className="text-3xl font-bold text-white">{loading ? '–' : metrics?.checkins_today ?? 0}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-medium">Check-outs hoy</div>
          <div className="text-3xl font-bold text-white">{loading ? '–' : metrics?.checkouts_today ?? 0}</div>
        </div>
      </div>

      {/* Funnel de ventas */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Funnel de ventas — conversaciones activas</h3>
        <div className="space-y-2">
          {[
            { key: 'prospects', label: 'Prospectos', color: 'bg-gray-600' },
            { key: 'quoted', label: 'Cotizados', color: 'bg-blue-600' },
            { key: 'reserved', label: 'Reservados', color: 'bg-purple-600' },
            { key: 'paid', label: 'Pagados', color: 'bg-green-600' },
            { key: 'checked_in', label: 'Hospedados', color: 'bg-teal-600' }
          ].map(({ key, label, color }) => {
            const val = metrics?.[key] ?? 0;
            const total = (metrics?.prospects ?? 0) + (metrics?.quoted ?? 0) + (metrics?.reserved ?? 0) + (metrics?.paid ?? 0) + (metrics?.checked_in ?? 0);
            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-400 text-right flex-shrink-0">{label}</div>
                <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-8 text-xs text-gray-400 text-right">{val}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
