import React, { useState, useEffect, useCallback } from 'react';
import { BedDouble, Plus, X, RefreshCw, Edit2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('revio_token'); }

const STATUS_MAP = {
  available:   { label: 'Disponible', cls: 'room-available' },
  occupied:    { label: 'Ocupada',    cls: 'room-occupied' },
  maintenance: { label: 'Mant.',      cls: 'room-maintenance' },
  cleaning:    { label: 'Limpieza',   cls: 'room-cleaning' },
  blocked:     { label: 'Bloqueada',  cls: 'room-blocked' },
};

export default function RoomsManager() {
  const [rooms, setRooms] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ number: '', name: '', floor: 1, capacity: 2, room_type_id: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [roomsRes, typesRes] = await Promise.all([
      fetch(`${API}/api/rooms`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch(`${API}/api/rooms/types`, { headers: { Authorization: `Bearer ${getToken()}` } }),
    ]);
    const [rd, td] = await Promise.all([roomsRes.json(), typesRes.json()]);
    setRooms(rd.rooms || []);
    setTypes(td.room_types || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveRoom() {
    if (!form.number) return;
    const method = editing ? 'PATCH' : 'POST';
    const url = editing ? `${API}/api/rooms/${editing}` : `${API}/api/rooms`;
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify(form)
    });
    setShowNew(false); setEditing(null);
    setForm({ number: '', name: '', floor: 1, capacity: 2, room_type_id: '' });
    load();
  }

  async function changeStatus(id, status) {
    await fetch(`${API}/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ status })
    });
    load();
  }

  function openEdit(room) {
    setForm({ number: room.number, name: room.name || '', floor: room.floor, capacity: room.capacity, room_type_id: room.room_type_id || '' });
    setEditing(room.id);
    setShowNew(true);
  }

  const grouped = types.length > 0
    ? types.reduce((acc, t) => {
        acc[t.id] = { type: t, rooms: rooms.filter(r => r.room_type_id === t.id) };
        return acc;
      }, {})
    : { all: { type: { name: 'Todas' }, rooms } };

  const summary = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Habitaciones</h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Gestión de habitaciones y estado en tiempo real</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="rv-btn-ghost p-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-2)' }} />
          </button>
          <button onClick={() => { setEditing(null); setForm({ number: '', name: '', floor: 1, capacity: 2, room_type_id: '' }); setShowNew(true); }}
            className="rv-btn-primary">
            <Plus className="w-4 h-4" /> Nueva hab.
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: summary.total, color: 'var(--text-2)' },
          { label: 'Disponibles', value: summary.available, color: 'var(--success)' },
          { label: 'Ocupadas', value: summary.occupied, color: 'var(--accent)' },
          { label: 'Limpieza', value: summary.cleaning, color: '#F472B6' },
        ].map(s => (
          <div key={s.label} className="rv-card text-center">
            <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rooms by type */}
      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="rv-skeleton h-24 rounded-xl" />)}
        </div>
      ) : (
        Object.values(grouped).map(({ type, rooms: groupRooms }) => (
          <div key={type.id || 'all'}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-2)' }}>
              {type.name} <span style={{ color: 'var(--text-3)' }}>({groupRooms.length})</span>
              {type.base_price && (
                <span className="ml-2 font-normal text-xs" style={{ color: 'var(--text-3)' }}>
                  Desde $ {type.base_price.toLocaleString('es-CO')}/noche
                </span>
              )}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              {groupRooms.map(room => {
                const st = STATUS_MAP[room.status] || STATUS_MAP.available;
                return (
                  <div key={room.id} className="rv-card text-center relative group" style={{ padding: '1rem' }}>
                    <button
                      onClick={() => openEdit(room)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rv-btn-ghost p-1"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <BedDouble className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
                    <div className="font-bold text-lg" style={{ color: 'var(--text-1)' }}>{room.number}</div>
                    {room.name && <div className="text-xs" style={{ color: 'var(--text-3)' }}>{room.name}</div>}
                    <div className="mt-2">
                      <select
                        className={`rv-badge ${st.cls} cursor-pointer text-xs border-0 bg-transparent`}
                        value={room.status}
                        onChange={e => changeStatus(room.id, e.target.value)}
                        style={{ appearance: 'none', cursor: 'pointer' }}
                      >
                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>Piso {room.floor}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {showNew && (
        <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="rv-modal" style={{ maxWidth: 440 }}>
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>
                {editing ? 'Editar Habitación' : 'Nueva Habitación'}
              </h2>
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="rv-modal-body grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Número *</label>
                <input className="rv-input" placeholder="101" value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nombre</label>
                <input className="rv-input" placeholder="Suite Caribe" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Piso</label>
                <input type="number" className="rv-input" value={form.floor}
                  onChange={e => setForm(f => ({ ...f, floor: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Capacidad</label>
                <input type="number" className="rv-input" value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Tipo de habitación</label>
                <select className="rv-select" value={form.room_type_id}
                  onChange={e => setForm(f => ({ ...f, room_type_id: e.target.value }))}>
                  <option value="">Sin tipo</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={saveRoom} className="rv-btn-primary">{editing ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
