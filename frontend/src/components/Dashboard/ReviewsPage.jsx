/**
 * ReviewsPage — gestiona reseñas de plataformas externas con respuestas IA.
 * Lee de /api/reviews-ai/:propertyId y permite editar/publicar las respuestas.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Star, RefreshCw, Edit2, Copy, CheckCircle2, MessageSquare, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PLATFORM_META = {
  tripadvisor: { label: 'TripAdvisor', color: '#34e0a1', icon: '🦉' },
  google:      { label: 'Google',      color: '#4285f4', icon: '🔍' },
  booking:     { label: 'Booking.com', color: '#003580', icon: '🏩' },
  airbnb:      { label: 'Airbnb',      color: '#ff5a5f', icon: '🏠' },
};

const STATUS_META = {
  pending:        { label: 'Pendiente IA', color: '#f59e0b' },
  response_ready: { label: 'Respuesta lista', color: '#22c55e' },
  published:      { label: 'Publicada', color: '#0ea5e9' },
  ignored:        { label: 'Ignorada', color: '#6b7280' },
};

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3.5 h-3.5"
          style={{ color: i <= rating ? '#fbbf24' : '#374151', fill: i <= rating ? '#fbbf24' : 'none' }}
        />
      ))}
    </div>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return `${Math.floor(days / 30)} mes${days >= 60 ? 'es' : ''}`;
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h`;
  return 'ahora';
}

function ReviewCard({ review, onEdit, onPublish, onCopy, onGenerate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.ai_response || '');
  const [saving, setSaving] = useState(false);
  const platform = PLATFORM_META[review.platform] || { label: review.platform, icon: '🔗', color: '#6b7280' };
  const status = STATUS_META[review.status] || STATUS_META.pending;

  async function save() {
    setSaving(true);
    try {
      await onEdit(review.id, draft);
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">{platform.icon}</span>
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
              {review.reviewer_name || 'Huésped'}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Stars rating={review.rating || 0} />
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                {timeAgo(review.review_date || review.created_at)} · {platform.label}
              </span>
            </div>
          </div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
          style={{ color: status.color, borderColor: status.color, background: status.color + '15' }}
        >
          {status.label}
        </span>
      </div>

      {/* Texto reseña */}
      {review.title && (
        <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{review.title}</div>
      )}
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>
        "{review.review_text || '(sin texto)'}"
      </p>

      {/* Respuesta IA */}
      {review.ai_response ? (
        <div
          className="rounded-xl p-3 border"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
              🤖 Respuesta sugerida por IA
            </span>
          </div>
          {editing ? (
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={5}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-1)' }}>
              {review.ai_response}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {editing ? (
              <>
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-[11px] px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-[11px] px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setDraft(review.ai_response); setEditing(true); }}
                  className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                >
                  <Edit2 className="w-3 h-3" /> Editar respuesta
                </button>
                <button
                  onClick={() => onCopy(review.ai_response)}
                  className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                >
                  <Copy className="w-3 h-3" /> Copiar
                </button>
                {review.status !== 'published' && (
                  <button
                    onClick={() => onPublish(review.id)}
                    className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 font-medium"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Marcar publicada
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => onGenerate(review.id)}
          className="text-[11px] px-3 py-1.5 rounded-lg font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          🤖 Generar respuesta con IA
        </button>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const { token, currentProperty, properties } = useAuth();
  const propertyId = currentProperty?.id || properties?.[0]?.id || '';
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/reviews-ai/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setReviews((await r.json()).reviews || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [propertyId, token]);

  useEffect(() => { load(); }, [load]);

  async function fetchNew() {
    setFetching(true);
    try {
      await fetch(`${API}/api/reviews-ai/${propertyId}/fetch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch (e) { console.error(e); }
    setFetching(false);
  }

  async function generateResponse(reviewId) {
    try {
      await fetch(`${API}/api/reviews-ai/${reviewId}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch (e) { console.error(e); }
  }

  async function editResponse(reviewId, newText) {
    await fetch(`${API}/api/reviews-ai/${reviewId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_response: newText }),
    });
    await load();
  }

  async function publishReview(reviewId) {
    await fetch(`${API}/api/reviews-ai/${reviewId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text);
  }

  const filtered = reviews.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'tripadvisor' || filter === 'google') return r.platform === filter;
    return r.status === filter;
  });

  const pendingCount = reviews.filter(r => r.status === 'response_ready').length;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Reseñas</h1>
            {pendingCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: '#ef4444', color: '#fff' }}>
                {pendingCount} listas para publicar
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            La IA lee las reseñas y redacta la respuesta. Tú la editas y publicas con un clic.
          </p>
        </div>
        <button
          onClick={fetchNew}
          disabled={fetching}
          className="text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
          {fetching ? 'Buscando...' : 'Buscar nuevas reseñas'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-1">
        {[
          { k: 'all',            l: 'Todas' },
          { k: 'pending',        l: 'Pendientes' },
          { k: 'response_ready', l: 'Respuesta lista' },
          { k: 'published',      l: 'Publicadas' },
          { k: 'tripadvisor',    l: 'TripAdvisor' },
          { k: 'google',         l: 'Google' },
        ].map(({ k, l }) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: filter === k ? 'var(--accent)' : 'var(--card)',
              color: filter === k ? '#fff' : 'var(--text-2)',
              border: '1px solid var(--border)',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Lista de reseñas */}
      {loading && (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-2)' }}>
          Cargando reseñas...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px dashed var(--border)' }}
        >
          <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Aún no hay reseñas en este filtro. Configura TripAdvisor en Integraciones para empezar.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(review => (
          <ReviewCard
            key={review.id}
            review={review}
            onEdit={editResponse}
            onPublish={publishReview}
            onCopy={copyText}
            onGenerate={generateResponse}
          />
        ))}
      </div>
    </div>
  );
}
