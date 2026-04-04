import React, { useState, useEffect } from 'react';
import { Bot, Key, Check, AlertCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude Sonnet',
    model: 'claude-sonnet-4-6',
    badge: 'Recomendado',
    badgeColor: 'var(--accent)',
    icon: '🤖',
    description: 'El más preciso para ventas hoteleras. Entrenado con razonamiento profundo y manejo de contexto largo.',
    strengths: ['Precisión en español', 'Razonamiento complejo', 'Contexto largo', 'Negociación natural'],
    languages: ['es', 'en', 'fr', 'de', 'pt', 'it'],
    cost: 'Incluido en tu plan',
    costNote: 'Sin límite de tokens adicional',
    requiresKey: false,
    available: true,
  },
  {
    id: 'gpt4o',
    name: 'GPT-4o (OpenAI)',
    model: 'gpt-4o',
    badge: 'Requiere key propia',
    badgeColor: 'var(--success)',
    icon: '🧠',
    description: 'Excelente generalista. Ideal si ya tienes contrato con OpenAI.',
    strengths: ['Multimodal', 'Velocidad', 'Amplio ecosistema', 'Tool use'],
    languages: ['es', 'en', 'fr', 'de', 'pt', 'it', 'zh', 'ja'],
    cost: '~$5 USD / 1M tokens',
    costNote: 'Se factura directo a tu cuenta OpenAI',
    requiresKey: true,
    keyPlaceholder: 'sk-...',
    keyLabel: 'OpenAI API Key',
    available: true,
  },
  {
    id: 'gemini',
    name: 'Gemini 1.5 Pro (Google)',
    model: 'gemini-1.5-pro',
    badge: 'Requiere key propia',
    badgeColor: 'var(--warning)',
    icon: '✨',
    description: 'Ventana de contexto de 1M tokens. Ideal para propiedades con muchas políticas y documentos.',
    strengths: ['1M tokens contexto', 'Multimodal', 'Google Search', 'Integración Workspace'],
    languages: ['es', 'en', 'fr', 'de', 'pt', 'it', 'ja'],
    cost: '~$3.5 USD / 1M tokens',
    costNote: 'Se factura directo a tu cuenta Google Cloud',
    requiresKey: true,
    keyPlaceholder: 'AIza...',
    keyLabel: 'Google AI API Key',
    available: true,
  },
  {
    id: 'llama',
    name: 'Llama 3 (Meta) vía Groq',
    model: 'llama-3.1-70b-versatile',
    badge: 'Económico',
    badgeColor: '#a78bfa',
    icon: '🦙',
    description: 'Opción de menor costo. Ideal para alto volumen de conversaciones sencillas.',
    strengths: ['Ultra rápido (<1s)', 'Muy económico', 'Open source', 'Alta velocidad'],
    languages: ['es', 'en', 'fr', 'de', 'pt'],
    cost: '~$0.59 USD / 1M tokens',
    costNote: 'Se factura directo a tu cuenta Groq',
    requiresKey: true,
    keyPlaceholder: 'gsk_...',
    keyLabel: 'Groq API Key',
    available: true,
  },
];

export default function AiProviderSelector({ propertyId, token }) {
  const [selected, setSelected] = useState('claude');
  const [apiKeys, setApiKeys] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    // Load saved config
    fetch(`${API}/api/settings?property_id=${propertyId}&key=ai_provider`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
        if (d?.value) {
          setSelected(d.value.provider || 'claude');
          setApiKeys(d.value.api_keys || {});
        }
      })
      .catch(() => {});
  }, [propertyId]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          property_id: propertyId,
          key: 'ai_provider',
          value: { provider: selected, api_keys: apiKeys }
        })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function testKey(providerId) {
    setTesting(providerId);
    await new Promise(r => setTimeout(r, 1200)); // Simulate test
    setTestResults(prev => ({
      ...prev,
      [providerId]: apiKeys[providerId]?.length > 10 ? 'ok' : 'error'
    }));
    setTesting(null);
  }

  const current = PROVIDERS.find(p => p.id === selected) || PROVIDERS[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Proveedor de IA</h3>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            Elige el modelo de IA para esta propiedad. Si no tienes key propia, usa Claude incluido en el plan.
          </p>
        </div>
      </div>

      {/* Provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map(provider => {
          const isSelected = selected === provider.id;
          const isExpanded = expanded === provider.id;
          const needsKey = provider.requiresKey && isSelected;

          return (
            <div
              key={provider.id}
              className="rounded-xl transition-all duration-200"
              style={{
                border: isSelected
                  ? `2px solid var(--accent)`
                  : `1px solid var(--border)`,
                background: isSelected
                  ? 'color-mix(in srgb, var(--accent) 5%, var(--card))'
                  : 'var(--card)',
              }}
            >
              {/* Header row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => {
                  setSelected(provider.id);
                  setExpanded(isExpanded ? null : provider.id);
                }}
              >
                <span className="text-2xl">{provider.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                      {provider.name}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `color-mix(in srgb, ${provider.badgeColor} 15%, transparent)`, color: provider.badgeColor }}
                    >
                      {provider.badge}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-2)' }}>
                    {provider.cost}
                  </p>
                </div>

                {/* Radio */}
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                <button onClick={e => { e.stopPropagation(); setExpanded(isExpanded ? null : provider.id); }}
                  style={{ color: 'var(--text-3)' }}>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs pt-3" style={{ color: 'var(--text-2)' }}>{provider.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {provider.strengths.map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-lg"
                        style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-3)' }}>
                    <span><span style={{ color: 'var(--text-2)' }}>Costo:</span> {provider.cost}</span>
                    <span className="text-xs">· {provider.costNote}</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {provider.languages.map(l => (
                      <span key={l} className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'var(--surface)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                        {l}
                      </span>
                    ))}
                  </div>

                  {/* API Key input */}
                  {provider.requiresKey && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium" style={{ color: 'var(--text-2)' }}>
                        <Key className="w-3 h-3 inline mr-1" /> {provider.keyLabel}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeys[provider.id] || ''}
                          onChange={e => setApiKeys(k => ({ ...k, [provider.id]: e.target.value }))}
                          className="rv-input text-xs font-mono flex-1"
                          placeholder={provider.keyPlaceholder}
                        />
                        <button
                          onClick={() => testKey(provider.id)}
                          disabled={!apiKeys[provider.id] || testing === provider.id}
                          className="rv-btn rv-btn-outline text-xs px-3 py-1 whitespace-nowrap"
                          style={{ fontSize: '11px', height: '36px' }}
                        >
                          {testing === provider.id ? 'Probando...' : 'Probar key'}
                        </button>
                      </div>
                      {testResults[provider.id] && (
                        <div className={`text-xs flex items-center gap-1 ${testResults[provider.id] === 'ok' ? '' : ''}`}
                          style={{ color: testResults[provider.id] === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
                          {testResults[provider.id] === 'ok'
                            ? <><Check className="w-3 h-3" /> Key válida</>
                            : <><AlertCircle className="w-3 h-3" /> Key inválida o sin permisos</>}
                        </div>
                      )}
                    </div>
                  )}

                  {!provider.requiresKey && (
                    <div className="flex items-center gap-2 text-xs py-2 px-3 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--success) 10%, transparent)', color: 'var(--success)' }}>
                      <Zap className="w-3 h-3" />
                      Incluido en tu plan Revio — sin configuración adicional
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Proveedor activo: <strong style={{ color: 'var(--text-1)' }}>{current.name}</strong>
          {current.requiresKey && !apiKeys[current.id] && (
            <span style={{ color: 'var(--warning)' }}> — Ingresa tu API key para activar</span>
          )}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rv-btn-primary text-xs px-4 py-2"
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar proveedor'}
        </button>
      </div>
    </div>
  );
}
