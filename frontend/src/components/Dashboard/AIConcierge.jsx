import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, RefreshCw, TrendingUp, BarChart2, Star, User,
  ChevronRight, Loader2, Copy, Check
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('revio_token'); }

const SUGGESTIONS = [
  '¿Cómo mejorar la ocupación este fin de semana?',
  '¿Cuáles son las mejores prácticas para pricing dinámico?',
  'Dame un resumen del estado actual de la propiedad',
  '¿Qué habitaciones debo priorizar para mantenimiento?',
  'Ideas de upselling para huéspedes que hacen check-in hoy',
];

const AI_FEATURES = [
  { id: 'pricing', icon: TrendingUp, label: 'Pricing Inteligente', desc: 'Recomendaciones de precios basadas en ocupación y eventos' },
  { id: 'forecast', icon: BarChart2, label: 'Pronóstico', desc: 'Previsión de ocupación para los próximos 30 días' },
  { id: 'review', icon: Star, label: 'Responder Reseña', desc: 'Genera respuestas profesionales a reseñas de huéspedes' },
  { id: 'guest', icon: User, label: 'Perfil de Huésped', desc: 'Insights y oportunidades de upsell por huésped' },
];

function Message({ msg }) {
  const [copied, setCopied] = useState(false);

  function copyText() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
      <div
        className="relative max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
        style={{
          background: msg.role === 'user'
            ? 'var(--accent)'
            : 'var(--card)',
          color: msg.role === 'user' ? 'white' : 'var(--text-1)',
          borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        }}
      >
        {msg.loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span style={{ color: 'var(--text-2)' }}>Pensando...</span>
          </div>
        ) : (
          <>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            {msg.role === 'assistant' && (
              <button
                onClick={copyText}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                style={{ background: 'var(--surface)' }}
              >
                {copied ? <Check className="w-3 h-3" style={{ color: 'var(--success)' }} /> : <Copy className="w-3 h-3" style={{ color: 'var(--text-3)' }} />}
              </button>
            )}
          </>
        )}
        <div className="text-xs mt-1 opacity-60">
          {new Date(msg.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export default function AIConcierge() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy Revio Assistant. Puedo ayudarte con preguntas operativas, análisis de ocupación, precios, y más. ¿En qué puedo ayudarte hoy?', ts: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const [featureInput, setFeatureInput] = useState({});
  const [featureResult, setFeatureResult] = useState(null);
  const [featureLoading, setFeatureLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: msg, ts: Date.now() };
    const loadingMsg = { role: 'assistant', content: '', loading: true, ts: Date.now() + 1 };
    setMessages(m => [...m, userMsg, loadingMsg]);
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message: msg, history })
      });

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        // SSE streaming
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  fullText += parsed.text;
                  setMessages(m => m.map((msg, i) =>
                    i === m.length - 1 ? { ...msg, content: fullText, loading: false } : msg
                  ));
                }
              } catch {}
            }
          }
        }
      } else {
        const data = await res.json();
        setMessages(m => m.map((msg, i) =>
          i === m.length - 1 ? { ...msg, content: data.reply || 'Sin respuesta', loading: false } : msg
        ));
      }
    } catch (err) {
      setMessages(m => m.map((msg, i) =>
        i === m.length - 1 ? { ...msg, content: 'Error de conexión. Intenta de nuevo.', loading: false } : msg
      ));
    } finally {
      setLoading(false);
    }
  }

  async function runFeature(featureId) {
    setFeatureLoading(true);
    setFeatureResult(null);
    try {
      const endpoints = {
        pricing: '/api/ai/pricing',
        forecast: '/api/ai/forecast',
        review: '/api/ai/review-response',
        guest: '/api/ai/guest-insights',
      };
      const res = await fetch(`${API}${endpoints[featureId]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(featureInput)
      });
      const data = await res.json();
      setFeatureResult(data);
    } catch (err) {
      setFeatureResult({ error: err.message });
    } finally {
      setFeatureLoading(false);
    }
  }

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: 0 }}>
      {/* Chat */}
      <div className="flex flex-col flex-1 rv-surface" style={{ borderRadius: 12 }}>
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #4338CA, #818CF8)' }}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Revio AI Concierge</h2>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Asistente operativo inteligente</p>
          </div>
          <button
            onClick={() => setMessages([{ role: 'assistant', content: '¡Hola de nuevo! ¿En qué puedo ayudarte?', ts: Date.now() }])}
            className="ml-auto rv-btn-ghost p-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => <Message key={i} msg={msg} />)}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div className="px-4 pb-3 flex gap-2 flex-wrap">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full transition-all"
                style={{
                  border: '1.5px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--text-2)'
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-2)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex gap-2">
            <input
              className="rv-input flex-1"
              placeholder="Pregunta algo sobre la operación..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: input.trim() && !loading ? 'var(--accent)' : 'var(--card)',
                color: input.trim() && !loading ? 'white' : 'var(--text-3)'
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* AI Tools panel */}
      <div className="w-72 flex-shrink-0 space-y-3">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Herramientas IA</h3>
        {AI_FEATURES.map(feat => {
          const Icon = feat.icon;
          const isActive = activeFeature === feat.id;
          return (
            <div key={feat.id} className="rv-card space-y-3">
              <button
                onClick={() => setActiveFeature(isActive ? null : feat.id)}
                className="w-full flex items-center gap-3 text-left"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{feat.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>{feat.desc}</div>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform flex-shrink-0 ${isActive ? 'rotate-90' : ''}`}
                  style={{ color: 'var(--text-3)' }} />
              </button>

              {isActive && (
                <div className="space-y-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  {feat.id === 'review' && (
                    <textarea className="rv-input text-xs" rows={3}
                      placeholder="Pega el texto de la reseña aquí..."
                      onChange={e => setFeatureInput(fi => ({ ...fi, review_text: e.target.value }))} />
                  )}
                  {feat.id === 'pricing' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="rv-input text-xs"
                        placeholder="Desde" onChange={e => setFeatureInput(fi => ({ ...fi, date_from: e.target.value }))} />
                      <input type="date" className="rv-input text-xs"
                        placeholder="Hasta" onChange={e => setFeatureInput(fi => ({ ...fi, date_to: e.target.value }))} />
                    </div>
                  )}
                  <button
                    onClick={() => runFeature(feat.id)}
                    disabled={featureLoading}
                    className="w-full rv-btn-primary text-xs py-2"
                  >
                    {featureLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {featureLoading ? 'Analizando...' : 'Analizar con IA'}
                  </button>

                  {featureResult && (
                    <div className="text-xs p-3 rounded-lg overflow-auto max-h-48"
                      style={{ background: 'var(--bg)', color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
                      {featureResult.error
                        ? <span style={{ color: 'var(--danger)' }}>{featureResult.error}</span>
                        : JSON.stringify(featureResult, null, 2)
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
