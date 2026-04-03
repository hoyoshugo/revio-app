import React, { useState, useEffect } from 'react';
import { BarChart2, MessageSquare, Zap, DollarSign } from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

export default function UsageRegistry() {
  const { saFetch } = useSuperAdmin();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  const PERIOD_DAYS = { week: 7, month: 30, all: 3650 };

  useEffect(() => {
    setLoading(true);
    saFetch(`/usage?days=${PERIOD_DAYS[period] || 30}`)
      .then(r => r.json())
      .then(d => {
        // API returns { rows, summary_by_tenant }
        const summary = Array.isArray(d) ? d : (d?.summary_by_tenant || []);
        setData(summary);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [period]);

  const totals = data.reduce((acc, t) => ({
    conversations: acc.conversations + (t.conversations || 0),
    messages: acc.messages + (t.messages || 0),
    claude_tokens: acc.claude_tokens + (t.claude_tokens || 0),
    cost_usd: acc.cost_usd + (t.cost_usd || 0),
  }), { conversations: 0, messages: 0, claude_tokens: 0, cost_usd: 0 });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Uso y Costos</h1>
          <p className="text-gray-500 text-sm mt-0.5">Consumo por cliente</p>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500">
          <option value="week">Esta semana</option>
          <option value="month">Este mes</option>
          <option value="all">Todo el tiempo</option>
        </select>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Conversaciones', value: totals.conversations.toLocaleString(), icon: MessageSquare, color: 'text-cyan-400' },
          { label: 'Mensajes', value: totals.messages.toLocaleString(), icon: BarChart2, color: 'text-blue-400' },
          { label: 'Tokens Claude', value: `${(totals.claude_tokens / 1000).toFixed(1)}K`, icon: Zap, color: 'text-yellow-400' },
          { label: 'Costo estimado', value: `$${totals.cost_usd.toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-gray-500 text-xs">{label}</span>
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Por cliente */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-medium text-white">Por cliente</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Sin datos de uso</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Cliente</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Plan</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Convs.</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Mensajes</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Tokens</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Costo USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.map(t => (
                  <tr key={t.tenant_id} className="hover:bg-gray-800/30">
                    <td className="px-5 py-3">
                      <div className="text-white font-medium">{t.business_name}</div>
                      <div className="text-gray-600 text-xs">{t.tenant_id?.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{t.plan_name || '—'}</td>
                    <td className="px-4 py-3 text-right text-white">{(t.conversations || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white">{(t.messages || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-yellow-400">{((t.claude_tokens || 0) / 1000).toFixed(1)}K</td>
                    <td className="px-4 py-3 text-right text-green-400">${(t.cost_usd || 0).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
