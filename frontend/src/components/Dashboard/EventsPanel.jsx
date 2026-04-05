import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, X, Trash2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('revio_token'); }

const IMPACT_COLORS = { low: '#94A3B8', medium: '#F59E0B', high: '#EF4444' };
const IMPACT_LABELS = { low: 'Bajo', medium: 'Medio', high: 'Alto' };

export default function EventsPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '', type: 'local', impact: 'medium', color: '#F59E0B' });

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API}/api/events?date_from=${today}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createEvent() {
    if (!form.name || !form.start_date || !form.end_date) return;
    await fetch(`${API}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form)
    });
    setShowNew(false);
    setForm({ name: '', description: '', start_date: '', end_date: '', type: 'local', impact: 'medium', color: '#F59E0B' });
    load();
  }

  async function deleteEvent(id) {
    await fetch(`${API}/api/events/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` }
    });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Eventos</h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Eventos que afectan ocupación y precios</p>
        </div>
        <button onClick={() => setShowNew(true)} className="rv-btn-primary">
          <Plus className="w-4 h-4" /> Nuevo evento
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rv-skeleton h-20 rounded-xl" />)}</div>
      ) : events.length === 0 ? (
        <div className="rv-card flex flex-col items-center gap-3 py-12">
          <CalendarDays className="w-12 h-12" style={{ color: 'var(--text-3)' }} />
          <p style={{ color: 'var(--text-3)' }}>No hay eventos próximos</p>
          <button onClick={() => setShowNew(true)} className="rv-btn-outline text-sm">Agregar evento</button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="rv-card flex items-center gap-4">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ev.color || IMPACT_COLORS[ev.impact] }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{ev.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  {ev.start_date} → {ev.end_date} · {ev.type}
                </div>
                {ev.description && <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-2)' }}>{ev.description}</div>}
              </div>
              <span className="rv-badge text-xs flex-shrink-0"
                style={{ background: `${IMPACT_COLORS[ev.impact]}20`, color: IMPACT_COLORS[ev.impact] }}>
                {IMPACT_LABELS[ev.impact]}
              </span>
              <button onClick={() => deleteEvent(ev.id)} className="rv-btn-ghost p-1.5 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="rv-modal" style={{ maxWidth: 480 }}>
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Nuevo Evento</h2>
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="rv-modal-body space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nombre *</label>
                <input className="rv-input" placeholder="Ej: Festival de la Música" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Fecha inicio *</label>
                  <input type="date" className="rv-input" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Fecha fin *</label>
                  <input type="date" className="rv-input" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Tipo</label>
                  <select className="rv-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="local">Local</option>
                    <option value="national">Nacional</option>
                    <option value="property">Propiedad</option>
                    <option value="holiday">Festivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Impacto</label>
                  <select className="rv-select" value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}>
                    <option value="low">Bajo</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Descripción</label>
                <textarea className="rv-input" rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={createEvent} className="rv-btn-primary">Crear evento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
