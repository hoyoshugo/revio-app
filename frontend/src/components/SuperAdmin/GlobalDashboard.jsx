import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, MessageSquare, AlertTriangle, DollarSign, Activity } from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

function StatCard({ label, value, sub, icon: Icon, color = 'cyan' }) {
  const colors = {
    cyan: 'bg-cyan-600/15 text-cyan-400',
    green: 'bg-green-600/15 text-green-400',
    yellow: 'bg-yellow-600/15 text-yellow-400',
    red: 'bg-red-600/15 text-red-400',
    purple: 'bg-purple-600/15 text-purple-400',
  };
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
    </div>
  );
}

export default function GlobalDashboard() {
  const { saFetch } = useSuperAdmin();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    saFetch('/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm">Cargando...</div>
      </div>
    );
  }

  const t = data?.tenants || {};
  // API returns [{month: 'ene. 26', count: N}, ...] — add cumulative for bar chart
  const rawGrowth = data?.growth || [];
  let cum = 0;
  const growth = rawGrowth.map(g => {
    cum += g.count || 0;
    return { ...g, cumulative_tenants: cum };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard Global</h1>
        <p className="text-gray-500 text-sm mt-0.5">Resumen del SaaS Mística AI</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="MRR"
          value={data?.mrr != null ? `$${data.mrr.toLocaleString()}` : '—'}
          sub="Ingreso mensual recurrente"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Clientes activos"
          value={t.active ?? 0}
          sub={`${t.trial ?? 0} en trial · ${t.overdue ?? 0} vencidos`}
          icon={Users}
          color="cyan"
        />
        <StatCard
          label="Total clientes"
          value={t.total ?? 0}
          sub={`${t.suspended ?? 0} suspendidos`}
          icon={Activity}
          color="purple"
        />
        <StatCard
          label="Conversaciones hoy"
          value={data?.conversations?.today ?? 0}
          sub={`${data?.conversations?.month ?? 0} este mes`}
          icon={MessageSquare}
          color="cyan"
        />
        <StatCard
          label="Errores abiertos"
          value={data?.open_errors?.total ?? 0}
          sub={data?.open_errors?.critical > 0 ? `${data.open_errors.critical} críticos` : 'Sin críticos'}
          icon={AlertTriangle}
          color={data?.open_errors?.total > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Crecimiento mensual"
          value={growth.length > 1 ? `+${growth[growth.length - 1]?.new_tenants ?? 0}` : '—'}
          sub="Nuevos clientes este mes"
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Growth chart (simple bar) */}
      {growth.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h2 className="text-sm font-medium text-white mb-4">Crecimiento de clientes (6 meses)</h2>
          <div className="flex items-end gap-3 h-32">
            {growth.map((g, i) => {
              const max = Math.max(...growth.map(x => x.cumulative_tenants), 1);
              const h = Math.max((g.cumulative_tenants / max) * 100, 4);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs text-gray-400">{g.cumulative_tenants}</span>
                  <div
                    className="w-full bg-cyan-600 rounded-t-md transition-all"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-xs text-gray-600 truncate w-full text-center">
                    {g.month || ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tenant status breakdown */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-medium text-white mb-4">Estado de clientes</h2>
        <div className="space-y-3">
          {[
            { label: 'Activos', key: 'active', color: 'bg-green-500' },
            { label: 'Trial', key: 'trial', color: 'bg-cyan-500' },
            { label: 'Vencidos', key: 'overdue', color: 'bg-yellow-500' },
            { label: 'Suspendidos', key: 'suspended', color: 'bg-red-500' },
          ].map(({ label, key, color }) => {
            const count = t[key] ?? 0;
            const total = t.total || 1;
            const pct = Math.round((count / total) * 100);
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-gray-400 text-xs w-20">{label}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-white text-xs w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
