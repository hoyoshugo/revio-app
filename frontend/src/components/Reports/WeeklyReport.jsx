import React, { useEffect, useState } from 'react';
import { Download, TrendingUp, Users, DollarSign, MessageSquare, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';

const COLORS = ['#00b4d8', '#2d9e6b', '#8b5cf6', '#f59e0b'];
const LANG_NAMES = { es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán' };

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function WeeklyReport({ property }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState(null);

  useEffect(() => {
    async function resolvePropertyId() {
      if (property === 'all') { setPropertyId(null); return; }
      const token = localStorage.getItem('mystica_token');
      try {
        const { data } = await axios.get('/api/dashboard/properties', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const p = data.properties?.find(pr => pr.slug === property);
        setPropertyId(p?.id);
      } catch { setPropertyId(null); }
    }
    resolvePropertyId();
  }, [property]);

  async function load() {
    if (!propertyId && property !== 'all') return;
    setLoading(true);
    try {
      const token = localStorage.getItem('mystica_token');
      const pid = propertyId || (await getFirstPropertyId(token));
      if (!pid) { setLoading(false); return; }
      const { data } = await axios.get('/api/dashboard/weekly-report', {
        headers: { Authorization: `Bearer ${token}` },
        params: { property_id: pid }
      });
      setReport(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function getFirstPropertyId(token) {
    const { data } = await axios.get('/api/dashboard/properties', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return data.properties?.[0]?.id;
  }

  useEffect(() => {
    if (propertyId !== null) load();
  }, [propertyId]);

  useEffect(() => {
    if (property === 'all') load();
  }, [property]);

  function downloadCSV() {
    if (!report?.bookings) return;
    const headers = ['Nombre', 'Email', 'Check-in', 'Check-out', 'Habitación', 'Total', 'Estado'];
    const rows = report.bookings.map(b => [
      b.guest_name, b.guest_email, b.checkin_date, b.checkout_date,
      b.room_type, b.total_amount, b.status
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-mystica-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const langData = report?.summary?.language_distribution
    ? Object.entries(report.summary.language_distribution).map(([k, v]) => ({
        name: LANG_NAMES[k] || k,
        value: v
      }))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Reporte Semanal</h1>
          {report?.period && (
            <p className="text-sm text-gray-500 mt-0.5">
              {report.period.start} al {report.period.end}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
          <button onClick={downloadCSV} disabled={!report} className="btn-primary flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}
        </div>
      ) : !report ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No hay datos disponibles. Selecciona una propiedad específica.</p>
        </div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Conversaciones" value={report.summary.total_conversations} icon={MessageSquare} color="text-mystica-blue" />
            <StatCard label="Reservas" value={report.summary.total_bookings} icon={TrendingUp} color="text-purple-400" />
            <StatCard
              label="Ingresos"
              value={`$${(report.summary.total_revenue / 1000000).toFixed(1)}M`}
              icon={DollarSign}
              color="text-mystica-green"
            />
            <StatCard label="Conversión" value={`${report.summary.conversion_rate}%`} icon={Users} color="text-orange-400" />
          </div>

          {/* Distribución de idiomas */}
          {langData.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-medium text-gray-300 mb-4">Idiomas de los clientes</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={langData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                      {langData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabla de reservas */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-300 mb-4">
              Reservas de la semana ({report.bookings.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left pb-2 font-medium">Huésped</th>
                    <th className="text-left pb-2 font-medium">Check-in</th>
                    <th className="text-left pb-2 font-medium">Habitación</th>
                    <th className="text-right pb-2 font-medium">Total</th>
                    <th className="text-right pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {report.bookings.map(b => (
                    <tr key={b.id} className="text-gray-300">
                      <td className="py-2">{b.guest_name}</td>
                      <td className="py-2">{b.checkin_date}</td>
                      <td className="py-2 text-gray-500">{b.room_type}</td>
                      <td className="py-2 text-right text-mystica-green">
                        ${(b.total_amount / 1000000).toFixed(1)}M
                      </td>
                      <td className="py-2 text-right">
                        <span className={`badge badge-${b.status}`}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
