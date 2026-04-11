/**
 * LearningPage — gestiona items de aprendizaje del agente IA.
 * Lee de /api/learning/:propertyId y permite aplicar correcciones
 * que se persisten en property_knowledge.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap, CheckCircle2, XCircle, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SOURCE_META = {
  ensayo:         { label: 'Ensayo',          color: '#9333ea' },
  conversation:   { label: 'Conversación',     color: '#0ea5e9' },
  auto_detected:  { label: 'Auto-detectado',   color: '#f59e0b' },
  escalation:     { label: 'Escalación',       color: '#ef4444' },
};

const ISSUE_META = {
  no_answer:    'Sin respuesta',
  wrong_answer: 'Respuesta incorrecta',
  incomplete:   'Respuesta incompleta',
  confusing:    'Respuesta confusa',
  escalation:   'Escalación',
};

function ItemCard({ item, onApply, onDismiss }) {
  const [draft, setDraft] = useState(item.suggested_fix || '');
  const [saving, setSaving] = useState(false);
  const src = SOURCE_META[item.source] || SOURCE_META.ensayo;

  async function apply() {
    if (!draft.trim()) {
      alert('Escribe la respuesta correcta antes de aplicar');
      return;
    }
    setSaving(true);
    try { await onApply(item.id, draft); }
    catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
            style={{ color: src.color, borderColor: src.color, background: src.color + '15' }}
          >
            🔴 {ISSUE_META[item.issue_type] || item.issue_type}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            fuente: {src.label}
          </span>
        </div>
        <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
          {new Date(item.created_at).toLocaleDateString('es-CO')}
        </span>
      </div>

      {/* Pregunta del huésped */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-2)' }}>
          Pregunta del huésped
        </div>
        <p className="text-sm" style={{ color: 'var(--text-1)' }}>
          "{item.original_question}"
        </p>
      </div>

      {/* Respuesta actual */}
      {item.agent_response && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-2)' }}>
            Respuesta actual del agente
          </div>
          <p className="text-sm italic" style={{ color: 'var(--text-2)' }}>
            "{item.agent_response}"
          </p>
        </div>
      )}

      {/* Respuesta correcta */}
      {item.status === 'pending' ? (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>
            ¿Cuál debería ser la respuesta correcta?
          </div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            placeholder="Escribe la respuesta exacta que el agente debería dar..."
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={apply}
              disabled={saving || !draft.trim()}
              className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {saving ? 'Aplicando...' : 'Aplicar y entrenar'}
            </button>
            <button
              onClick={() => onDismiss(item.id)}
              className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
            >
              <XCircle className="w-3.5 h-3.5" /> Descartar
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs" style={{ color: 'var(--text-3)' }}>
          {item.status === 'applied' ? '✅ Aplicado al agente' : '⚫ Descartado'}
          {item.applied_by && ` por ${item.applied_by}`}
        </div>
      )}
    </div>
  );
}

export default function LearningPage() {
  const { token, currentProperty, properties } = useAuth();
  const propertyId = currentProperty?.id || properties?.[0]?.id || '';
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/learning/${propertyId}?status=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setItems((await r.json()).items || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [propertyId, token, tab]);

  useEffect(() => { load(); }, [load]);

  async function applyItem(id, fix) {
    await fetch(`${API}/api/learning/${id}/apply`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggested_fix: fix }),
    });
    await load();
  }

  async function dismissItem(id) {
    await fetch(`${API}/api/learning/${id}/dismiss`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Aprendizaje IA</h1>
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
          Mejora las respuestas del agente. Cada corrección que apliques se guarda
          en la base de conocimiento de la propiedad y el agente la usa de inmediato.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {[
          { k: 'pending',   l: 'Pendientes' },
          { k: 'applied',   l: 'Aplicados' },
          { k: 'dismissed', l: 'Descartados' },
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

      {!loading && items.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {tab === 'pending'
              ? 'No hay items pendientes — el agente está aprendiendo bien 🎉'
              : 'Sin items en este tab.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <ItemCard key={item.id} item={item} onApply={applyItem} onDismiss={dismissItem} />
        ))}
      </div>
    </div>
  );
}
