import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  ArrowLeft, Star, Mail, Phone, MapPin, Calendar, CreditCard,
  MessageSquare, FileText, Wifi, Edit2, X, Check, Loader2, Copy
} from 'lucide-react';
import { formatCOP, formatDate, getInitials, avatarColor } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TABS = [
  { id: 'profile', label: 'Perfil' },
  { id: 'stays', label: 'Estancias' },
  { id: 'wallet', label: 'Billetera' },
  { id: 'reviews', label: 'Reseñas' },
  { id: 'notes', label: 'Notas' },
];

const STATUS_COLORS = {
  confirmed: 'bg-blue-500/10 text-blue-400',
  checked_in: 'bg-emerald-500/10 text-emerald-400',
  checked_out: 'bg-slate-500/10 text-slate-400',
  cancelled: 'bg-red-500/10 text-red-400',
  pending: 'bg-amber-500/10 text-amber-400',
};

function Stars({ rating }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
      ))}
    </span>
  );
}

function ProfileTab({ guest }) {
  const fields = [
    { label: 'Nombre completo', value: `${guest.first_name || ''} ${guest.last_name || ''}`.trim() },
    { label: 'Email', value: guest.email },
    { label: 'Teléfono', value: guest.phone },
    { label: 'Documento', value: guest.document_number ? `${guest.document_type || 'CC'} ${guest.document_number}` : null },
    { label: 'Nacionalidad', value: guest.nationality },
    { label: 'País de residencia', value: guest.country },
    { label: 'Fecha de nacimiento', value: guest.birth_date ? formatDate(guest.birth_date) : null },
    { label: 'Cliente desde', value: guest.created_at ? formatDate(guest.created_at) : null },
  ];

  return (
    <div className="space-y-6">
      <div className="rv-card p-5">
        <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
          Información personal
        </h3>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {fields.filter(f => f.value).map(f => (
            <div key={f.label}>
              <dt className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-3)' }}>{f.label}</dt>
              <dd className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {guest.tags?.length > 0 && (
        <div className="rv-card p-5">
          <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
            Etiquetas
          </h3>
          <div className="flex flex-wrap gap-2">
            {guest.tags.map((tag, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StaysTab({ reservations }) {
  if (!reservations.length) {
    return (
      <div className="rv-card p-12 text-center">
        <Calendar className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
        <p style={{ color: 'var(--text-3)' }}>Sin estancias registradas</p>
      </div>
    );
  }

  return (
    <div className="rv-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            {['Confirmación', 'Check-in', 'Check-out', 'Noches', 'Total', 'Estado'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-3)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reservations.sort((a, b) => new Date(b.check_in) - new Date(a.check_in)).map(r => {
            const nights = Math.ceil((new Date(r.check_out) - new Date(r.check_in)) / 86400000);
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}
                className="hover:bg-[var(--surface-2)]/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-2)' }}>
                  {r.confirmation_number || r.id?.slice(0, 8)}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-1)' }}>{formatDate(r.check_in)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-1)' }}>{formatDate(r.check_out)}</td>
                <td className="px-4 py-3 text-center" style={{ color: 'var(--text-2)' }}>{nights}</td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--success)' }}>
                  {formatCOP(r.total_amount)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || STATUS_COLORS.pending}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WalletTab({ guest, token, propertyId }) {
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const gw = guest.guest_wallets?.[0] || guest.wallets?.[0];
    if (gw) {
      setWallet(gw);
      fetch(`${API}/api/wallets/${gw.id}/transactions?limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(d => setTxs(d.data || [])).catch(() => {});
    }
    setLoading(false);
  }, [guest, token]);

  async function createWallet() {
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/wallets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: guest.id, property_id: propertyId, initial_balance: 0 })
      });
      const data = await res.json();
      setWallet(data);
    } catch {}
    setCreating(false);
  }

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} /></div>;

  if (!wallet) {
    return (
      <div className="rv-card p-10 text-center">
        <CreditCard className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-3)' }} />
        <p className="font-medium mb-2" style={{ color: 'var(--text-1)' }}>Sin billetera NFC</p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Este huésped no tiene una billetera digital activa.</p>
        <button onClick={createWallet} disabled={creating}
          className="rv-btn flex items-center gap-2 mx-auto">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          Crear billetera
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rv-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Saldo disponible</p>
            <p className="text-3xl font-bold mt-0.5" style={{ color: 'var(--text-1)' }}>
              {formatCOP(wallet.balance || 0)}
            </p>
          </div>
          <div className="text-right">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              wallet.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
              wallet.status === 'frozen' ? 'bg-blue-500/10 text-blue-400' :
              'bg-slate-500/10 text-slate-400'
            }`}>
              {wallet.status}
            </span>
            <p className="text-xs mt-2 font-mono" style={{ color: 'var(--text-3)' }}>
              {wallet.wristband_uid || wallet.wristband_code || 'Sin NFC'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div style={{ color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--text-3)' }} className="text-xs">Total cargado</span>
            <p className="font-medium">{formatCOP(wallet.total_loaded || 0)}</p>
          </div>
          <div style={{ color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--text-3)' }} className="text-xs">Total gastado</span>
            <p className="font-medium">{formatCOP(wallet.total_spent || 0)}</p>
          </div>
        </div>
      </div>

      {txs.length > 0 && (
        <div className="rv-card p-5">
          <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text-1)' }}>Últimas transacciones</h3>
          <div className="space-y-2">
            {txs.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {tx.type === 'top_up' ? '⬆' : tx.type === 'purchase' ? '🛒' : tx.type === 'refund' ? '↩' : '💳'}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                      {tx.description || tx.type}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {formatDate(tx.created_at)}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'top_up' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.type === 'top_up' ? '+' : '-'}{formatCOP(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ reviews, guestId, token, propertyName }) {
  const [draftModal, setDraftModal] = useState(null); // { review, draft }
  const [generating, setGenerating] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateResponse(review) {
    setGenerating(review.id);
    try {
      const res = await fetch(`${API}/api/ai/review-response`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_text: review.comment || review.review_text,
          rating: review.overall_rating || review.rating,
          property_name: propertyName || 'nuestra propiedad'
        })
      });
      const data = await res.json();
      setDraftModal({ review, draft: data.response || data.draft || '' });
    } catch {
      setDraftModal({ review, draft: '' });
    }
    setGenerating(null);
  }

  async function saveResponse(reviewId, response) {
    setSaving(true);
    try {
      await fetch(`${API}/api/reviews/${reviewId}/respond`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
      setDraftModal(null);
    } catch {}
    setSaving(false);
  }

  if (!reviews.length) {
    return (
      <div className="rv-card p-10 text-center">
        <Star className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
        <p style={{ color: 'var(--text-3)' }}>Sin reseñas registradas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map(r => (
        <div key={r.id} className="rv-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Stars rating={r.overall_rating || r.rating || 5} />
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {r.source || 'Directo'} · {formatDate(r.created_at)}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                "{r.comment || r.review_text || 'Sin comentario'}"
              </p>
              {r.response && (
                <div className="mt-3 pl-3 border-l-2" style={{ borderColor: 'var(--accent)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>Respuesta:</p>
                  <p className="text-sm" style={{ color: 'var(--text-3)' }}>{r.response}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => generateResponse(r)}
              disabled={!!generating}
              className="rv-btn-ghost text-xs flex items-center gap-1 flex-shrink-0"
            >
              {generating === r.id
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <MessageSquare className="w-3 h-3" />
              }
              Responder con IA
            </button>
          </div>
        </div>
      ))}

      {/* Draft Modal */}
      {draftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setDraftModal(null)}>
          <div className="rv-card p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: 'var(--text-1)' }}>Borrador de respuesta</h3>
              <button onClick={() => setDraftModal(null)} className="rv-btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-lg text-sm italic" style={{
              background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
              color: 'var(--text-2)',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)'
            }}>
              "{draftModal.review.comment || draftModal.review.review_text}"
            </div>
            <textarea
              className="rv-input w-full resize-none"
              rows={5}
              value={draftModal.draft}
              onChange={e => setDraftModal(d => ({ ...d, draft: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(draftModal.draft); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="rv-btn-ghost text-sm flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={() => saveResponse(draftModal.review.id, draftModal.draft)}
                disabled={saving}
                className="rv-btn flex items-center gap-2 ml-auto"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar respuesta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NotesTab({ notes, onChange, onSave, saved }) {
  return (
    <div className="rv-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Notas internas</h3>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Check className="w-3.5 h-3.5" /> Guardado
          </span>
        )}
      </div>
      <textarea
        className="rv-input w-full resize-none"
        rows={8}
        placeholder="Notas privadas sobre este huésped (preferencias, historial, alertas)..."
        value={notes}
        onChange={e => onChange(e.target.value)}
        onBlur={onSave}
      />
      <button onClick={onSave} className="rv-btn text-sm flex items-center gap-2">
        <FileText className="w-4 h-4" /> Guardar notas
      </button>
    </div>
  );
}

export default function GuestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, currentProperty } = useAuth();
  const [guest, setGuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [updatingVIP, setUpdatingVIP] = useState(false);

  const load = useCallback(async () => {
    if (!id || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/guests/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setGuest(data);
      setNotes(data.notes || '');
    } catch {}
    setLoading(false);
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  async function saveNotes() {
    if (!guest) return;
    try {
      await fetch(`${API}/api/guests/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {}
  }

  async function toggleVIP() {
    if (!guest || updatingVIP) return;
    setUpdatingVIP(true);
    try {
      const res = await fetch(`${API}/api/guests/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vip: !guest.vip })
      });
      const updated = await res.json();
      setGuest(prev => ({ ...prev, vip: updated.vip ?? !prev.vip }));
    } catch {}
    setUpdatingVIP(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="rv-card p-12 text-center">
        <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-1)' }}>Huésped no encontrado</p>
        <button onClick={() => navigate('/guests')} className="rv-btn mt-4">← Volver</button>
      </div>
    );
  }

  const initials = getInitials(guest.first_name, guest.last_name);
  const color = avatarColor((guest.first_name || '') + (guest.last_name || ''));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="rv-card p-6">
        <button
          onClick={() => navigate('/guests')}
          className="rv-btn-ghost text-sm flex items-center gap-1.5 mb-4"
          style={{ color: 'var(--text-3)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Volver a huéspedes
        </button>

        <div className="flex items-start gap-5">
          <div className={`w-20 h-20 rounded-2xl ${color} flex items-center justify-center text-3xl font-bold text-white flex-shrink-0`}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
                {guest.first_name} {guest.last_name}
              </h1>
              {guest.vip && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ⭐ VIP
                </span>
              )}
              {guest.blacklisted && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                  🚫 Bloqueado
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap text-sm" style={{ color: 'var(--text-3)' }}>
              {guest.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{guest.email}</span>}
              {guest.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{guest.phone}</span>}
              {guest.nationality && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{guest.nationality}</span>}
            </div>

            <div className="flex items-center gap-6 mt-4 flex-wrap">
              <div>
                <div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                  {guest.reservations?.length || 0}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>Estancias</div>
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: 'var(--success)' }}>
                  {formatCOP(guest.total_spent || 0)}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>Total gastado</div>
              </div>
              {guest.last_stay_date && (
                <div>
                  <div className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                    {formatDate(guest.last_stay_date)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>Última estancia</div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={toggleVIP}
            disabled={updatingVIP}
            className="rv-btn-ghost text-sm flex items-center gap-1.5 flex-shrink-0"
          >
            {updatingVIP
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Star className={`w-4 h-4 ${guest.vip ? 'fill-amber-400 text-amber-400' : ''}`} />
            }
            {guest.vip ? 'Quitar VIP' : 'Marcar VIP'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-1)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'profile'  && <ProfileTab guest={guest} />}
      {tab === 'stays'    && <StaysTab reservations={guest.reservations || []} />}
      {tab === 'wallet'   && <WalletTab guest={guest} token={token} propertyId={currentProperty?.id} />}
      {tab === 'reviews'  && <ReviewsTab reviews={guest.guest_reviews || []} guestId={id} token={token} propertyName={currentProperty?.name} />}
      {tab === 'notes'    && <NotesTab notes={notes} onChange={setNotes} onSave={saveNotes} saved={notesSaved} />}
    </div>
  );
}
