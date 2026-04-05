import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rv-card px-3 py-2 text-xs shadow-lg border border-[var(--border)]">
      <p className="font-medium text-[var(--text-1)]">{label}</p>
      <p className="text-[var(--accent)]">{payload[0].value}% ocupación</p>
    </div>
  );
}

export default function OccupancyBarChart({ data = [], height = 220 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--text-3)' }}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: 'var(--text-3)' }}
          tickLine={false}
          axisLine={false}
          unit="%"
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-2)', opacity: 0.4 }} />
        <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={20}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.pct >= 80 ? '#10B981' : entry.pct >= 50 ? '#6366F1' : '#F59E0B'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
