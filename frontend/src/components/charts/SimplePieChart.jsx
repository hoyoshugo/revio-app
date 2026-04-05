import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DEFAULT_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6'];

export default function SimplePieChart({ data = [], colors = DEFAULT_COLORS, height = 220, showLegend = true }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-full text-sm text-[var(--text-3)]">Sin datos</div>
  );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={height * 0.22}
          outerRadius={height * 0.35}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            typeof value === 'number' && value > 10000
              ? `$ ${Number(value).toLocaleString('es-CO')}`
              : value,
            name
          ]}
        />
        {showLegend && (
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
