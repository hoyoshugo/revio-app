/**
 * EscalationsPage — gestión de escalaciones del agente al equipo humano.
 * Lee de /api/escalations/:propertyId y permite resolver / reactivar el agente.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, RotateCw, Eye, MessageSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CHANNEL_ICONS = {
  whatsapp:  '💬',
  instagram: '📸',
  facebook:  '📘',
  web:       '🌐',
};

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function EscalationCard({ esc, onResolve, onResume }) {
  const navigate = useNavigate();
  const isActive = !esc.resolved_at;
  const channelIcon = CHANNEL_ICONS[esc.source || esc.channel] || '🔗';

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: 'var(--card)',
        border: `1px solid ${isActive ? '#ef4444' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              color: isActive ? '#ef4444' : '#22c55e',
              background: (isActive ? '#ef4444' : '#22c55e') + '15',
              border: `1px solid ${isActive ? '#ef4444' : '#22c55e'}`,
            }}
          >
            {isActive ? '🔴 ACTIVA' : '✅ RESUELTA'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-2)' }}>
            {channelIcon} {esc.source || esc.channel || 'web'}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
          {timeAgo(esc.escalated_at || esc.created_at)}
        </span>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-2)' }}>
          Huésped
        </div>
        <p className="text-sm" style={{ color: 'var(--text-1)' }}>
          {esc.guest_name || esc.guest_phone || esc.guest_email || 'desconocido'}
        </p>
      </div>

      {esc.escalation_reason && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-2)' }}>
            Razón
          </div>
          <p className="text-sm" style={{ color: 'var(--text-1)' }}>
            "{esc.escalation_reason}"
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => navigate('/conversations?id=' + esc.id)}
          className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        >
          <Eye className="w-3.5 h-3.5" /> Ver conversación
        </button>
        {isActive && (
          <>
            <button
              onClick={() => onResolve(esc.id)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
              style={{ background: '#22c55e', color: '#fff' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Marcar resuelta
            </button>
            {esc.agent_paused && (
              <button
                onClick={() => onResume(esc.id)}
                className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <RotateCw className="w-3.5 h-3.5" /> Reactivar agente
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function EscalationsPage() {
  const { token, currentProperty, properties } = useAuth();
  const propertyId = currentProperty?.id || properties?.[0]?.id || '';
  const [escalations, setEscalations] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/escalations/${propertyId}?status=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setEscalations((await r.json()).escalations || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [propertyId, token, tab]);

  useEffect(() => { load(); }, [load]);

  async function resolve(id) {
    await fetch(`${API}/api/escalations/${id}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  async function resume(id) {
    await fetch(`${API}/api/conversations/${id}/resume-agent`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  const activeCount = escalations.filter(e => !e.resolved_at).length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Escalaciones</h1>
          {activeCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: '#ef4444', color: '#fff' }}>
              {activeCount} activas
            </span>
          )}
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
          Conversaciones donde el agente necesitó pasar el control al equipo humano.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {[
          { k: 'active',   l: 'Activas' },
          { k: 'resolved', l: 'Resueltas' },
          { k: 'all',      l: 'Todas' },
        ].map(({ k, l }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="flex-1 text-xs px-3 py-2 rounded-lg transition-colors"
            style={{
              background: tab === k ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'transparent',
              color: tab === k ? 'var(--accent)' : 'var(--text-2)',
              fontWeight: tab === k ? 600 : 400,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-2)' }}>Cargando...</div>
      )}

      {!loading && escalations.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
        >
          <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {tab === 'active'
              ? 'No hay escalaciones activas — el agente lo está manejando todo 🎉'
              : 'Sin escalaciones en este tab.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {escalations.map(esc => (
          <EscalationCard key={esc.id} esc={esc} onResolve={resolve} onResume={resume} />
        ))}
      </div>
    </div>
  );
}
