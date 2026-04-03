import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      <p className="text-mystica-blue font-medium">{payload[0]?.value}% ocupación</p>
    </div>
  );
};

export default function OccupancyChart({ property }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem('mystica_token');
        const params = property !== 'all' ? { property_slug: property } : {};
        const res = await axios.get('/api/dashboard/occupancy', {
          headers: { Authorization: `Bearer ${token}` },
          params
        });

        // Normalizar datos
        let points = [];
        if (res.data.occupancy_data) {
          points = res.data.occupancy_data;
        } else if (res.data.properties) {
          // Consolidar todas las propiedades
          const allDates = {};
          for (const prop of res.data.properties) {
            for (const entry of prop.occupancy_data) {
              if (!allDates[entry.date]) allDates[entry.date] = { occ_sum: 0, count: 0 };
              allDates[entry.date].occ_sum += entry.occupancy_percentage || 0;
              allDates[entry.date].count++;
            }
          }
          points = Object.entries(allDates).map(([date, v]) => ({
            date,
            occupancy_percentage: Math.round(v.occ_sum / v.count)
          }));
        }

        const formatted = points.map(p => ({
          date: format(parseISO(p.date), 'dd MMM', { locale: es }),
          occupancy: Math.round(p.occupancy_percentage || 0),
          rawDate: p.date
        }));
        setData(formatted);
      } catch (err) {
        console.error(err);
        // Mock data para demostración
        setData(
          Array.from({ length: 14 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return {
              date: format(d, 'dd MMM', { locale: es }),
              occupancy: Math.floor(Math.random() * 60) + 30
            };
          })
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [property]);

  const avgOccupancy = data.length
    ? Math.round(data.reduce((s, d) => s + d.occupancy, 0) / data.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Ocupación</h1>
        <div className="text-sm text-gray-400">
          Promedio: <span className="text-mystica-blue font-medium">{avgOccupancy}%</span>
        </div>
      </div>

      {/* Indicador actual */}
      <div className="grid grid-cols-3 gap-3">
        {['Alta (>80%)', 'Media (60-80%)', 'Baja (<60%)'].map((label, i) => (
          <div key={i} className="card text-center">
            <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
              i === 0 ? 'bg-red-500' : i === 1 ? 'bg-yellow-500' : 'bg-green-500'
            }`} />
            <div className="text-xs text-gray-400">{label}</div>
            {i === 2 && <div className="text-xs text-green-400 mt-0.5">Descuento posible</div>}
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Proyección próximos 14 días</h3>
        {loading ? (
          <div className="h-48 animate-pulse bg-gray-800 rounded" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.occupancy > 80 ? '#ef4444' : entry.occupancy >= 60 ? '#eab308' : '#00b4d8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
