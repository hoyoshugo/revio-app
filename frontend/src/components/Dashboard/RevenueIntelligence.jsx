/**
 * RevenueIntelligence — Módulo de Revenue Intelligence OTA
 * Análisis de canales, pricing dinámico, monitoreo de reseñas, estrategia OTA.
 */
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Star, AlertCircle, BarChart2, DollarSign, Target, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Helpers ────────────────────────────────────────────────
function StatCard({ label, value, sub, trend, color }) {
  const trendUp = trend > 0;
  return (
    <div className="rv-card rounded-2xl p-4">
      <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{label}</p>
      <p className="text-2xl font-bold mb-1" style={{ color: color || 'var(--text-1)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-1 text-xs">
          {trendUp
            ? <TrendingUp className="w-3 h-3" style={{ color: 'var(--success)' }} />
            : <TrendingDown className="w-3 h-3" style={{ color: 'var(--danger)' }} />}
          <span style={{ color: trendUp ? 'var(--success)' : 'var(--danger)' }}>
            {trendUp ? '+' : ''}{trend}% vs mes anterior
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Canal Distribution ─────────────────────────────────────
function ChannelAnalysis({ data }) {
  const channels = data?.channels || [
    { name: 'Directo (WhatsApp)', pct: 38, revenue: 4560000, color: '#22c55e', trend: 12 },
    { name: 'Booking.com', pct: 31, revenue: 3720000, color: '#0ea5e9', trend: -5 },
    { name: 'Airbnb', pct: 18, revenue: 2160000, color: '#ef4444', trend: 3 },
    { name: 'Expedia', pct: 8, revenue: 960000, color: '#f59e0b', trend: -2 },
    { name: 'Otros', pct: 5, revenue: 600000, color: '#8b5cf6', trend: 0 },
  ];

  const fmt = (n) => `$${(n / 1000000).toFixed(1)}M`;

  return (
    <div className="rv-surface rounded-2xl p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>
        Distribución por Canal (último mes)
      </h3>
      <div className="space-y-3">
        {channels.map(ch => (
          <div key={ch.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{ch.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>{fmt(ch.revenue)}</span>
                <span className="text-xs font-semibold w-8 text-right" style={{ color: 'var(--text-1)' }}>{ch.pct}%</span>
              </div>
            </div>
            <div className="h-2 rounded-full" style={{ background: 'var(--card)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${ch.pct}%`, background: ch.color }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
        Canal directo genera el menor costo de adquisición. Meta: llevar directo al 50%.
      </div>
    </div>
  );
}

// ─── Dynamic Pricing Recommendations ───────────────────────
function PricingRecommendations({ occupancy, basePrice }) {
  const occ = occupancy ?? 65;
  const base = basePrice ?? 280000;

  const getRec = () => {
    if (occ < 40) return {
      action: 'Reducir precio',
      icon: '📉',
      color: 'var(--danger)',
      pct: -15,
      reason: `Ocupación crítica (${occ}%). Reducir precio para estimular demanda.`,
      suggested: Math.round(base * 0.85),
    };
    if (occ < 60) return {
      action: 'Descuento moderado',
      icon: '🎯',
      color: 'var(--warning)',
      pct: -8,
      reason: `Ocupación baja (${occ}%). Considera un descuento de early bird.`,
      suggested: Math.round(base * 0.92),
    };
    if (occ < 80) return {
      action: 'Precio actual óptimo',
      icon: '✅',
      color: 'var(--success)',
      pct: 0,
      reason: `Ocupación saludable (${occ}%). El precio actual es competitivo.`,
      suggested: base,
    };
    if (occ < 90) return {
      action: 'Subir precio',
      icon: '📈',
      color: 'var(--accent)',
      pct: 10,
      reason: `Alta ocupación (${occ}%). Subir precio mejora el RevPAR.`,
      suggested: Math.round(base * 1.10),
    };
    return {
      action: 'Precio premium',
      icon: '🏆',
      color: '#a78bfa',
      pct: 20,
      reason: `Ocupación máxima (${occ}%). Precio premium o cierre de cupos.`,
      suggested: Math.round(base * 1.20),
    };
  };

  const rec = getRec();
  const fmt = (n) => new Intl.NumberFormat('es-CO').format(n);

  const thresholds = [
    { occ: '<40%', action: '-15%', color: 'var(--danger)' },
    { occ: '40-60%', action: '-8%', color: 'var(--warning)' },
    { occ: '60-80%', action: 'Mantener', color: 'var(--success)' },
    { occ: '80-90%', action: '+10%', color: 'var(--accent)' },
    { occ: '>90%', action: '+20%', color: '#a78bfa' },
  ];

  return (
    <div className="rv-surface rounded-2xl p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>
        Pricing Dinámico
      </h3>

      <div className="flex items-start gap-3 p-3 rounded-xl mb-4"
        style={{ background: `color-mix(in srgb, ${rec.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${rec.color} 25%, transparent)` }}>
        <span className="text-2xl">{rec.icon}</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: rec.color }}>{rec.action}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{rec.reason}</p>
          {rec.pct !== 0 && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              Precio sugerido: <strong style={{ color: 'var(--text-1)' }}>${fmt(rec.suggested)} COP</strong>
              <span> (actual: ${fmt(base)} COP)</span>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-3)' }}>Reglas de pricing configuradas</p>
        {thresholds.map(t => (
          <div key={t.occ} className="flex items-center justify-between text-xs py-1">
            <span style={{ color: 'var(--text-2)' }}>Ocupación {t.occ}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: `color-mix(in srgb, ${t.color} 12%, transparent)`, color: t.color }}>
              {t.action}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Review Monitor ─────────────────────────────────────────
function ReviewMonitor({ reviews }) {
  const data = reviews || [
    { platform: 'Booking.com', rating: 9.2, count: 247, trend: 0.3, color: '#0ea5e9' },
    { platform: 'Airbnb', rating: 4.87, count: 183, trend: 0.1, scale: 5, color: '#ef4444' },
    { platform: 'Google', rating: 4.6, count: 312, trend: -0.1, scale: 5, color: '#f59e0b' },
    { platform: 'TripAdvisor', rating: 4.5, count: 96, trend: 0.2, scale: 5, color: '#34d399' },
  ];

  const normalize = (r, scale) => scale === 5 ? (r / 5) * 10 : r;

  return (
    <div className="rv-surface rounded-2xl p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>
        Monitor de Reseñas
      </h3>
      <div className="space-y-3">
        {data.map(r => (
          <div key={r.platform} className="flex items-center gap-3">
            <div className="w-24 flex-shrink-0">
              <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{r.platform}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>{r.count} reseñas</p>
            </div>
            <div className="flex-1">
              <div className="h-2 rounded-full" style={{ background: 'var(--card)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${normalize(r.rating, r.scale) * 10}%`, background: r.color }} />
              </div>
            </div>
            <div className="text-right flex-shrink-0 w-16">
              <div className="flex items-center justify-end gap-1">
                <Star className="w-3 h-3" style={{ color: r.color, fill: r.color }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{r.rating}</span>
              </div>
              <div className="flex items-center justify-end gap-0.5 text-[10px]"
                style={{ color: r.trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {r.trend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {r.trend >= 0 ? '+' : ''}{r.trend}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
        Último análisis de sentimiento: hoy · Alerta si rating baja de 8.5 en Booking o 4.3 en Google
      </div>
    </div>
  );
}

// ─── OTA Strategy ───────────────────────────────────────────
function OtaStrategy() {
  const tips = [
    { platform: 'Booking.com', icon: '🏷️', tip: 'Activa "Genius" para aparecer en búsquedas de miembros premium. Mantén cancelación flexible para mayor visibilidad.', priority: 'alta' },
    { platform: 'Airbnb', icon: '🏠', tip: 'Responde mensajes en <1 hora para mantener Superhost. Actualiza el calendario cada semana para mejorar ranking.', priority: 'media' },
    { platform: 'Directo', icon: '💬', tip: 'El agente Revio ya está reduciendo comisiones. Meta: 50% reservas directas. Ofrece desayuno gratis para reservas directas.', priority: 'alta' },
    { platform: 'Google Hotel Ads', icon: '🔍', tip: 'Conecta tu Google Business con rate parity para aparecer en Hotel Ads. Costo por clic menor que OTAs.', priority: 'media' },
  ];

  const colors = { alta: 'var(--warning)', media: 'var(--accent)', baja: 'var(--text-3)' };

  return (
    <div className="rv-surface rounded-2xl p-5">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>
        Estrategia OTA — Recomendaciones
      </h3>
      <div className="space-y-3">
        {tips.map(t => (
          <div key={t.platform} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--card)' }}>
            <span className="text-xl flex-shrink-0">{t.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{t.platform}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `color-mix(in srgb, ${colors[t.priority]} 12%, transparent)`, color: colors[t.priority] }}>
                  Prioridad {t.priority}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{t.tip}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function RevenueIntelligence({ property }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    // TODO: cargar datos reales del backend cuando estén disponibles
    // Por ahora usar datos demo calculados desde las métricas disponibles
    setLoading(false);
    setData({
      mrr: 11520000,
      reservations: 48,
      avg_price: 240000,
      occupancy: 72,
      base_price: 280000,
    });
  }, [property?.id]);

  const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>Revenue Intelligence</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            Análisis de canales · Pricing dinámico · Reseñas · Estrategia OTA
          </p>
        </div>
        <button onClick={() => setLastUpdated(new Date())}
          className="rv-btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Revenue OTAs (mes)" value={fmt(data?.mrr || 0)} sub="Neto sin comisiones" trend={8} color="var(--success)" />
        <StatCard label="Reservas del mes" value={data?.reservations || 0} sub="Todas las fuentes" trend={5} />
        <StatCard label="Precio promedio" value={fmt(data?.avg_price || 0)} sub="Por noche" trend={-3} />
        <StatCard label="Ocupación actual" value={`${data?.occupancy || 0}%`} sub="Próximos 30 días" trend={4} color={data?.occupancy > 80 ? 'var(--success)' : data?.occupancy > 60 ? 'var(--accent)' : 'var(--warning)'} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChannelAnalysis data={data} />
        <PricingRecommendations occupancy={data?.occupancy} basePrice={data?.base_price} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReviewMonitor />
        <OtaStrategy />
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
        Última actualización: {lastUpdated.toLocaleTimeString('es-CO')} · Los datos de reseñas y canales se sincronizan cuando las integraciones OTA están activas.
      </p>
    </div>
  );
}
