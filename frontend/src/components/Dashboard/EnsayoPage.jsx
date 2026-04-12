/**
 * EnsayoPage — modo de prueba del agente IA antes de producción.
 * Panel izquierdo: configuración del ensayo (propiedad, canal, idioma, perfil)
 * Panel derecho: chat de prueba con metadata por mensaje
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Beaker, Flag, RefreshCw, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const GUEST_PROFILES = [
  { k: 'reservation', l: 'Viajero interesado en reservar' },
  { k: 'complaint',   l: 'Huésped con queja' },
  { k: 'activities',  l: 'Turista preguntando actividades' },
  { k: 'refund',      l: 'Huésped pidiendo reembolso' },
  { k: 'price',       l: 'Pregunta sobre precio' },
];

const LANGUAGES = [
  { k: 'es', l: 'Español' },
  { k: 'en', l: 'English' },
  { k: 'fr', l: 'Français' },
  { k: 'de', l: 'Deutsch' },
  { k: 'pt', l: 'Português' },
];

const CHANNELS = [
  { k: 'whatsapp',  l: 'WhatsApp' },
  { k: 'instagram', l: 'Instagram' },
  { k: 'web',       l: 'Web Chat' },
];

function ConfidenceBadge({ confidence }) {
  const colors = {
    alta:  '#22c55e',
    media: '#f59e0b',
    baja:  '#ef4444',
  };
  const c = colors[confidence] || '#6b7280';
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded-full border font-medium"
      style={{ color: c, borderColor: c, background: c + '15' }}
    >
      Confianza: {confidence}
    </span>
  );
}

function SourceBadge({ source }) {
  const isKb = source === 'property_knowledge';
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded-full border font-medium"
      style={{
        color: isKb ? '#0ea5e9' : '#9333ea',
        borderColor: isKb ? '#0ea5e9' : '#9333ea',
        background: (isKb ? '#0ea5e9' : '#9333ea') + '15',
      }}
    >
      Fuente: {isKb ? 'property_knowledge' : 'IA general'}
    </span>
  );
}

export default function EnsayoPage() {
  const { token, currentProperty, properties } = useAuth();
  const [propertyId, setPropertyId] = useState(currentProperty?.id || properties?.[0]?.id || '');
  const [channel, setChannel] = useState('whatsapp');
  const [language, setLanguage] = useState('es');
  const [guestProfile, setGuestProfile] = useState('reservation');
  const [strictMode, setStrictMode] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function reset() {
    setMessages([]);
    setDraft('');
    // Auto-enviar __INIT__ para que el agente se presente como grupo
    if (!propertyId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/ensayo/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          message: '__INIT__',
          conversationHistory: [],
          language,
          guestProfile,
          strictMode,
        }),
      });
      const data = await r.json();
      if (data.message) {
        setMessages([{ role: 'assistant', content: data.message, metadata: data.metadata || null }]);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // Al montar, enviar presentación de grupo
  useEffect(() => {
    if (propertyId && messages.length === 0) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function send() {
    if (!draft.trim() || loading) return;
    const userMsg = { role: 'user', content: draft.trim() };
    setMessages(m => [...m, userMsg]);
    setDraft('');
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/ensayo/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          message: userMsg.content,
          conversationHistory: messages,
          language,
          guestProfile,
          strictMode,
        }),
      });
      const data = await r.json();
      setMessages(m => [...m, {
        role: 'assistant',
        content: data.message || data.error || '(sin respuesta)',
        metadata: data.metadata || null,
      }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Error: ' + e.message }]);
    }
    setLoading(false);
  }

  // Modal state para "Marcar para mejorar"
  const [fixModal, setFixModal] = useState(null); // { msg, prevUserMsg }
  const [fixDraft, setFixDraft] = useState('');

  function openFixModal(msg, prevUserMsg) {
    setFixModal({ msg, prevUserMsg });
    setFixDraft('');
  }

  async function submitFix() {
    if (!fixModal) return;
    try {
      await fetch(`${API}/api/learning/${propertyId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'ensayo',
          original_question: fixModal.prevUserMsg?.content || '',
          agent_response: fixModal.msg.content,
          suggested_fix: fixDraft.trim() || null,
          issue_type: 'incomplete',
        }),
      });
      setFixModal(null);
      setFixDraft('');
    } catch (e) { alert('Error: ' + e.message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Ensayo — Prueba tu agente</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
          Simula conversaciones reales para verificar las respuestas antes de que lleguen a los huéspedes.
          Esta conversación es una simulación — no afecta datos reales.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Panel izquierdo: configuración */}
        <div className="md:col-span-2 space-y-3">
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
              Configuración del ensayo
            </h3>

            {properties && properties.length > 1 && (
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-2)' }}>Propiedad</label>
                <select
                  value={propertyId}
                  onChange={e => setPropertyId(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                >
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-2)' }}>Canal simulado</label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              >
                {CHANNELS.map(c => <option key={c.k} value={c.k}>{c.l}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-2)' }}>Idioma</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              >
                {LANGUAGES.map(l => <option key={l.k} value={l.k}>{l.l}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-2)' }}>Perfil del huésped</label>
              <select
                value={guestProfile}
                onChange={e => setGuestProfile(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              >
                {GUEST_PROFILES.map(g => <option key={g.k} value={g.k}>{g.l}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={strictMode}
                onChange={e => setStrictMode(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-xs" style={{ color: 'var(--text-2)' }}>
                Modo estricto (solo info parametrizada)
              </span>
            </label>

            <button
              onClick={reset}
              className="w-full text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Nueva conversación
            </button>
          </div>
        </div>

        {/* Panel derecho: chat */}
        <div className="md:col-span-3">
          <div
            className="rounded-2xl flex flex-col"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', height: 580 }}
          >
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <MessageCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                      Empieza el ensayo escribiendo un mensaje como si fueras el huésped.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                const prevUser = messages[i - 1]?.role === 'user' ? messages[i - 1] : null;
                return (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap"
                      style={{
                        background: m.role === 'user' ? 'var(--bg)' : 'color-mix(in srgb, var(--accent) 12%, var(--card))',
                        color: m.role === 'user' ? 'var(--text-2)' : 'var(--text-1)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {m.content}
                      {m.metadata && (
                        <div className="mt-2 pt-2 border-t flex items-center gap-1.5 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                          <SourceBadge source={m.metadata.source} />
                          <ConfidenceBadge confidence={m.metadata.confidence} />
                          <button
                            onClick={() => openFixModal(m, prevUser)}
                            className="text-[9px] px-1.5 py-0.5 rounded-full border flex items-center gap-1"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                          >
                            <Flag className="w-2.5 h-2.5" /> Marcar para mejorar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl px-3 py-2 text-xs"
                    style={{ background: 'var(--bg)', color: 'var(--text-3)' }}
                  >
                    El agente está escribiendo...
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), send())}
                  placeholder="Escribe como si fueras el huésped..."
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                  disabled={loading}
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() || loading}
                  className="px-4 py-2 rounded-lg disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-[10px]" style={{ color: 'var(--text-3)' }}>
                Esta conversación es una simulación. No afecta datos reales.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Marcar para mejorar */}
      {fixModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setFixModal(null)}
        >
          <div
            className="max-w-xl w-full rounded-2xl p-5 space-y-4"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                🚩 Marcar respuesta para mejorar
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                Escribe la respuesta correcta que el agente debería dar. Se guardará
                en Aprendizaje IA y al aplicarla quedará disponible de inmediato.
              </p>
            </div>
            {fixModal.prevUserMsg && (
              <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--text-3)' }}>Pregunta del huésped</div>
                <p style={{ color: 'var(--text-2)' }}>"{fixModal.prevUserMsg.content}"</p>
              </div>
            )}
            <div className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] uppercase font-bold mb-1" style={{ color: 'var(--text-3)' }}>Respuesta actual del agente</div>
              <p style={{ color: 'var(--text-2)' }}>"{fixModal.msg.content.slice(0, 200)}..."</p>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-2)' }}>
                ¿Qué debería decir el agente? (opcional — puedes dejarlo vacío y completarlo luego)
              </label>
              <textarea
                value={fixDraft}
                onChange={e => setFixDraft(e.target.value)}
                rows={5}
                placeholder="Escribe la respuesta exacta que el agente debería dar..."
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFixModal(null)}
                className="text-xs px-4 py-2 rounded-lg"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
              >
                Cancelar
              </button>
              <button
                onClick={submitFix}
                className="text-xs px-4 py-2 rounded-lg font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Guardar en Aprendizaje IA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
