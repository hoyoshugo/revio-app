import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Clock, User, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const REASON_LABELS = {
  frustration_detected: 'Frustración detectada',
  long_conversation: 'Conversación larga sin resolver',
  human_requested: 'Solicitud de atención humana'
};

const REASON_COLORS = {
  frustration_detected: 'text-red-400 bg-red-950/40 border-red-800/40',
  long_conversation: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/40',
  human_requested: 'text-orange-400 bg-orange-950/40 border-orange-800/40'
};

const PLATFORM_ICONS = {
  whatsapp: '💬', instagram: '📸', facebook: '🔵',
  tiktok: '🎵', booking: '🏨', direct: '🌊'
};

function EscalationCard({ escalation, onResolve, resolving }) {
  const isOpen = escalation.status === 'open';
  const conv = escalation.conversations;
  const reasonColor = REASON_COLORS[escalation.reason] || 'text-gray-400 bg-gray-800 border-gray-700';

  return (
    <div className={`rounded-xl border p-4 ${
      isOpen ? 'bg-gray-900 border-gray-800' : 'bg-gray-900/50 border-gray-800/50 opacity-70'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2">
          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-red-400' : 'bg-green-400'}`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white text-sm font-medium">
                {conv?.guest_name || 'Huésped desconocido'}
              </span>
              {conv?.platform && (
                <span className="text-xs text-gray-500">
                  {PLATFORM_ICONS[conv.platform] || '💬'} {conv.platform}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              ID: {escalation.id?.substring(0, 8)}...
            </div>
          </div>
        </div>
        {isOpen ? (
          <button
            onClick={() => onResolve(escalation.id)}
            disabled={resolving === escalation.id}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-800/50 hover:bg-green-700/50 disabled:opacity-50 text-green-300 rounded-lg text-xs transition-colors shrink-0"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {resolving === escalation.id ? 'Resolviendo...' : 'Resolver'}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-green-400 text-xs">
            <CheckCircle className="w-3.5 h-3.5" /> Resuelta
          </span>
        )}
      </div>

      {/* Motivo */}
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs mb-3 ${reasonColor}`}>
        <AlertTriangle className="w-3 h-3" />
        {REASON_LABELS[escalation.reason] || escalation.reason}
      </div>

      {/* Resumen */}
      {escalation.summary && (
        <div className="bg-gray-800/60 rounded-lg p-3 text-xs text-gray-300 leading-relaxed mb-3">
          {escalation.summary}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(escalation.created_at).toLocaleString('es-CO')}
        </span>
        {escalation.resolved_at && (
          <span className="text-green-700">
            Resuelta: {new Date(escalation.resolved_at).toLocaleString('es-CO')}
          </span>
        )}
        {escalation.resolved_by && (
          <span className="flex items-center gap-1 text-gray-600">
            <User className="w-3 h-3" />
            {escalation.resolved_by}
          </span>
        )}
      </div>
    </div>
  );
}

export default function EscalationsPanel({ property }) {
  const { token } = useAuth();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [resolving, setResolving] = useState(null);

  const propertyId = property === 'all' ? null : property;

  const fetchEscalations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('property_id', propertyId);
      if (filter) params.set('status', filter);
      const res = await fetch(`${API}/api/social/escalations?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEscalations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, propertyId, filter]);

  useEffect(() => { fetchEscalations(); }, [fetchEscalations]);

  async function handleResolve(id) {
    setResolving(id);
    try {
      const res = await fetch(`${API}/api/social/escalations/${id}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al resolver');
      fetchEscalations();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setResolving(null);
    }
  }

  const openCount = escalations.filter(e => e.status === 'open').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Escalaciones
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Conversaciones que requieren atención humana
          </p>
        </div>
        <button
          onClick={fetchEscalations}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Alerta si hay escalaciones abiertas */}
      {openCount > 0 && (
        <div className="bg-red-950/40 border border-red-700/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <div className="text-red-300 font-semibold text-sm">
              {openCount} escalación{openCount !== 1 ? 'es' : ''} pendiente{openCount !== 1 ? 's' : ''}
            </div>
            <div className="text-red-400/70 text-xs mt-0.5">
              La IA está pausada para estas conversaciones. Atiéndelas directamente o resuélvelas para reanudar la IA.
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { value: 'open', label: 'Abiertas' },
          { value: 'resolved', label: 'Resueltas' },
          { value: '', label: 'Todas' }
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f.value
                ? 'bg-mystica-blue/20 text-mystica-blue border border-mystica-blue/30'
                : 'bg-gray-800 text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Cargando escalaciones...</div>
      ) : escalations.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-10 h-10 text-green-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {filter === 'open' ? '¡Todo tranquilo! No hay escalaciones pendientes.' : 'No hay escalaciones en este filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {escalations.map(esc => (
            <EscalationCard
              key={esc.id}
              escalation={esc}
              onResolve={handleResolve}
              resolving={resolving}
            />
          ))}
        </div>
      )}

      {/* Info sobre reanudar por WhatsApp */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-400 mb-1">💡 Reanudar IA por WhatsApp</p>
        <p>El equipo puede reanudar la IA respondiendo al número de WhatsApp con el comando:</p>
        <code className="block mt-1 bg-gray-800 px-2 py-1 rounded text-gray-300">REANUDAR [ID de escalación]</code>
      </div>
    </div>
  );
}
