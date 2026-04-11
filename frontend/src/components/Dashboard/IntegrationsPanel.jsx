/**
 * IntegrationsPanel — versión moderna con 5 tabs y selección única por categoría.
 * Reemplaza a TabConnections dentro de ConfigPanel.
 *
 * Tabs:
 *   [IA] [Pagos] [PMS] [Mensajería] [OTAs y Reseñas]
 *
 * Flujos:
 *  · IA/Pagos/PMS: selección única via tenant_provider_selections + formulario
 *    de credenciales específico al proveedor activo.
 *  · Mensajería: lista de canales (no exclusivos), credenciales compartidas
 *    via FACEBOOK_PAGE_TOKEN.
 *  · OTAs: iCal URL + profile URL por canal, con ping vía HEAD.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, CreditCard, Building2, MessageCircle, Globe,
  Eye, EyeOff, RefreshCw, HelpCircle, Save, CheckCircle2, AlertCircle, Circle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useIntegrationGuide } from './IntegrationGuide.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ────────────────────────────────────────────────────────
// CATÁLOGOS
// ────────────────────────────────────────────────────────
const AI_PROVIDERS = [
  { key: 'anthropic', name: 'Claude', brand: 'Anthropic', icon: '🤖', guide: 'claude',
    fields: [{ k: 'api_key', label: 'Anthropic API Key', placeholder: 'sk-ant-api03-...', secret: true }] },
  { key: 'openai',    name: 'GPT-4',  brand: 'OpenAI',    icon: '🧠', guide: 'openai',
    fields: [{ k: 'api_key', label: 'OpenAI API Key', placeholder: 'sk-...', secret: true }] },
  { key: 'gemini',    name: 'Gemini', brand: 'Google',    icon: '✨', guide: 'gemini',
    fields: [{ k: 'api_key', label: 'Google AI API Key', placeholder: 'AIza...', secret: true }] },
];

const PAYMENT_PROVIDERS = [
  { key: 'wompi',       name: 'Wompi',         brand: 'Colombia', icon: '💳', guide: 'wompi',
    fields: [
      { k: 'public_key',  label: 'Llave pública',  placeholder: 'pub_prod_...', secret: false },
      { k: 'private_key', label: 'Llave privada',  placeholder: 'prv_prod_...', secret: true },
    ] },
  { key: 'mercadopago', name: 'Mercado Pago',  brand: 'LATAM',    icon: '🛒', guide: 'mercado_pago',
    fields: [
      { k: 'access_token', label: 'Access Token',  placeholder: 'APP_USR-...', secret: true },
      { k: 'public_key',   label: 'Public Key',    placeholder: 'APP_USR-...', secret: false },
    ] },
  { key: 'stripe',      name: 'Stripe',        brand: 'Global',   icon: '💰', guide: 'stripe',
    fields: [
      { k: 'public_key',  label: 'Publishable Key', placeholder: 'pk_live_...', secret: false },
      { k: 'secret_key',  label: 'Secret Key',      placeholder: 'sk_live_...', secret: true },
    ] },
];

const PMS_PROVIDERS = [
  { key: 'lobbypms',  name: 'LobbyPMS',  brand: 'LATAM',     icon: '🏨', guide: 'lobbypms',
    fields: [{ k: 'token', label: 'API Key', placeholder: 'lp_...', secret: true }] },
  { key: 'cloudbeds', name: 'Cloudbeds', brand: 'Global',    icon: '☁️', guide: 'cloudbeds',
    fields: [
      { k: 'client_id',     label: 'Client ID',     placeholder: 'cb_client_...', secret: false },
      { k: 'client_secret', label: 'Client Secret', placeholder: '...',           secret: true },
      { k: 'property_id',   label: 'Hotel ID',      placeholder: '12345',         secret: false },
    ] },
  { key: 'mews',      name: 'Mews',      brand: 'Global',    icon: '🔷', guide: 'mews',
    fields: [
      { k: 'access_token',  label: 'Access Token',   placeholder: 'mews_...', secret: true },
      { k: 'enterprise_id', label: 'Enterprise ID',  placeholder: 'uuid',     secret: false },
    ] },
  { key: 'none',      name: 'Ninguno',   brand: 'Manual',    icon: '🚫', guide: null, fields: [] },
];

const MESSAGING_CHANNELS = [
  { key: 'whatsapp', name: 'WhatsApp Business', icon: '💬', guide: 'whatsapp',
    fields: [
      { k: 'token',    label: 'WhatsApp Access Token', placeholder: 'EAAJ...',           secret: true  },
      { k: 'phone_id', label: 'Phone Number ID',       placeholder: '101206379439613',    secret: false },
    ] },
  { key: 'instagram', name: 'Instagram', icon: '📸', guide: 'instagram',
    note: 'Usa el mismo token de Facebook. Tu cuenta de Instagram debe estar vinculada a una Página de Facebook Business.',
    fields: [
      { k: 'business_id', label: 'Instagram Business ID', placeholder: '17841...', secret: false },
    ] },
  { key: 'facebook', name: 'Facebook Messenger', icon: '📘', guide: 'facebook',
    fields: [
      { k: 'page_token', label: 'Page Access Token', placeholder: 'EAAJ...', secret: true  },
      { k: 'page_id',    label: 'Page ID',           placeholder: '123...',  secret: false },
    ] },
  { key: 'google_business', name: 'Google Business Profile', icon: '🔍', guide: 'google_business',
    note: 'La verificación OAuth se completa en un paso adicional por el equipo de Revio.',
    fields: [
      { k: 'location_id', label: 'Business Profile ID', placeholder: 'accounts/.../locations/...', secret: false },
    ] },
];

const OTA_CHANNELS = [
  { key: 'booking',     name: 'Booking.com',  icon: '🏩', guide: 'booking_ical' },
  { key: 'airbnb',      name: 'Airbnb',       icon: '🏠', guide: 'airbnb_ical' },
  { key: 'expedia',     name: 'Expedia',      icon: '🗺️', guide: 'expedia_ical' },
  { key: 'hostelworld', name: 'Hostelworld',  icon: '🌍', guide: 'hostelworld_ical' },
  { key: 'despegar',    name: 'Despegar',     icon: '🛫', guide: 'despegar_ical' },
];

const REVIEW_CHANNELS = [
  { key: 'tripadvisor', name: 'TripAdvisor', icon: '🦉', guide: 'tripadvisor' },
];

// ────────────────────────────────────────────────────────
// PRIMITIVOS
// ────────────────────────────────────────────────────────
function HealthBadge({ status }) {
  const map = {
    connected:      { emoji: '🟢', label: 'Conectado',      color: '#22c55e' },
    unchecked:      { emoji: '🟡', label: 'Sin verificar',   color: '#f59e0b' },
    error:          { emoji: '🔴', label: 'Error',           color: '#ef4444' },
    not_configured: { emoji: '⚫', label: 'No configurado',  color: '#6b7280' },
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

function SecretField({ label, value, onChange, placeholder, secret = true }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-xs" style={{ color: 'var(--text-2)' }}>{label}</label>
      <div className="relative">
        <input
          type={secret && !visible ? 'password' : 'text'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        />
        {secret && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded hover:bg-white/5"
            style={{ color: 'var(--text-2)' }}
          >
            {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ provider, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(provider.key)}
      className="flex flex-col gap-1.5 rounded-xl p-4 text-left transition-all hover:scale-[1.02]"
      style={{
        background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--card))' : 'var(--card)',
        border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{provider.icon}</span>
        {active && <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />}
      </div>
      <div>
        <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{provider.name}</div>
        <div className="text-xs" style={{ color: 'var(--text-2)' }}>{provider.brand}</div>
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider"
        style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }}>
        {active ? 'Activo ✓' : 'Seleccionar'}
      </div>
    </button>
  );
}

function GuideButton({ guideId, onGuide }) {
  if (!guideId) return null;
  return (
    <button
      type="button"
      onClick={() => onGuide(guideId)}
      className="text-[11px] px-2.5 py-1 rounded-lg border transition-colors inline-flex items-center gap-1 hover:border-sky-500"
      style={{ borderColor: 'var(--border)', color: 'var(--text-2)', background: 'var(--bg)' }}
    >
      <HelpCircle className="w-3 h-3" />
      Cómo obtener la clave
    </button>
  );
}

// ────────────────────────────────────────────────────────
// PANEL PRINCIPAL
// ────────────────────────────────────────────────────────
const TABS = [
  { id: 'ai',         label: 'IA',               icon: Brain },
  { id: 'payments',   label: 'Pagos',            icon: CreditCard },
  { id: 'pms',        label: 'PMS',              icon: Building2 },
  { id: 'messaging',  label: 'Mensajería',       icon: MessageCircle },
  { id: 'otas',       label: 'OTAs y Reseñas',   icon: Globe },
];

export default function IntegrationsPanel({ properties = [], token }) {
  const { token: authToken, currentProperty, properties: authProperties } = useAuth();
  const tk = token || authToken;
  const props = properties.length ? properties : authProperties || [];
  const [propertyId, setPropertyId] = useState(currentProperty?.id || props[0]?.id || '');
  const [activeTab, setActiveTab] = useState('ai');

  // Estado
  const [selections, setSelections] = useState({});
  const [connections, setConnections] = useState({});
  const [channels, setChannels] = useState([]);
  const [health, setHealth] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { openGuide, GuideModal } = useIntegrationGuide();

  const loadAll = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const [selRes, settRes, chanRes, healthRes] = await Promise.all([
        fetch(`${API}/api/channels/${propertyId}/providers`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`${API}/api/settings?property_id=${propertyId}`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`${API}/api/channels/${propertyId}`,             { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`${API}/api/integration-health?property_id=${propertyId}`, { headers: { Authorization: `Bearer ${tk}` } }),
      ]);
      if (selRes.ok)    setSelections((await selRes.json()).selections || {});
      if (settRes.ok)   setConnections((await settRes.json()).settings?.connections || {});
      if (chanRes.ok)   setChannels((await chanRes.json()).channels || []);
      if (healthRes.ok) setHealth((await healthRes.json()).health || {});
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [propertyId, tk]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function toast(msg, ok = true) {
    // Simple toast via console + alert fallback. Se puede integrar con el sistema existente del proyecto.
    console.log(ok ? '✅' : '❌', msg);
  }

  async function saveProviderSelection(category, providerKey) {
    try {
      await fetch(`${API}/api/channels/${propertyId}/providers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, providerKey }),
      });
      setSelections(prev => ({ ...prev, [category]: providerKey }));
    } catch (e) { toast('Error al cambiar proveedor: ' + e.message, false); }
  }

  function updateConnection(section, key, value) {
    setConnections(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: value },
    }));
  }

  function channelOf(channelKey) {
    return channels.find(c => c.channel_key === channelKey) || { channel_key: channelKey };
  }

  function updateChannel(channelKey, patch) {
    setChannels(prev => {
      const idx = prev.findIndex(c => c.channel_key === channelKey);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [...prev, { channel_key: channelKey, ...patch }];
    });
  }

  async function saveAll() {
    setSaving(true);
    try {
      // 1. Guardar settings.connections (credenciales principales)
      await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, key: 'connections', value: connections }),
      });

      // 2. Guardar channels (ical_url / profile_url)
      for (const ch of channels) {
        if (!ch.channel_key) continue;
        await fetch(`${API}/api/channels/${propertyId}/${ch.channel_key}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ical_url: ch.ical_url ?? null,
            profile_url: ch.profile_url ?? null,
          }),
        });
      }

      // 3. Sincronizar iCal urls al key dedicado para el cron OTA sync
      const icalSummary = {
        booking_url:     channelOf('booking').ical_url     || '',
        airbnb_url:      channelOf('airbnb').ical_url      || '',
        hostelworld_url: channelOf('hostelworld').ical_url || '',
        expedia_url:     channelOf('expedia').ical_url     || '',
        vrbo_url:        '',
      };
      await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, key: 'ota_ical_urls', value: icalSummary }),
      });

      toast('Credenciales guardadas');
      await verifyAll();
    } catch (e) { toast('Error al guardar: ' + e.message, false); }
    setSaving(false);
  }

  async function verifyAll() {
    setVerifying(true);
    try {
      await fetch(`${API}/api/integration-health/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const h = await fetch(`${API}/api/integration-health?property_id=${propertyId}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (h.ok) setHealth((await h.json()).health || {});
    } catch (e) { toast('Error al verificar: ' + e.message, false); }
    setVerifying(false);
  }

  async function verifyChannel(channelKey) {
    try {
      await fetch(`${API}/api/channels/${propertyId}/${channelKey}/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tk}` },
      });
      const ch = await fetch(`${API}/api/channels/${propertyId}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      if (ch.ok) setChannels((await ch.json()).channels || []);
    } catch (e) { toast('Error: ' + e.message, false); }
  }

  const healthOf = (key) => health[key]?.status || 'unchecked';

  // ── Render helpers por tab ────────────────────────────
  function renderProviderTab(category, providers) {
    const active = selections[category];
    const provider = providers.find(p => p.key === active) || providers[0];
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map(p => (
            <ProviderCard
              key={p.key}
              provider={p}
              active={active === p.key}
              onSelect={(k) => saveProviderSelection(category, k)}
            />
          ))}
        </div>

        {provider && provider.fields?.length > 0 && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{provider.icon}</span>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{provider.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text-2)' }}>{provider.brand}</div>
                </div>
              </div>
              <HealthBadge status={healthOf(provider.key)} />
            </div>

            <div className="space-y-2">
              {provider.fields.map(field => (
                <SecretField
                  key={field.k}
                  label={field.label}
                  placeholder={field.placeholder}
                  secret={field.secret}
                  value={connections[provider.key]?.[field.k] || ''}
                  onChange={(v) => updateConnection(provider.key, field.k, v)}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <GuideButton guideId={provider.guide} onGuide={openGuide} />
              <button
                type="button"
                onClick={verifyAll}
                disabled={verifying}
                className="text-[11px] px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              >
                {verifying ? 'Verificando...' : 'Verificar conexión'}
              </button>
            </div>
          </div>
        )}

        {provider?.key === 'none' && (
          <div
            className="rounded-xl p-4 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--accent) 6%, var(--card))',
              border: '1px solid var(--border)',
              color: 'var(--text-2)',
            }}
          >
            Usando gestión manual de reservas. Puedes configurar un PMS cuando quieras.
          </div>
        )}
      </div>
    );
  }

  function renderMessagingTab() {
    return (
      <div className="space-y-3">
        {MESSAGING_CHANNELS.map(ch => (
          <div
            key={ch.key}
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xl">{ch.icon}</span>
                <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{ch.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <HealthBadge status={healthOf(ch.key)} />
                <GuideButton guideId={ch.guide} onGuide={openGuide} />
              </div>
            </div>

            {ch.note && (
              <div className="text-[11px] px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg)', color: 'var(--text-2)' }}>
                ℹ️ {ch.note}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ch.fields.map(field => (
                <SecretField
                  key={field.k}
                  label={field.label}
                  placeholder={field.placeholder}
                  secret={field.secret}
                  value={connections[ch.key]?.[field.k] || ''}
                  onChange={(v) => updateConnection(ch.key, field.k, v)}
                />
              ))}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => verifyChannel(ch.key)}
                className="text-[11px] px-3 py-1.5 rounded-lg font-medium"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              >
                Verificar
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderOtasTab() {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-2)' }}>
            OTAs de reservas — sincronización vía iCal
          </h3>
          <div className="space-y-2">
            {OTA_CHANNELS.map(ch => {
              const row = channelOf(ch.key);
              return (
                <div
                  key={ch.key}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ch.icon}</span>
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{ch.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HealthBadge status={row.status || 'not_configured'} />
                      <GuideButton guideId={ch.guide} onGuide={openGuide} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: 'var(--text-2)' }}>URL iCal de tu propiedad</label>
                      <input
                        type="text"
                        value={row.ical_url || ''}
                        onChange={e => updateChannel(ch.key, { ical_url: e.target.value, channel_type: 'ota' })}
                        placeholder="https://..."
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: 'var(--text-2)' }}>URL de perfil público</label>
                      <input
                        type="text"
                        value={row.profile_url || ''}
                        onChange={e => updateChannel(ch.key, { profile_url: e.target.value, channel_type: 'ota' })}
                        placeholder="https://..."
                        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                      />
                    </div>
                  </div>
                  <div className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>
                    💬 Respuesta de mensajes: próximamente vía Channel Manager
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-2)' }}>
            Plataformas de reseñas
          </h3>
          <div className="space-y-2">
            {REVIEW_CHANNELS.map(ch => {
              const row = channelOf(ch.key);
              return (
                <div
                  key={ch.key}
                  className="rounded-xl p-3 space-y-2"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{ch.icon}</span>
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{ch.name}</div>
                    </div>
                    <GuideButton guideId={ch.guide} onGuide={openGuide} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-2)' }}>URL de tu propiedad en {ch.name}</label>
                    <input
                      type="text"
                      value={row.profile_url || ''}
                      onChange={e => updateChannel(ch.key, { profile_url: e.target.value, channel_type: 'review' })}
                      placeholder="https://..."
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                    />
                  </div>
                  <div className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>
                    Respuesta automática a reseñas: próximamente
                  </div>
                </div>
              );
            })}
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: 'var(--bg)', border: '1px dashed var(--border)', color: 'var(--text-2)' }}
            >
              ℹ️ Google Reviews se configura junto con <strong>Google Business Profile</strong> en el tab Mensajería.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {GuideModal}

      {/* Selector de propiedad */}
      {props.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-2)' }}>Propiedad:</label>
          <select
            value={propertyId}
            onChange={e => setPropertyId(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          >
            {props.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
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

      {loading && (
        <div className="text-center text-xs py-8" style={{ color: 'var(--text-2)' }}>
          Cargando integraciones...
        </div>
      )}

      {!loading && (
        <div className="pb-24">
          {activeTab === 'ai'        && renderProviderTab('ai',       AI_PROVIDERS)}
          {activeTab === 'payments'  && renderProviderTab('payments', PAYMENT_PROVIDERS)}
          {activeTab === 'pms'       && renderProviderTab('pms',      PMS_PROVIDERS)}
          {activeTab === 'messaging' && renderMessagingTab()}
          {activeTab === 'otas'      && renderOtasTab()}
        </div>
      )}

      {/* Sticky bottom save bar */}
      <div
        className="sticky bottom-0 -mx-4 px-4 py-3 flex items-center justify-end gap-2"
        style={{
          background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={verifyAll}
          disabled={verifying}
          className="text-xs px-3 py-2 rounded-xl font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
          {verifying ? 'Verificando...' : 'Verificar ahora'}
        </button>
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="text-xs px-4 py-2 rounded-xl font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Guardando...' : 'Guardar todo'}
        </button>
      </div>
    </div>
  );
}
