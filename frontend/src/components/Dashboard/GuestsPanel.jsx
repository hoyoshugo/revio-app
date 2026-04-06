import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Users, Search, Plus, X, Star, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { formatCOP, formatDate, getInitials, avatarColor } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 25;

export default function GuestsPanel() {
  const navigate = useNavigate();
  const { token, propertyId } = useAuth();
  const [guests, setGuests] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    nationality: '', document_type: 'CC', document_number: '', notes: ''
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        ...(propertyId ? { property_id: propertyId } : {}),
        ...(search ? { search } : {}),
        ...(vipOnly ? { vip: 'true' } : {}),
      });
      const res = await fetch(`${API}/api/guests?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setGuests(data.guests || []);
      setTotal(data.total || data.guests?.length || 0);
    } catch {
      setGuests([]);
    }
    setLoading(false);
  }, [token, propertyId, search, vipOnly, page]);

  useEffect(() => {
    setPage(0);
  }, [search, vipOnly]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function createGuest() {
    if (!form.first_name) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/guests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, property_id: propertyId })
      });
      const data = await res.json();
      setShowNew(false);
      setForm({ first_name: '', last_name: '', email: '', phone: '', nationality: '', document_type: 'CC', document_number: '', notes: '' });
      // Navigate to new guest detail if we got an id back
      if (data.id) navigate(`/guests/${data.id}`);
      else load();
    } catch {}
    setCreating(false);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Huéspedes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            {total} huésped{total !== 1 ? 'es' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="rv-btn flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo huésped
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <input
            className="rv-input pl-9 text-sm w-full"
            placeholder="Buscar por nombre, email, teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setVipOnly(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
            vipOnly
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-1)]'
          }`}
        >
          <Star className={`w-4 h-4 ${vipOnly ? 'fill-amber-400' : ''}`} />
          Solo VIP
        </button>
      </div>

      {/* Table */}
      <div className="rv-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
        ) : guests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Users className="w-12 h-12" style={{ color: 'var(--text-3)' }} />
            <p style={{ color: 'var(--text-3)' }}>
              {search || vipOnly ? 'Sin resultados para esta búsqueda' : 'Aún no hay huéspedes registrados'}
            </p>
            {!search && !vipOnly && (
              <button onClick={() => setShowNew(true)} className="rv-btn text-sm">
                Agregar primer huésped
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Huésped', 'Documento', 'Email', 'Teléfono', 'Estancias', 'Total gastado', 'Última visita'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                      style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guests.map(g => {
                  const color = avatarColor((g.first_name || '') + (g.last_name || ''));
                  const initials = getInitials(g.first_name, g.last_name);
                  return (
                    <tr
                      key={g.id}
                      onClick={() => navigate(`/guests/${g.id}`)}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-1.5" style={{ color: 'var(--text-1)' }}>
                              {g.first_name} {g.last_name}
                              {g.vip && <Star className="w-3 h-3 fill-amber-400 text-amber-400" />}
                            </div>
                            {g.nationality && (
                              <div className="text-xs" style={{ color: 'var(--text-3)' }}>{g.nationality}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-2)' }}>
                        {g.document_number ? `${g.document_type || 'CC'} ${g.document_number}` : '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: 'var(--text-2)' }}>
                        {g.email || '—'}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-2)' }}>
                        {g.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-medium" style={{ color: 'var(--text-1)' }}>
                        {g.total_stays || g.reservations_count || 0}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--success)' }}>
                        {formatCOP(g.total_spent || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-3)' }}>
                        {g.last_stay_date || g.last_seen ? formatDate(g.last_stay_date || g.last_seen) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rv-btn-ghost p-2 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm px-2" style={{ color: 'var(--text-2)' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rv-btn-ghost p-2 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* New Guest Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="rv-card p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Nuevo Huésped</h2>
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'first_name', label: 'Nombre *', placeholder: 'Juan' },
                { key: 'last_name', label: 'Apellido', placeholder: 'García' },
                { key: 'email', label: 'Email', placeholder: 'juan@email.com', type: 'email' },
                { key: 'phone', label: 'Teléfono', placeholder: '+57 300 000 0000' },
                { key: 'nationality', label: 'Nacionalidad', placeholder: 'Colombia' },
                { key: 'document_number', label: 'Nro. Documento', placeholder: '12345678' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>{label}</label>
                  <input
                    type={type || 'text'}
                    className="rv-input text-sm w-full"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Notas</label>
                <textarea
                  className="rv-input text-sm w-full resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={createGuest} disabled={creating || !form.first_name} className="rv-btn flex items-center gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Crear huésped
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
