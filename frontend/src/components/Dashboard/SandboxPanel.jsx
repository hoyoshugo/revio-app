import React, { useState, useRef, useEffect } from 'react';
import {
  Beaker, Send, RefreshCw, CheckCircle, XCircle, AlertCircle,
  Rocket, MessageSquare, Loader, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CHECKLIST_ITEMS = [
  { key: 'backend',        label: 'Backend API',              test: async () => { const r = await fetch(`${API}/health`); return r.ok; } },
  { key: 'lobbypms',       label: 'Conexión LobbyPMS',        test: async (token, prop) => { const r = await fetch(`${API}/api/settings/test/lobbypms`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ slug: prop }) }); const d = await r.json(); return d.ok; } },
  { key: 'availability',   label: 'Disponibilidad consultada', test: async () => null },  // checked during chat
  { key: 'language',       label: 'Idioma detectado',          test: async () => null },  // checked during chat
  { key: 'payment_link',   label: 'Link de pago generado',     test: async () => null },  // checked during chat
  { key: 'whatsapp',       label: 'WhatsApp conectado',        test: async (token, prop) => { const r = await fetch(`${API}/api/settings/test/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ slug: prop }) }); const d = await r.json(); return d.ok; } },
];

function CheckItem({ label, status }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <div className="flex-shrink-0">
        {status === 'ok'      && <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />}
        {status === 'error'   && <XCircle className="w-4 h-4" style={{ color: 'var(--danger)' }} />}
        {status === 'loading' && <Loader className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />}
        {status === 'pending' && <div className="w-4 h-4 rounded-full border" style={{ borderColor: 'var(--border)' }} />}
        {status === 'skip'    && <AlertCircle className="w-4 h-4" style={{ color: 'var(--text-3)' }} />}
      </div>
      <span className="text-sm" style={{
        color: status === 'ok' ? 'var(--success)'
          : status === 'error' ? 'var(--danger)'
          : status === 'skip' ? 'var(--text-3)'
          : 'var(--text-2)'
      }}>
        {label}
      </span>
    </div>
  );
}

function ChatBubble({ role, content, ts }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2 group`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-sm"
          style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
          🤖
        </div>
      )}
      <div
        className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm"
        style={{
          background: isUser
            ? 'var(--cta)'
            : 'var(--card)',
          color: isUser ? 'white' : 'var(--text-1)',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        }}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        <p className={`text-[10px] mt-1 ${isUser ? 'text-white/60' : ''}`}
          style={!isUser ? { color: 'var(--text-3)' } : {}}>
          {ts}
        </p>
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
          style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
          TÚ
        </div>
      )}
    </div>
  );
}

export default function SandboxPanel({ property }) {
  const { token } = { token: localStorage.getItem('revio_token') || localStorage.getItem('mystica_token') };
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [sessionId, setSessionId]   = useState(null);
  const [checkStatus, setCheckStatus] = useState({});
  const [checking, setChecking]     = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [canActivate, setCanActivate] = useState(false);
  const [histories, setHistories]   = useState([]);
  const scrollRef = useRef(null);

  const propertySlug = property === 'all' ? 'isla-palma' : property;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    runChecklist();
    loadHistory();
  }, [property]);

  async function runChecklist() {
    setChecking(true);
    const results = {};

    for (const item of CHECKLIST_ITEMS) {
      if (item.test) {
        setCheckStatus(s => ({ ...s, [item.key]: 'loading' }));
        try {
          const res = await item.test(token, propertySlug);
          results[item.key] = res === null ? 'skip' : res ? 'ok' : 'error';
        } catch {
          results[item.key] = 'error';
        }
        setCheckStatus(s => ({ ...s, [item.key]: results[item.key] }));
        await new Promise(r => setTimeout(r, 200));
      } else {
        results[item.key] = 'pending';
        setCheckStatus(s => ({ ...s, [item.key]: 'pending' }));
      }
    }

    setChecking(false);
    // Can activate if at least backend + lobbypms are OK
    setCanActivate(results.backend === 'ok' && results.lobbypms !== 'error');
  }

  async function loadHistory() {
    try {
      const r = await fetch(`${API}/api/dashboard/conversations?property=${propertySlug}&sandbox=true&limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      setHistories(Array.isArray(d) ? d : []);
    } catch {}
  }

  async function initSession() {
    try {
      const r = await fetch(`${API}/api/chat/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_slug: propertySlug, language: 'es', sandbox: true })
      });
      const d = await r.json();
      setSessionId(d.session_id);
      setMessages([{
        role: 'agent',
        content: d.greeting || '¡Hola! Soy el agente Revio en modo ensayo. Pregúntame lo que quieras como si fuera un huésped real.',
        ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch {
      setMessages([{
        role: 'agent',
        content: '⚠️ No se pudo conectar con el backend. Verifica que el servidor esté corriendo en puerto 3001.',
        ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');

    const ts = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    setMessages(m => [...m, { role: 'user', content: text, ts }]);
    setLoading(true);

    try {
      const r = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          property_slug: propertySlug,
          sandbox: true
        })
      });
      const d = await r.json();

      const agentTs = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      setMessages(m => [...m, { role: 'agent', content: d.reply || 'Sin respuesta', ts: agentTs }]);

      // Auto-check items that can only be verified during conversation
      if (d.reply) {
        setCheckStatus(s => ({
          ...s,
          language: 'ok',
          availability: d.availability_checked ? 'ok' : s.availability,
          payment_link: (d.payment_link || d.reply?.includes('pago')) ? 'ok' : s.payment_link,
        }));
      }

      setCanActivate(true);
    } catch {
      setMessages(m => [...m, {
        role: 'agent',
        content: 'Error de conexión con el agente.',
        ts: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setSessionId(null);
  }

  const allChecksOk = Object.values(checkStatus).every(v => v === 'ok' || v === 'skip');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            <Beaker className="inline w-5 h-5 mr-2" style={{ color: 'var(--accent)' }} />
            Ensayo del Agente
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            Prueba el agente antes de activarlo en producción
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={runChecklist} disabled={checking}
            className="rv-btn-ghost text-xs flex items-center gap-1.5 px-3 py-2">
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            Re-verificar
          </button>
          {canActivate && (
            <button
              className="rv-btn-primary text-xs flex items-center gap-1.5 px-4 py-2"
              onClick={() => alert('Para activar en producción, ve a Configuración → Agente IA → Activar.')}
            >
              <Rocket className="w-3.5 h-3.5" />
              Activar en producción
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left: checklist + history */}
        <div className="lg:col-span-2 space-y-4">

          {/* Checklist */}
          <div className="rv-surface overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => setChecklistOpen(o => !o)}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                Checklist de verificación
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: allChecksOk ? 'var(--success)' : 'var(--text-3)' }}>
                  {Object.values(checkStatus).filter(v => v === 'ok').length}/{CHECKLIST_ITEMS.length}
                </span>
                {checklistOpen ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-3)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-3)' }} />}
              </div>
            </button>
            {checklistOpen && (
              <div className="px-4 pb-4 divide-y" style={{ borderTop: '1px solid var(--border)', '--tw-divide-color': 'var(--border)' }}>
                {CHECKLIST_ITEMS.map(item => (
                  <CheckItem key={item.key} label={item.label} status={checkStatus[item.key] || 'pending'} />
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium text-center"
            style={{
              background: allChecksOk
                ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                : 'color-mix(in srgb, var(--warning) 10%, transparent)',
              border: `1px solid color-mix(in srgb, ${allChecksOk ? 'var(--success)' : 'var(--warning)'} 25%, transparent)`,
              color: allChecksOk ? 'var(--success)' : 'var(--warning)'
            }}
          >
            {allChecksOk
              ? '✓ Sistema listo para producción'
              : checking
                ? '⏳ Verificando conexiones...'
                : '⚠️ Algunas conexiones necesitan atención'}
          </div>

          {/* History */}
          {histories.length > 0 && (
            <div className="rv-surface p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                  Ensayos anteriores
                </span>
              </div>
              <div className="space-y-2">
                {histories.slice(0, 5).map(h => (
                  <div key={h.id} className="text-xs flex items-center justify-between py-1.5 px-2 rounded-lg"
                    style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
                    <span className="truncate">{h.guest_identifier || 'Prueba'}</span>
                    <span style={{ color: 'var(--text-3)' }}>{new Date(h.started_at).toLocaleDateString('es-CO')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div className="lg:col-span-3 rv-surface flex flex-col overflow-hidden" style={{ height: '520px' }}>
          {/* Chat header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                Agente Revio — Modo Ensayo
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' }}>
                sandbox
              </span>
            </div>
            <div className="flex gap-1.5">
              {messages.length > 0 && (
                <button onClick={clearChat} className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}
            style={{ background: 'var(--bg)' }}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="text-4xl">🤖</div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                    Simula una conversación real
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                    El agente usará tus datos reales de {propertySlug}
                  </p>
                </div>
                <button onClick={initSession} className="rv-btn-primary text-sm px-6 py-2.5">
                  Iniciar conversación de prueba
                </button>
                <div className="text-xs space-y-1 mt-2" style={{ color: 'var(--text-3)' }}>
                  <p>Sugerencias: "¿Tienen habitaciones para el 15 de mayo?"</p>
                  <p>"¿Cuánto cuesta una doble para 2 noches?"</p>
                  <p>"¿Aceptan mascotas? ¿Cómo puedo reservar?"</p>
                </div>
              </div>
            ) : (
              messages.map((m, i) => <ChatBubble key={i} {...m} />)
            )}
            {loading && (
              <div className="flex justify-start gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>🤖</div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-3" style={{ background: 'var(--card)' }}>
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          {messages.length > 0 && (
            <div className="px-3 py-3 flex gap-2 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Escribe como si fueras un huésped..."
                className="rv-input text-sm flex-1"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="rv-btn-primary px-3 py-2 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
