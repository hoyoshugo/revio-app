import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Plus, X, RefreshCw, Mail, Phone, MapPin, Calendar } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('revio_token'); }

export default function GuestsPanel() {
  const [guests, setGuests] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', nationality: '', document_type: 'CC', document_number: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const url = search
      ? `${API}/api/guests?search=${encodeURIComponent(search)}`
      : `${API}/api/guests`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    setGuests(data.guests || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function selectGuest(g) {
    const res = await fetch(`${API}/api/guests/${g.id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    setSelected(data);
  }

  async function createGuest() {
    if (!form.first_name) return;
    await fetch(`${API}/api/guests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form)
    });
    setShowNew(false);
    setForm({ first_name: '', last_name: '', email: '', phone: '', nationality: '', document_type: 'CC', document_number: '', notes: '' });
    load();
  }

  return (
    <div className="flex gap-4 h-full">
      {/* List */}
      <div className="flex flex-col" style={{ width: 320, flexShrink: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Huéspedes</h1>
          <button onClick={() => setShowNew(true)} className="rv-btn-primary py-2 px-3 text-xs">
            <Plus className="w-3.5 h-3.5" /> Nuevo
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <input className="rv-input pl-9 text-sm" placeholder="Buscar huésped..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="rv-skeleton h-16 rounded-xl" />)
            : guests.map(g => (
              <div key={g.id} onClick={() => selectGuest(g)}
                className="rv-card cursor-pointer transition-all"
                style={{ borderColor: selected?.id === g.id ? 'var(--accent)' : 'var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                    {g.first_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" style={{ color: 'var(--text-1)' }}>
                      {g.first_name} {g.last_name}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{g.email || g.phone || '—'}</div>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="rv-card h-full flex flex-col items-center justify-center gap-4">
            <Users className="w-16 h-16" style={{ color: 'var(--text-3)' }} />
            <p style={{ color: 'var(--text-3)' }}>Selecciona un huésped</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rv-card">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #4338CA, #818CF8)', color: 'white' }}>
                  {selected.first_name?.[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                    {selected.first_name} {selected.last_name}
                  </h2>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {selected.email && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-2)' }}><Mail className="w-3.5 h-3.5" />{selected.email}</span>}
                    {selected.phone && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-2)' }}><Phone className="w-3.5 h-3.5" />{selected.phone}</span>}
                    {selected.nationality && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--text-2)' }}><MapPin className="w-3.5 h-3.5" />{selected.nationality}</span>}
                  </div>
                  <div className="flex gap-3 mt-3">
                    <div className="text-center"><div className="font-bold" style={{ color: 'var(--text-1)' }}>{selected.reservations?.length || 0}</div><div className="text-xs" style={{ color: 'var(--text-3)' }}>Estancias</div></div>
                    <div className="text-center"><div className="font-bold" style={{ color: 'var(--success)' }}>$ {(selected.total_spent || 0).toLocaleString('es-CO')}</div><div className="text-xs" style={{ color: 'var(--text-3)' }}>Gastado</div></div>
                  </div>
                </div>
              </div>
            </div>
            {selected.reservations?.length > 0 && (
              <div className="rv-card">
                <h3 className="font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Historial de estancias</h3>
                <div className="space-y-2">
                  {selected.reservations.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2"
                      style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-1)' }}>{r.check_in} → {r.check_out}</span>
                      </div>
                      <span className="rv-badge rv-badge-gray text-xs">{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showNew && (
        <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="rv-modal">
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Nuevo Huésped</h2>
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="rv-modal-body grid grid-cols-2 gap-4">
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
                  <input type={type || 'text'} className="rv-input text-sm" placeholder={placeholder}
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Notas</label>
                <textarea className="rv-input text-sm" rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={createGuest} className="rv-btn-primary">Crear huésped</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
