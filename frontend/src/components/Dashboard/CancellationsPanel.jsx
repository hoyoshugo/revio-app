import React, { useEffect, useState } from 'react';
import {
  XCircle, RefreshCw, AlertTriangle, CheckCircle,
  Clock, DollarSign, User
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const POLICY_CONFIG = {
  flexible: { label: 'Flexible', color: 'text-green-400' },
  moderate: { label: 'Moderada', color: 'text-yellow-400' },
  strict:   { label: 'Estricta', color: 'text-red-400' }
};

const REFUND_CONFIG = {
  pending:    { label: 'Pendiente',  color: 'text-yellow-400', icon: Clock },
  processing: { label: 'Procesando', color: 'text-blue-400',   icon: Clock },
  refunded:   { label: 'Reembolsado',color: 'text-green-400',  icon: CheckCircle },
  failed:     { label: 'Fallido',    color: 'text-red-400',    icon: AlertTriangle },
  waived:     { label: 'Sin cargo',  color: 'text-gray-400',   icon: CheckCircle }
};

const BY_SOURCE = { guest: '👤 Huésped', staff: '🏨 Staff', system: '🤖 Sistema', ota: '🌐 OTA', no_show: '❌ No-Show' };

export default function CancellationsPanel({ property }) {
  const [cancellations, setCancellations] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [noShows, setNoShows] = useState([]);
  const [tab, setTab] = useState('cancellations'); // cancellations | no_shows
  const [loading, setLoading] = useState(true);
  const [refundFilter, setRefundFilter] = useState('');

  const token = localStorage.getItem('mystica_token');
  const headers = { Authorization: `Bearer ${token}` };

  async function load() {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (refundFilter) params.refund_status = refundFilter;
      if (property !== 'all') params.property_slug = property;

      const [cancelRes, noShowRes] = await Promise.all([
        axios.get('/api/ota/cancellations', { headers, params }),
        axios.get('/api/ota/no-shows', { headers, params })
      ]);

      setCancellations(cancelRes.data.cancellations || []);
      setMetrics(cancelRes.data.metrics);
      setNoShows(noShowRes.data.no_shows || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [property, refundFilter, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-white">Cancelaciones y No-Shows</h1>
        <button onClick={load} className="btn-ghost flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Métricas de cancelaciones */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card">
            <div className="text-2xl font-bold text-white">{metrics.total}</div>
            <div className="text-xs text-gray-500">Cancelaciones (30d)</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-red-400">
              ${(metrics.total_penalties / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-gray-500">Penalidades cobradas</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-yellow-400">
              ${(metrics.total_refunds / 1000000).toFixed(1)}M
            </div>
            <div className="text-xs text-gray-500">Reembolsos emitidos</div>
          </div>
          <div className="card">
            <div className="text-2xl font-bold text-orange-400">{metrics.pending_refunds}</div>
            <div className="text-xs text-gray-500">Reembolsos pendientes</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 pb-0">
        {[
          { key: 'cancellations', label: `Cancelaciones (${cancellations.length})` },
          { key: 'no_shows', label: `No-Shows (${noShows.length})` }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-mystica-blue text-mystica-blue'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {tab === 'cancellations' && (
        <select
          value={refundFilter}
          onChange={e => setRefundFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
        >
          <option value="">Todos los reembolsos</option>
          <option value="pending">Pendientes</option>
          <option value="processing">Procesando</option>
          <option value="refunded">Reembolsados</option>
          <option value="failed">Fallidos</option>
        </select>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
      ) : tab === 'cancellations' ? (
        cancellations.length === 0 ? (
          <div className="card text-center py-12">
            <XCircle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No hay cancelaciones registradas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cancellations.map(c => {
              const rc = REFUND_CONFIG[c.refund_status] || REFUND_CONFIG.pending;
              const RefundIcon = rc.icon;
              const pc = POLICY_CONFIG[c.policy_name] || POLICY_CONFIG.flexible;
              return (
                <div key={c.id} className="card">
                  <div className="flex items-start gap-3 flex-wrap">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">
                          {c.bookings?.guest_name || 'Cliente'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {BY_SOURCE[c.cancelled_by] || c.cancelled_by}
                        </span>
                        <span className={`text-xs ${pc.color}`}>
                          Política {pc.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Check-in: {c.bookings?.checkin_date} ·
                        {c.days_before_checkin} días antes ·
                        {c.penalty_percentage}% penalidad
                      </div>
                      {c.cancellation_reason && (
                        <div className="text-xs text-gray-500 mt-0.5 italic">"{c.cancellation_reason}"</div>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      {c.penalty_amount > 0 && (
                        <div className="text-red-400 text-sm font-bold">
                          −${(c.penalty_amount / 1000000).toFixed(1)}M
                        </div>
                      )}
                      <div className={`flex items-center gap-1 justify-end text-xs ${rc.color}`}>
                        <RefundIcon className="w-3 h-3" />
                        {rc.label}
                        {c.refund_amount > 0 && ` ($${(c.refund_amount / 1000000).toFixed(1)}M)`}
                      </div>
                      <div className="text-xs text-gray-600">
                        {c.cancellation_date && format(new Date(c.cancellation_date), 'dd MMM HH:mm', { locale: es })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Tab No-Shows */
        noShows.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No hay no-shows registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {noShows.map(ns => {
              const statusColors = {
                detected: 'text-yellow-400',
                alerted_guest: 'text-blue-400',
                marked_noshow: 'text-red-400',
                resolved: 'text-green-400'
              };
              const statusLabels = {
                detected: 'Detectado',
                alerted_guest: 'Alertado',
                marked_noshow: 'No-Show confirmado',
                resolved: 'Resuelto'
              };
              return (
                <div key={ns.id} className="card">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${statusColors[ns.status] || 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">
                          {ns.bookings?.guest_name || 'Cliente'}
                        </span>
                        <span className={`text-xs font-medium ${statusColors[ns.status] || 'text-gray-400'}`}>
                          {statusLabels[ns.status] || ns.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Check-in: {ns.bookings?.checkin_date} ·
                        {ns.bookings?.room_type} ·
                        ${((ns.bookings?.total_amount || 0) / 1000000).toFixed(1)}M
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 space-x-3">
                        {ns.pre_checkin_alert_sent_at && (
                          <span>✓ Alertado via {ns.pre_checkin_channel}</span>
                        )}
                        {ns.guest_responded && <span className="text-green-400">✓ Cliente respondió</span>}
                        {ns.lobby_cancellation_id && (
                          <span className="text-red-400">✓ Cancelado en LobbyPMS</span>
                        )}
                        {ns.team_notified_at && <span>✓ Equipo notificado</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 flex-shrink-0">
                      {ns.created_at && format(new Date(ns.created_at), 'dd MMM HH:mm', { locale: es })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
