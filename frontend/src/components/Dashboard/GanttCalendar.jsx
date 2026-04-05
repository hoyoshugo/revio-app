import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Info, ZoomIn, ZoomOut } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DAY_W = 44; // px per day column

function getToken() { return localStorage.getItem('revio_token'); }

const STATUS_COLORS = {
  confirmed:   '#6366F1',
  checked_in:  '#10B981',
  checked_out: '#64748B',
  cancelled:   '#EF4444',
  draft:       '#94A3B8',
  no_show:     '#F59E0B',
};

const STATUS_LABELS = {
  confirmed: 'Confirmada', checked_in: 'Check-in', checked_out: 'Check-out',
  cancelled: 'Cancelada', draft: 'Borrador', no_show: 'No Show'
};

function formatDate(d) {
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d) { return d.toISOString().split('T')[0]; }

function dayDiff(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export default function GanttCalendar({ property }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 3); return d;
  });
  const [days, setDays] = useState(30);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null); // { reservationId, originalRoom, originalStart }
  const [tooltip, setTooltip] = useState(null);   // { res, x, y }
  const [showNewModal, setShowNewModal] = useState(false);
  const [newRes, setNewRes] = useState({ room_id: '', check_in: '', check_out: '', guest_name: '' });

  const dates = Array.from({ length: days }, (_, i) => addDays(startDate, i));
  const today = toISO(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = toISO(startDate);
      const dateTo   = toISO(addDays(startDate, days));
      const res = await fetch(
        `${API}/api/rooms/gantt/availability?date_from=${dateFrom}&date_to=${dateTo}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const data = await res.json();
      setRooms(data.rooms || []);
      setReservations(data.reservations || []);
    } catch (err) {
      console.error('Gantt load error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, days]);

  useEffect(() => { load(); }, [load]);

  // Get reservations for a room
  function getRoomReservations(roomId) {
    return reservations.filter(r => r.room_id === roomId);
  }

  // Calculate bar position and width
  function getBarStyle(res) {
    const checkIn  = new Date(res.check_in);
    const checkOut = new Date(res.check_out);
    const startOffset = dayDiff(toISO(startDate), res.check_in);
    const width       = dayDiff(res.check_in, res.check_out);
    const left  = Math.max(0, startOffset) * DAY_W;
    const widthPx = Math.min(width, days - startOffset) * DAY_W - 4;
    if (widthPx <= 0) return null;
    return { left, width: widthPx, color: res.color || STATUS_COLORS[res.status] || '#6366F1' };
  }

  async function moveReservation(resId, newRoomId, newCheckIn, originalCheckIn) {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    const nights = dayDiff(res.check_in, res.check_out);
    const newCheckOut = toISO(addDays(new Date(newCheckIn), nights));
    try {
      const response = await fetch(`${API}/api/reservations/${resId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ room_id: newRoomId, check_in: newCheckIn, check_out: newCheckOut })
      });
      if (response.ok) {
        load();
      } else {
        const err = await response.json();
        alert(err.error || 'No se pudo mover la reserva');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  }

  async function createReservation() {
    if (!newRes.room_id || !newRes.check_in || !newRes.check_out) return;
    try {
      const room = rooms.find(r => r.id === newRes.room_id);
      await fetch(`${API}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          room_id: newRes.room_id,
          room_type_id: room?.room_type_id,
          check_in: newRes.check_in,
          check_out: newRes.check_out,
          rate_per_night: room?.room_types?.base_price || 0,
          source: 'direct'
        })
      });
      setShowNewModal(false);
      setNewRes({ room_id: '', check_in: '', check_out: '', guest_name: '' });
      load();
    } catch (err) {
      alert('Error creando reserva');
    }
  }

  // Drag handlers
  function handleDragStart(e, res) {
    e.dataTransfer.setData('reservationId', res.id);
    e.dataTransfer.setData('originalCheckIn', res.check_in);
    setDragging(res.id);
  }
  function handleDragEnd() { setDragging(null); }

  function handleDrop(e, roomId, dateStr) {
    e.preventDefault();
    const resId = e.dataTransfer.getData('reservationId');
    const originalCheckIn = e.dataTransfer.getData('originalCheckIn');
    if (resId && dateStr !== originalCheckIn) {
      moveReservation(resId, roomId, dateStr, originalCheckIn);
    }
    setDragging(null);
  }
  function handleDragOver(e) { e.preventDefault(); }

  const roomStatusBadge = (status) => {
    const map = { available: 'room-available', occupied: 'room-occupied', maintenance: 'room-maintenance', cleaning: 'room-cleaning', blocked: 'room-blocked' };
    const labels = { available: 'Libre', occupied: 'Ocupada', maintenance: 'Mant.', cleaning: 'Limpieza', blocked: 'Bloqueada' };
    return (
      <span className={`rv-badge ${map[status] || 'rv-badge-gray'} text-[9px]`}>{labels[status] || status}</span>
    );
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Calendario de Reservas</h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Vista Gantt — arrastra para mover reservas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rv-btn-ghost p-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setDays(d => Math.max(14, d - 7))} className="rv-btn-ghost p-1.5" title="Menos días">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setDays(d => Math.min(90, d + 7))} className="rv-btn-ghost p-1.5" title="Más días">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => setStartDate(d => addDays(d, -7))} className="rv-btn-ghost p-1.5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs px-2" style={{ color: 'var(--text-2)' }}>
            {formatDate(startDate)} — {formatDate(addDays(startDate, days - 1))}
          </span>
          <button onClick={() => setStartDate(d => addDays(d, 7))} className="rv-btn-ghost p-1.5">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="rv-btn-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nueva reserva
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-wrap flex-shrink-0">
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_COLORS[k] }} />
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Gantt grid */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="rv-surface flex-1 overflow-auto gantt-container" style={{ borderRadius: 12 }}>
          {/* Header row */}
          <div className="gantt-header-row" style={{ minWidth: 160 + days * DAY_W }}>
            <div className="gantt-room-label">Habitación</div>
            {dates.map(d => {
              const iso = toISO(d);
              const isToday = iso === today;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={iso} className={`gantt-day-cell ${isToday ? 'today' : ''}`}
                  style={{ background: isWeekend && !isToday ? 'color-mix(in srgb, var(--border) 20%, transparent)' : undefined }}>
                  <div style={{ fontWeight: isToday ? 700 : 400 }}>{d.getDate()}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                    {d.toLocaleDateString('es-CO', { weekday: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {rooms.length === 0 ? (
            <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-3)' }}>
              No hay habitaciones configuradas
            </div>
          ) : (
            rooms.map(room => {
              const roomRes = getRoomReservations(room.id);
              return (
                <div key={room.id} className="gantt-row" style={{ minWidth: 160 + days * DAY_W }}>
                  {/* Room label */}
                  <div className="gantt-row-label">
                    <div>
                      <div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>
                        {room.number}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {room.room_types?.name || room.name}
                      </div>
                    </div>
                    {roomStatusBadge(room.status)}
                  </div>

                  {/* Day cells */}
                  <div className="relative flex flex-1">
                    {dates.map(d => {
                      const iso = toISO(d);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div key={iso}
                          className={`gantt-grid-cell ${isWeekend ? 'weekend' : ''}`}
                          onDragOver={handleDragOver}
                          onDrop={e => handleDrop(e, room.id, iso)}
                        />
                      );
                    })}

                    {/* Reservation bars */}
                    {roomRes.map(res => {
                      const style = getBarStyle(res);
                      if (!style) return null;
                      const guestName = res.guests
                        ? `${res.guests.first_name} ${res.guests.last_name || ''}`
                        : 'Huésped';
                      return (
                        <div
                          key={res.id}
                          className="gantt-bar"
                          style={{
                            left: style.left,
                            width: style.width,
                            background: style.color,
                            opacity: dragging === res.id ? 0.5 : 1,
                          }}
                          draggable
                          onDragStart={e => handleDragStart(e, res)}
                          onDragEnd={handleDragEnd}
                          onMouseEnter={e => setTooltip({ res, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                          title={`${guestName} · ${res.check_in} → ${res.check_out}`}
                        >
                          {style.width > 80 && (
                            <span className="truncate">{guestName}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rv-card text-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 60, minWidth: 180, maxWidth: 240 }}
        >
          <div className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
            {tooltip.res.guests
              ? `${tooltip.res.guests.first_name} ${tooltip.res.guests.last_name || ''}`
              : 'Huésped sin nombre'
            }
          </div>
          <div style={{ color: 'var(--text-2)' }}>
            {tooltip.res.check_in} → {tooltip.res.check_out}
          </div>
          <div className="mt-1">
            <span className="rv-badge" style={{ background: STATUS_COLORS[tooltip.res.status] + '25', color: STATUS_COLORS[tooltip.res.status] }}>
              {STATUS_LABELS[tooltip.res.status] || tooltip.res.status}
            </span>
          </div>
          {tooltip.res.total_amount > 0 && (
            <div className="mt-1" style={{ color: 'var(--text-2)' }}>
              $ {tooltip.res.total_amount.toLocaleString('es-CO')} COP
            </div>
          )}
        </div>
      )}

      {/* New Reservation Modal */}
      {showNewModal && (
        <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewModal(false)}>
          <div className="rv-modal">
            <div className="rv-modal-header">
              <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>Nueva Reserva</h2>
              <button onClick={() => setShowNewModal(false)} className="rv-btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rv-modal-body space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                  Habitación
                </label>
                <select className="rv-select" value={newRes.room_id}
                  onChange={e => setNewRes(r => ({ ...r, room_id: e.target.value }))}>
                  <option value="">Seleccionar habitación</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.number} — {r.room_types?.name || r.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Check-in</label>
                  <input type="date" className="rv-input" value={newRes.check_in}
                    onChange={e => setNewRes(r => ({ ...r, check_in: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Check-out</label>
                  <input type="date" className="rv-input" value={newRes.check_out}
                    onChange={e => setNewRes(r => ({ ...r, check_out: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowNewModal(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={createReservation} className="rv-btn-primary">Crear reserva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
