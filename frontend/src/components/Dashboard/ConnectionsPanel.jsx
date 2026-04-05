/**
 * ConnectionsPanel.jsx — Gestión de integraciones por propiedad.
 *
 * Arquitectura multitenancy: todas las credenciales se guardan en la BD
 * via /api/connections. NUNCA se hardcodean valores de clientes.
 *
 * El panel muestra el estado de cada integración y permite al usuario
 * configurar sus propias credenciales de forma segura.
 */
import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://revio-app-production.up.railway.app';

// Definición de todas las integraciones disponibles en Revio
const INTEGRATIONS = [
  // PMS
  {
    key: 'lobbypms_token', name: 'LobbyPMS', category: 'PMS', icon: '🏨',
    fields: [{ name: 'token', label: 'API Token', type: 'password', placeholder: 'Tu token de LobbyPMS' }],
    buildValue: (f) => f.token,
    helpUrl: 'https://help.lobbypms.com/api',
  },
  {
    key: 'cloudbeds_config', name: 'Cloudbeds', category: 'PMS', icon: '☁️',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'cb_api_...' },
      { name: 'property_id', label: 'Property ID', type: 'text', placeholder: 'Tu Property ID' },
    ],
    buildValue: (f) => ({ api_key: f.api_key, property_id: f.property_id }),
    helpUrl: 'https://hotels.cloudbeds.com/api/v1.1/docs',
  },
  // Pagos
  {
    key: 'wompi_config', name: 'Wompi', category: 'Pagos', icon: '💳',
    fields: [
      { name: 'public_key', label: 'Llave Pública', type: 'text', placeholder: 'pub_prod_...' },
      { name: 'private_key', label: 'Llave Privada', type: 'password', placeholder: 'prv_prod_...' },
    ],
    buildValue: (f) => ({ public_key: f.public_key, private_key: f.private_key }),
    helpUrl: 'https://docs.wompi.co',
  },
  // Mensajería
  {
    key: 'whatsapp_config', name: 'WhatsApp Business', category: 'Mensajería', icon: '💬',
    fields: [
      { name: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAAc...' },
      { name: 'phone_number_id', label: 'Phone Number ID', type: 'text', placeholder: '101...' },
      { name: 'waba_id', label: 'WhatsApp Business Account ID', type: 'text', placeholder: '109...' },
    ],
    buildValue: (f) => ({ access_token: f.access_token, phone_number_id: f.phone_number_id, waba_id: f.waba_id }),
    helpUrl: 'https://developers.facebook.com/docs/whatsapp',
    note: 'Token válido ~60 días. Renueva en Meta Business Suite.',
  },
  {
    key: 'meta_config', name: 'Meta (Instagram/Facebook)', category: 'Mensajería', icon: '📱',
    fields: [
      { name: 'access_token', label: 'Page Access Token', type: 'password', placeholder: 'EAAc...' },
      { name: 'page_id', label: 'Facebook Page ID', type: 'text', placeholder: '764...' },
      { name: 'instagram_id', label: 'Instagram Account ID', type: 'text', placeholder: '170...' },
    ],
    buildValue: (f) => ({ access_token: f.access_token, page_id: f.page_id, instagram_id: f.instagram_id }),
    helpUrl: 'https://developers.facebook.com/docs',
  },
  // IA
  {
    key: 'anthropic_config', name: 'Claude (Anthropic)', category: 'IA', icon: '🤖',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-ant-api03-...' },
      { name: 'model', label: 'Modelo', type: 'select', options: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], default: 'claude-sonnet-4-6' },
    ],
    buildValue: (f) => ({ api_key: f.api_key, model: f.model || 'claude-sonnet-4-6' }),
    helpUrl: 'https://console.anthropic.com',
    note: 'Si no configuras una key propia, se usa la clave de plataforma de Revio.',
  },
  {
    key: 'openai_config', name: 'GPT-4o (OpenAI)', category: 'IA', icon: '🧠',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' },
      { name: 'model', label: 'Modelo', type: 'select', options: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], default: 'gpt-4o' },
    ],
    buildValue: (f) => ({ api_key: f.api_key, model: f.model || 'gpt-4o' }),
    helpUrl: 'https://platform.openai.com',
  },
  {
    key: 'groq_config', name: 'Llama (Groq)', category: 'IA', icon: '⚡',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'gsk_...' },
      { name: 'model', label: 'Modelo', type: 'select', options: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'], default: 'llama-3.3-70b-versatile' },
    ],
    buildValue: (f) => ({ api_key: f.api_key, model: f.model || 'llama-3.3-70b-versatile' }),
    helpUrl: 'https://console.groq.com',
    note: 'Groq ofrece velocidad extrema con modelos open-source.',
  },
  // OTAs
  {
    key: 'booking_config', name: 'Booking.com', category: 'OTAs', icon: '🏩',
    fields: [
      { name: 'api_key', label: 'Connectivity API Key', type: 'password', placeholder: 'Tu API key de partner' },
      { name: 'hotel_id', label: 'Hotel ID', type: 'text', placeholder: '1234567' },
    ],
    buildValue: (f) => ({ api_key: f.api_key, hotel_id: f.hotel_id }),
    helpUrl: 'https://partner.booking.com',
    note: 'Requiere aprobación como Connectivity Partner de Booking.com.',
  },
  {
    key: 'airbnb_config', name: 'Airbnb', category: 'OTAs', icon: '🏠',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Tu API key de partner' },
      { name: 'listing_id', label: 'Listing ID', type: 'text', placeholder: '123456789' },
    ],
    buildValue: (f) => ({ api_key: f.api_key, listing_id: f.listing_id }),
    helpUrl: 'https://www.airbnb.com/partner',
    note: 'Requiere aprobación como Software Partner de Airbnb.',
  },
];

const STATUS_CONFIG = {
  connected: { color: 'bg-green-500', text: 'Conectado', textColor: 'text-green-400' },
  error: { color: 'bg-red-500', text: 'Error', textColor: 'text-red-400' },
  disconnected: { color: 'bg-gray-500', text: 'No conectado', textColor: 'text-gray-400' },
};

function IntegrationCard({ integration, status, onSave, onTest }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const statusCfg = STATUS_CONFIG[status?.status || 'disconnected'];

  async function handleSave() {
    setSaving(true);
    await onSave(integration.key, integration.buildValue(form));
    setSaving(false);
    setExpanded(false);
    setForm({});
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const result = await onTest(integration.key);
    setTestResult(result);
    setTesting(false);
  }

  return (
    <div className="bg-gray-800/60 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{integration.icon}</span>
          <div>
            <p className="font-medium text-white">{integration.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.color}`} />
              <span className={`text-xs ${statusCfg.textColor}`}>{statusCfg.text}</span>
              {status?.updated_at && (
                <span className="text-xs text-gray-500">
                  · {new Date(status.updated_at).toLocaleDateString('es-CO')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {status?.status === 'connected' && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="text-xs px-2.5 py-1 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              {testing ? '...' : '🔄'}
            </button>
          )}
          <button
            onClick={() => { setExpanded(e => !e); setTestResult(null); }}
            className="text-xs px-3 py-1 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {expanded ? 'Cerrar' : status?.status === 'connected' ? 'Editar' : 'Conectar'}
          </button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs ${testResult.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
          {testResult.success ? '✅' : '❌'} {testResult.message}
        </div>
      )}

      {/* Note */}
      {integration.note && !expanded && (
        <p className="px-4 pb-3 text-xs text-yellow-500/80">{integration.note}</p>
      )}

      {/* Expanded form */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-3 space-y-3">
          {integration.note && (
            <p className="text-xs text-yellow-500/80 bg-yellow-500/10 px-3 py-2 rounded-lg">{integration.note}</p>
          )}

          {integration.fields.map(field => (
            <div key={field.name}>
              <label className="text-xs text-gray-400 block mb-1">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={form[field.name] || field.default || ''}
                  onChange={e => setForm(p => ({ ...p, [field.name]: e.target.value }))}
                >
                  {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={field.type}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={field.placeholder}
                  value={form[field.name] || ''}
                  onChange={e => setForm(p => ({ ...p, [field.name]: e.target.value }))}
                  autoComplete="off"
                />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            {integration.helpUrl && (
              <a
                href={integration.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                title="Ver documentación"
              >
                📖
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConnectionsPanel({ property }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState(null);

  const propertyId = property?.id;

  useEffect(() => {
    if (propertyId) loadConnections();
  }, [propertyId]);

  async function loadConnections() {
    setLoading(true);
    try {
      const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
      const r = await fetch(`${API_BASE}/api/connections/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const d = await r.json();
        setConnections(d.connections || []);
      }
    } catch (e) {
      console.error('[ConnectionsPanel] Error cargando:', e);
    }
    setLoading(false);
  }

  function getStatus(integrationKey) {
    return connections.find(c => c.key === integrationKey) || null;
  }

  async function handleSave(key, value) {
    const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
    try {
      const r = await fetch(`${API_BASE}/api/connections/${propertyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, value })
      });
      if (r.ok) {
        setSaveMsg('✅ Guardado correctamente');
        setTimeout(() => setSaveMsg(null), 3000);
        await loadConnections();
      } else {
        const d = await r.json();
        setSaveMsg('❌ Error: ' + (d.error || 'desconocido'));
        setTimeout(() => setSaveMsg(null), 5000);
      }
    } catch (e) {
      setSaveMsg('❌ Error de conexión');
      setTimeout(() => setSaveMsg(null), 5000);
    }
  }

  async function handleTest(key) {
    const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
    try {
      const r = await fetch(`${API_BASE}/api/connections/${propertyId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key })
      });
      return await r.json();
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Cargando integraciones...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Integraciones</h2>
          <p className="text-sm text-gray-400 mt-1">
            Conecta tus herramientas. Las credenciales se guardan encriptadas y no se comparten.
          </p>
        </div>
        {saveMsg && (
          <div className={`text-sm px-4 py-2 rounded-lg ${saveMsg.startsWith('✅') ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
            {saveMsg}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Conectadas', value: connections.filter(c => c.status === 'connected').length, color: 'text-green-400' },
          { label: 'Disponibles', value: INTEGRATIONS.length, color: 'text-blue-400' },
          { label: 'Con error', value: connections.filter(c => c.status === 'error').length, color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-800/40 rounded-xl p-3 text-center border border-gray-700">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Integrations by category */}
      {categories.map(category => (
        <div key={category} className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INTEGRATIONS.filter(i => i.category === category).map(integration => (
              <IntegrationCard
                key={integration.key}
                integration={integration}
                status={getStatus(integration.key)}
                onSave={handleSave}
                onTest={handleTest}
              />
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-500 text-center mt-4">
        Las credenciales se almacenan encriptadas con AES-256-GCM en tu base de datos privada de Supabase.
        Revio nunca accede a las claves de otros tenants.
      </p>
    </div>
  );
}
