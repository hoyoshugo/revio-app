/**
 * PMSHub — pantalla central del módulo PMS.
 * Tabs: Calendario · Reservas · Huéspedes · Habitaciones · Housekeeping · Tarifas
 * Header con KPIs de ocupación + arrivals/departures + housekeeping stats.
 */
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Calendar, BedDouble, Users, Wrench, DollarSign, BarChart2,
  Plus, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSearchParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Lazy-load tabs para no bloat el bundle
import GanttCalendar from './GanttCalendar.jsx';
import GuestsPanel from './GuestsPanel.jsx';
import RoomsManager from './RoomsManager.jsx';
import HousekeepingBoard from './HousekeepingBoard.jsx';
import BookingsList from './BookingsList.jsx';

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  );
}

const PMS_TABS = [
  { id: 'calendar',     label: 'Calendario',   icon: Calendar },
  { id: 'reservations', label: 'Reservas',     icon: BedDouble },
  { id: 'guests',       label: 'Huéspedes',    icon: Users },
  { id: 'rooms',        label: 'Habitaciones', icon: BedDouble },
  { id: 'housekeeping', label: 'Housekeeping', icon: Wrench },
  { id: 'rates',        label: 'Tarifas',      icon: DollarSign },
];

function KPICard({ label, value, icon: Icon, color }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: color || 'var(--accent)' }} />
      <div>
        <div className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{value}</div>
        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{label}</div>
      </div>
    </div>
  );
}

export default function PMSHub() {
  const { token, currentProperty, properties } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'calendar';
  const [activeTab, setActiveTab] = useState(initialTab);
  const propertyId = currentProperty?.id || properties?.[0]?.id || '';
  const property = currentProperty || properties?.[0] || {};

  // KPIs
  const [kpis, setKpis] = useState({ occupancy: 0, arrivals: 0, departures: 0, hkClean: 0, hkTotal: 0 });

  const loadKPIs = useCallback(async () => {
    if (!propertyId) return;
    try {
      const [occRes, arrRes, depRes, hkRes] = await Promise.all([
        fetch(`${API}/api/reservations/occupancy?property_id=${propertyId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/reservations/arrivals?property_id=${propertyId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/reservations/departures?property_id=${propertyId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/housekeeping/${propertyId}/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const occ = occRes.ok ? await occRes.json() : {};
      const arr = arrRes.ok ? await arrRes.json() : {};
      const dep = depRes.ok ? await depRes.json() : {};
      const hk  = hkRes.ok ? await hkRes.json() : {};
      setKpis({
        occupancy: occ.occupancy_rate || 0,
        arrivals: arr.arrivals?.length || 0,
        departures: dep.departures?.length || 0,
        hkClean: (hk.clean || 0) + (hk.inspected || 0),
        hkTotal: hk.total || 0,
      });
    } catch {}
  }, [propertyId, token]);

  useEffect(() => { loadKPIs(); }, [loadKPIs]);

  function changeTab(tab) {
    setActiveTab(tab);
    setSearchParams({ tab });
  }

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            PMS — {property.name || 'Propiedad'}
          </h1>
          <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-3)' }}>{today}</p>
        </div>
        <button
          onClick={loadKPIs}
          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPICard label="Ocupación hoy" value={`${kpis.occupancy}%`} icon={BarChart2} color="#0ea5e9" />
        <KPICard label="Check-ins hoy" value={kpis.arrivals} icon={Users} color="#22c55e" />
        <KPICard label="Check-outs hoy" value={kpis.departures} icon={Users} color="#f59e0b" />
        <KPICard label={`Habitaciones limpias`} value={`${kpis.hkClean}/${kpis.hkTotal}`} icon={Wrench} color="#8b5cf6" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {PMS_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => changeTab(id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: activeTab === id ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-2)',
              fontWeight: activeTab === id ? 600 : 400,
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'calendar'     && <GanttCalendar property={property} />}
        {activeTab === 'reservations' && <BookingsList property={property} />}
        {activeTab === 'guests'       && <GuestsPanel />}
        {activeTab === 'rooms'        && <RoomsManager property={property} />}
        {activeTab === 'housekeeping' && <HousekeepingBoard property={property} />}
        {activeTab === 'rates'        && <RatePlansTab propertyId={propertyId} token={token} />}
      </div>
    </div>
  );
}

// ── Tab Tarifas inline ────────────────────────────────
function RatePlansTab({ propertyId, token }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    fetch(`${API}/api/rate-plans/${propertyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { plans: [] })
      .then(d => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId, token]);

  const TYPE_LABELS = {
    standard: 'Estándar',
    seasonal: 'Temporada',
    weekend: 'Fin de semana',
    promo: 'Promoción',
    ota: 'OTA',
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
          Planes tarifarios ({plans.length})
        </h3>
      </div>

      {plans.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{ background: 'var(--card)', border: '1px dashed var(--border)', color: 'var(--text-2)' }}
        >
          Sin planes tarifarios. Los datos se cargarán tras ejecutar la migración SQL.
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Nombre</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Tipo</th>
                <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Tarifa</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Vigencia</th>
                <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Canales</th>
                <th className="text-center px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Mín.</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-1)' }}>{plan.name}</td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                      {TYPE_LABELS[plan.type] || plan.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--text-1)' }}>
                    ${Number(plan.base_rate || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-2)' }}>
                    {plan.valid_from && plan.valid_to
                      ? `${plan.valid_from} → ${plan.valid_to}`
                      : 'Permanente'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {(plan.channels || []).map(ch => (
                        <span key={ch} className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg)', color: 'var(--text-2)' }}>
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center" style={{ color: 'var(--text-2)' }}>
                    {plan.min_nights || 1}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
