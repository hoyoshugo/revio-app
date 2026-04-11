/**
 * ChannelManagerHub — Hub unificado del Channel Manager.
 * 5 tabs: Visión General · Tarifas · Disponibilidad · Reservas · Inbox Unificado
 *
 * Tabs funcionales: Visión General + Inbox Unificado.
 * Los demás muestran placeholder "en construcción" con roadmap.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid, DollarSign, CalendarCheck, BookOpenCheck, Inbox,
  RefreshCw, Settings, MessageSquare, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CHANNEL_META = {
  whatsapp:        { label: 'WhatsApp',        icon: '💬' },
  instagram:       { label: 'Instagram',       icon: '📸' },
  facebook:        { label: 'Facebook',        icon: '📘' },
  google_business: { label: 'Google Business', icon: '🔍' },
  tripadvisor:     { label: 'TripAdvisor',     icon: '🦉' },
  booking:         { label: 'Booking.com',     icon: '🏩' },
  airbnb:          { label: 'Airbnb',          icon: '🏠' },
  hostelworld:     { label: 'Hostelworld',     icon: '🌍' },
  expedia:         { label: 'Expedia',         icon: '🗺️' },
  despegar:        { label: 'Despegar',        icon: '🛫' },
};

function StatusBadge({ status }) {
  const map = {
    connected:      { color: '#22c55e', label: 'Conectado',     emoji: '🟢' },
    unchecked:      { color: '#f59e0b', label: 'Sin verificar',  emoji: '🟡' },
    error:          { color: '#ef4444', label: 'Error',          emoji: '🔴' },
    not_configured: { color: '#6b7280', label: 'Sin configurar', emoji: '⚫' },
  };
  const s = map[status] || map.not_configured;
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-medium border"
      style={{ color: s.color, borderColor: s.color, background: s.color + '15' }}
    >
      {s.emoji} {s.label}
    </span>
  );
}

function ComingSoon({ title, items }) {
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
    >
      <div className="text-5xl mb-4">🚧</div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-1)' }}>{title}</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>
        En construcción — estará disponible en la próxima versión.<br />
        Estamos construyendo el Channel Manager más completo de LATAM.
      </p>
      {items && (
        <div className="max-w-md mx-auto text-left space-y-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
            >
              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>{it}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChannelManagerHub() {
  const { token, currentProperty, properties } = useAuth();
  const navigate = useNavigate();
  const [propertyId, setPropertyId] = useState(currentProperty?.id || properties?.[0]?.id || '');
  const [activeTab, setActiveTab] = useState('overview');
  const [channels, setChannels] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [inboxFilter, setInboxFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const [chRes, inRes] = await Promise.all([
        fetch(`${API}/api/channels/${propertyId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/channels/${propertyId}/inbox?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (chRes.ok) setChannels((await chRes.json()).channels || []);
      if (inRes.ok) setInbox((await inRes.json()).messages || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [propertyId, token]);

  useEffect(() => { loadData(); }, [loadData]);

  const unreadCount = inbox.filter(m => m.status === 'unread').length;
  const filteredInbox = inboxFilter === 'all' ? inbox : inbox.filter(m => m.channel_key === inboxFilter);

  const TABS = [
    { id: 'overview',     label: 'Visión General',  icon: LayoutGrid },
    { id: 'rates',        label: 'Tarifas',         icon: DollarSign },
    { id: 'availability', label: 'Disponibilidad',  icon: CalendarCheck },
    { id: 'bookings',     label: 'Reservas',        icon: BookOpenCheck },
    { id: 'inbox',        label: 'Inbox Unificado', icon: Inbox, badge: unreadCount },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Channel Manager</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
              BETA
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Gestión unificada de todos tus canales de distribución y comunicación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {properties && properties.length > 1 && (
            <select
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            >
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: activeTab === id ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-2)',
              fontWeight: activeTab === id ? 600 : 400,
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: '#ef4444', color: '#fff' }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Visión General */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
            Canales configurados ({channels.length})
          </h3>
          {channels.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center text-sm"
              style={{ background: 'var(--card)', border: '1px dashed var(--border)', color: 'var(--text-2)' }}
            >
              Aún no hay canales. Ve a <strong>Configuración → Integraciones</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {channels.map(ch => {
                const meta = CHANNEL_META[ch.channel_key] || { label: ch.channel_key, icon: '🔗' };
                return (
                  <div
                    key={ch.channel_key}
                    className="rounded-xl p-4"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{meta.icon}</span>
                        <div>
                          <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{meta.label}</div>
                          <div className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>{ch.channel_type}</div>
                        </div>
                      </div>
                      <StatusBadge status={ch.status || 'not_configured'} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      {ch.can_receive_messages && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                          📥 Recibe
                        </span>
                      )}
                      {ch.can_send_messages && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                          📤 Envía
                        </span>
                      )}
                      {ch.can_reply_reviews && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                          ⭐ Reviews
                        </span>
                      )}
                      {ch.can_sync_calendar && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full border"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
                          📅 Calendario
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate('/settings')}
                      className="w-full text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center justify-center gap-1.5"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                    >
                      <Settings className="w-3 h-3" /> Configurar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rates' && (
        <ComingSoon
          title="Tarifas dinámicas por canal"
          items={[
            'Tarifas base por tipo de habitación',
            'Markup automático por canal (Booking, Airbnb, Expedia)',
            'Sincronización bidireccional con PMS',
            'Reglas de restricción mínima (LOS, CTA, CTD)',
            'Price shopping comparativo con competencia',
          ]}
        />
      )}

      {activeTab === 'availability' && (
        <ComingSoon
          title="Disponibilidad unificada"
          items={[
            'Calendario consolidado de todos los canales',
            'Push instantáneo de disponibilidad',
            'Control de overbooking con buffer configurable',
            'Histórico de disponibilidad por fecha',
          ]}
        />
      )}

      {activeTab === 'bookings' && (
        <ComingSoon
          title="Reservas centralizadas"
          items={[
            'Lista unificada de reservas de todos los canales',
            'Estado de pago en tiempo real',
            'Auto-confirmación en el PMS conectado',
            'Notificaciones por WhatsApp al huésped',
          ]}
        />
      )}

      {/* Tab: Inbox Unificado */}
      {activeTab === 'inbox' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {[
              { k: 'all',             l: 'Todos'     },
              { k: 'whatsapp',        l: 'WhatsApp'  },
              { k: 'instagram',       l: 'Instagram' },
              { k: 'facebook',        l: 'Facebook'  },
              { k: 'google_business', l: 'Google'    },
            ].map(({ k, l }) => (
              <button
                key={k}
                onClick={() => setInboxFilter(k)}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  background: inboxFilter === k ? 'var(--accent)' : 'var(--card)',
                  color: inboxFilter === k ? '#fff' : 'var(--text-2)',
                  border: '1px solid var(--border)',
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {filteredInbox.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
            >
              <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Aún no hay mensajes en este canal.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInbox.map(msg => {
                const meta = CHANNEL_META[msg.channel_key] || { label: msg.channel_key, icon: '🔗' };
                const time = msg.received_at
                  ? new Date(msg.received_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div
                    key={msg.id}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{
                      background: msg.status === 'unread' ? 'color-mix(in srgb, var(--accent) 5%, var(--card))' : 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="text-xl flex-shrink-0">{meta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>
                          {msg.sender_name || meta.label}
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{time}</div>
                      </div>
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-2)' }}>
                        {msg.message_text || '(sin texto)'}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg)', color: 'var(--text-3)' }}>
                          {meta.label}
                        </span>
                        {msg.status === 'unread' && (
                          <span className="text-[9px] font-bold" style={{ color: '#ef4444' }}>• sin leer</span>
                        )}
                        {msg.status === 'replied' && (
                          <span className="text-[9px]" style={{ color: '#22c55e' }}>✓ respondido</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
