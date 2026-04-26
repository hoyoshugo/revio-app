/**
 * MonitorPage — estado consolidado de todas las conexiones + sistema.
 * Secciones:
 *  1. Integraciones IA / Pagos / PMS
 *  2. Canales de mensajería (WhatsApp, IG, FB, Google)
 *  3. OTAs (iCal sync)
 *  4. Sistema (backend, DB, webhook, crons)
 *  5. Actividad reciente (platform_audits)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Circle,
  XCircle,
  Clock,
  Activity,
  Cpu,
  Database,
  Webhook,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function StatusDot({ status }) {
  const map = {
    connected: { color: '#22c55e', label: 'Conectado', emoji: '🟢' },
    up: { color: '#22c55e', label: 'Operativo', emoji: '🟢' },
    configured: { color: '#22c55e', label: 'Configurado', emoji: '🟢' },
    unchecked: { color: '#f59e0b', label: 'Sin verificar', emoji: '🟡' },
    pending: { color: '#f59e0b', label: 'Pendiente', emoji: '🟡' },
    scheduled: { color: '#f59e0b', label: 'Programado', emoji: '🟡' },
    error: { color: '#ef4444', label: 'Error', emoji: '🔴' },
    down: { color: '#ef4444', label: 'Caído', emoji: '🔴' },
    not_configured: { color: '#6b7280', label: 'Sin configurar', emoji: '⚫' },
  };
  const s = map[status] || map.not_configured;
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full border font-medium inline-flex items-center gap-1"
      style={{ color: s.color, borderColor: s.color, background: s.color + '15' }}
    >
      {s.emoji} {s.label}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'hace <1 min';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function Section({ title, icon: Icon, children }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2 text-sm font-semibold"
        style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-1)' }}
      >
        <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        {title}
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ left, middle, right, action }) {
  return (
    <div
      className="px-4 py-3 flex items-center gap-3 flex-wrap"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="font-medium text-xs" style={{ color: 'var(--text-1)' }}>
          {left}
        </div>
        {middle && (
          <div className="text-xs" style={{ color: 'var(--text-2)' }}>
            {middle}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">{right}</div>
      {action && <div>{action}</div>}
    </div>
  );
}

const CORE_INTEGRATIONS = [
  { key: 'anthropic', label: 'IA', provider: 'Anthropic Claude' },
  { key: 'wompi', label: 'Pagos', provider: 'Wompi' },
  { key: 'lobbypms', label: 'PMS', provider: 'LobbyPMS' },
];

const MESSAGING_CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'google_business', label: 'Google Business' },
];

// Cada OTA tiene flag enabled. Se ocultan hasta que el partner program apruebe
// integración API de Alzio. Cuando aprueben, flip enabled: true para esa entrada.
const OTA_CHANNELS = [
  { key: 'booking', label: 'Booking.com', enabled: false },
  { key: 'airbnb', label: 'Airbnb', enabled: false },
  { key: 'expedia', label: 'Expedia', enabled: false },
  { key: 'hostelworld', label: 'Hostelworld', enabled: false },
  { key: 'despegar', label: 'Despegar', enabled: false },
];

// Flag interno: la sección Sistema muestra infraestructura backend (Railway,
// crons, webhook URL). No tiene utilidad para el operador hotelero y filtra
// detalles internos. Default oculto. Cambiar a true sólo en builds super-admin.
const SHOW_SYSTEM_SECTION = false;

export default function MonitorPage() {
  const { token, currentProperty, properties } = useAuth();
  const propertyId = currentProperty?.id || properties?.[0]?.id || '';
  const [health, setHealth] = useState({});
  const [channels, setChannels] = useState([]);
  const [system, setSystem] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [usage, setUsage] = useState(null);

  const loadAll = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const [hRes, cRes, sRes, aRes] = await Promise.all([
        fetch(`${API}/api/integration-health?property_id=${propertyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/api/channels/${propertyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/api/system/health`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/system/audit-log?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (hRes.ok) setHealth((await hRes.json()).health || {});
      if (cRes.ok) setChannels((await cRes.json()).channels || []);
      if (sRes.ok) setSystem(await sRes.json());
      if (aRes.ok) setAuditLog((await aRes.json()).events || []);

      // Uso del agente del mes (no bloqueante si falla)
      try {
        const uRes = await fetch(`${API}/api/usage/current-month`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (uRes.ok) setUsage(await uRes.json());
      } catch { /* silencioso */ }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [propertyId, token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh cada 60s
  useEffect(() => {
    const id = setInterval(loadAll, 60_000);
    return () => clearInterval(id);
  }, [loadAll]);

  // Auto-verify on first mount: dispara un ping fresco para evitar mostrar
  // estados rancios (ej. WhatsApp "Error hace 20h" cuando ya está verde).
  // Solo corre una vez por sesión, después de que loadAll termine.
  const verifiedOnMount = useRef(false);
  useEffect(() => {
    if (verifiedOnMount.current || !propertyId || !token) return;
    verifiedOnMount.current = true;
    const t = setTimeout(() => {
      verifyAll().catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, token]);

  async function verifyAll() {
    setVerifying(true);
    try {
      await Promise.all([
        fetch(`${API}/api/integration-health/ping`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId }),
        }),
        ...MESSAGING_CHANNELS.map((ch) =>
          fetch(`${API}/api/channels/${propertyId}/${ch.key}/ping`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
      ]);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
    setVerifying(false);
  }

  const healthOf = (k) => health[k]?.status || 'unchecked';
  const checkedAt = (k) => health[k]?.last_checked_at;
  const channelOf = (k) => channels.find((c) => c.channel_key === k);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
              Monitor
            </h1>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                color: 'var(--accent)',
              }}
            >
              EN VIVO
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Estado de todas las conexiones e infraestructura. Auto-refresh cada 60 segundos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
          <button
            onClick={verifyAll}
            disabled={verifying}
            className="text-xs px-3 py-1.5 rounded-xl font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {verifying ? 'Verificando...' : 'Verificar todo ahora'}
          </button>
        </div>
      </div>

      {/* Sección 1: Integraciones core */}
      <Section title="Integraciones IA / Pagos / PMS" icon={Zap}>
        {CORE_INTEGRATIONS.map((i) => (
          <Row
            key={i.key}
            left={i.label}
            middle={i.provider}
            right={
              <>
                <StatusDot status={healthOf(i.key)} />
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {timeAgo(checkedAt(i.key))}
                </span>
              </>
            }
          />
        ))}
      </Section>

      {/* Sección 2: Canales de mensajería */}
      <Section title="Canales de mensajería" icon={Activity}>
        {MESSAGING_CHANNELS.map((ch) => {
          const row = channelOf(ch.key);
          return (
            <Row
              key={ch.key}
              left={ch.label}
              middle="0 mensajes hoy"
              right={
                <>
                  <StatusDot status={row?.status || 'not_configured'} />
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    {timeAgo(row?.last_checked_at)}
                  </span>
                </>
              }
            />
          );
        })}
      </Section>

      {/* Sección 3: OTAs — oculta mientras no haya partner programs aprobados */}
      {OTA_CHANNELS.some((c) => c.enabled) && (
        <Section title="OTAs (sincronización iCal)" icon={Clock}>
          {OTA_CHANNELS.filter((ota) => ota.enabled).map((ota) => {
            const row = channelOf(ota.key);
            const configured = !!row?.ical_url;
            return (
              <Row
                key={ota.key}
                left={ota.label}
                middle={configured ? 'iCal configurado ✅' : 'Sin configurar ❌'}
                right={
                  <>
                    <StatusDot status={row?.status || 'not_configured'} />
                    <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {timeAgo(row?.last_sync_at)}
                    </span>
                  </>
                }
              />
            );
          })}
        </Section>
      )}

      {/* Sección 4: Sistema — oculta para operadores hoteleros (infra interna) */}
      {SHOW_SYSTEM_SECTION && (
        <Section title="Sistema" icon={Cpu}>
          <Row
            left="Backend Railway"
            middle={system?.backend ? `uptime ${system.backend.uptime_human}` : '—'}
            right={<StatusDot status={system?.backend?.status || 'up'} />}
          />
          <Row
            left="Base de datos"
            middle="Supabase"
            right={<StatusDot status={system?.database?.status || 'up'} />}
          />
          <Row
            left="Webhook Meta"
            middle="/api/webhooks/meta"
            right={<StatusDot status={system?.webhook?.status || 'pending'} />}
          />
          <Row
            left="Cron iCal OTA"
            middle={system?.crons?.ical?.schedule || 'cada 15 min'}
            right={
              <>
                <StatusDot status={system?.crons?.ical?.status || 'scheduled'} />
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {timeAgo(system?.crons?.ical?.last_run)}
                </span>
              </>
            }
          />
          <Row
            left="Cron Currency"
            middle={system?.crons?.currency?.schedule || 'cada 2h'}
            right={
              <>
                <StatusDot status={system?.crons?.currency?.status || 'scheduled'} />
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {timeAgo(system?.crons?.currency?.last_run)}
                </span>
              </>
            }
          />
          <Row
            left="Cron Auditoría"
            middle={system?.crons?.audit?.schedule || 'domingos 08:00'}
            right={<StatusDot status={system?.crons?.audit?.status || 'scheduled'} />}
          />
        </Section>
      )}

      {/* Sección Uso del agente IA — solo si /api/usage devolvió datos */}
      {usage && (
        <Section title="Uso del agente IA — mes actual" icon={Zap}>
          <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Mensajes
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                {usage.totals?.messages || 0}
              </div>
              {usage.limit?.max_conversations_month > 0 && (
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-2)' }}>
                  de {usage.limit.max_conversations_month} ({usage.limit.used_pct}%)
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Tokens entrada
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                {(usage.totals?.input_tokens || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Tokens salida
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                {(usage.totals?.output_tokens || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Costo estimado
              </div>
              <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>
                ${(usage.totals?.cost_usd || 0).toFixed(4)} USD
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                {usage.billing_mode === 'byok' ? 'BYOK · pagas a Anthropic' : 'Plataforma Alzio'}
              </div>
            </div>
          </div>
          {usage.limit?.max_conversations_month > 0 && (
            <div className="px-4 pb-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${usage.limit.used_pct}%`,
                    background:
                      usage.limit.used_pct >= 90
                        ? '#ef4444'
                        : usage.limit.used_pct >= 70
                        ? '#f59e0b'
                        : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Sección 5: Actividad reciente */}
      <Section title="Actividad reciente" icon={Activity}>
        {auditLog.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-3)' }}>
            Aún no hay eventos registrados.
          </div>
        ) : (
          auditLog.map((evt) => (
            <Row
              key={evt.id}
              left={evt.platform || 'sistema'}
              middle={`${evt.audit_type || 'event'} · ${evt.total_reviews || 0} items`}
              right={
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  {timeAgo(evt.audited_at)}
                </span>
              }
            />
          ))
        )}
      </Section>
    </div>
  );
}
