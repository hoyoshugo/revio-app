import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, RefreshCw, ZoomIn, ZoomOut,
  X, LogIn, LogOut, Search, Loader2, User, Home
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCOP } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DAY_W = 44;

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

function fmt(d) { return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' }); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function toISO(d) { return d.toISOString().split('T')[0]; }
function dayDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function CheckInModal({ reservation, onClose, onDone, authHeaders }) {
  const [loading, setLoading] = useState(false);
  const [docOk, setDocOk] = useState(false);
  const guest = reservation.guests || {};
  const room = reservation.rooms || {};

  async function doCheckIn() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'checked_in' })
      });
      if (res.ok) { onDone(); onClose(); }
      else { const e = await res.json(); alert(e.error || 'Error al hacer check-in'); }
    } catch { alert('Error de conexión'); }
    setLoading(false);
  }

  return (
    <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rv-modal" style={{ maxWidth: 440 }}>
        <div className="rv-modal-header">
          <div className="flex items-center gap-2">
            <LogIn className="w-4 h-4 text-indigo-400" />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>Check-in</h2>
          </div>
          <button onClick={onClose} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="rv-modal-body space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {guest.first_name} {guest.last_name || ''}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                {guest.email || guest.phone || '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Habitación</div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {room.number || '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Check-out</div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {reservation.check_out || '—'}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={docOk} onChange={e => setDocOk(e.target.checked)}
              className="w-4 h-4 rounded" />
            <span className="text-sm" style={{ color: 'var(--text-2)' }}>
              Documento de identidad verificado
            </span>
          </label>
          {reservation.total_amount > 0 && (
            <div className="text-sm p-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', color: 'var(--text-2)' }}>
              Total de reserva: <strong style={{ color: 'var(--text-1)' }}>{formatCOP(reservation.total_amount)}</strong>
            </div>
          )}
        </div>
        <div className="rv-modal-footer">
          <button onClick={onClose} className="rv-btn-ghost">Cancelar</button>
          <button
            onClick={doCheckIn}
            disabled={!docOk || loading}
            className="rv-btn-primary flex items-center gap-2"
            style={{ opacity: !docOk ? 0.5 : 1 }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Hacer Check-in
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckOutModal({ reservation, onClose, onDone, authHeaders }) {
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const guest = reservation.guests || {};
  const room = reservation.rooms || {};

  useEffect(() => {
    async function fetchWallet() {
      if (!guest.id) return;
      try {
        const res = await fetch(`${API}/api/wallets?guest_id=${guest.id}`, { headers: authHeaders });
        const data = await res.json();
        const wallets = data.wallets || [];
        if (wallets.length > 0) setWalletBalance(wallets[0].balance);
      } catch {}
    }
    fetchWallet();
  }, [guest.id]);

  async function doCheckOut() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'checked_out' })
      });
      if (res.ok) { onDone(); onClose(); }
      else { const e = await res.json(); alert(e.error || 'Error al hacer check-out'); }
    } catch { alert('Error de conexión'); }
    setLoading(false);
  }

  async function generateInvoice() {
    try {
      const res = await fetch(`${API}/api/invoices`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: reservation.id,
          guest_id: guest.id,
          items: [{ description: `Estadía ${reservation.check_in} → ${reservation.check_out}`, amount: reservation.total_amount || 0, quantity: 1 }],
          notes: `Reserva ${reservation.confirmation_number || ''}`
        })
      });
      if (res.ok) alert('Factura generada correctamente');
    } catch { alert('Error generando factura'); }
  }

  return (
    <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rv-modal" style={{ maxWidth: 440 }}>
        <div className="rv-modal-header">
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>Check-out</h2>
          </div>
          <button onClick={onClose} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="rv-modal-body space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                {guest.first_name} {guest.last_name || ''}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                Hab. {room.number || '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Total estadía</div>
              <div className="font-bold" style={{ color: 'var(--text-1)' }}>
                {formatCOP(reservation.total_amount || 0)}
              </div>
            </div>
            {walletBalance !== null && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Saldo billetera</div>
                <div className="font-bold" style={{ color: walletBalance > 0 ? 'var(--success)' : 'var(--text-1)' }}>
                  {formatCOP(walletBalance)}
                </div>
              </div>
            )}
          </div>
          {walletBalance > 0 && (
            <div className="text-xs p-2 rounded-lg text-amber-400" style={{ background: 'rgba(245,158,11,0.1)' }}>
              El huésped tiene saldo en billetera. Recuerda hacer la devolución antes de hacer check-out.
            </div>
          )}
        </div>
        <div className="rv-modal-footer">
          <button onClick={onClose} className="rv-btn-ghost">Cancelar</button>
          <button onClick={generateInvoice} className="rv-btn-ghost flex items-center gap-1.5">
            Generar factura
          </button>
          <button onClick={doCheckOut} disabled={loading} className="rv-btn-primary flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Hacer Check-out
          </button>
        </div>
      </div>
    </div>
  );
}

function NewReservationModal({ rooms, onClose, onDone, authHeaders }) {
  const [form, setForm] = useState({ room_id: '', check_in: '', check_out: '', notes: '' });
  const [guestSearch, setGuestSearch] = useState('');
  const [guestResults, setGuestResults] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (guestSearch.length < 2) { setGuestResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`${API}/api/guests?search=${encodeURIComponent(guestSearch)}&limit=6`, { headers: authHeaders });
        const data = await res.json();
        setGuestResults(data.guests || []);
      } catch {}
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [guestSearch]);

  async function save() {
    if (!form.room_id || !form.check_in || !form.check_out) return;
    setSaving(true);
    try {
      const room = rooms.find(r => r.id === form.room_id);
      const body = {
        room_id: form.room_id,
        room_type_id: room?.room_type_id,
        check_in: form.check_in,
        check_out: form.check_out,
        rate_per_night: room?.room_types?.base_price || 0,
        source: 'direct',
        notes: form.notes,
      };
      if (selectedGuest) body.guest_id = selectedGuest.id;
      const res = await fetch(`${API}/api/reservations`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) { onDone(); onClose(); }
      else { const e = await res.json(); alert(e.error || 'Error creando reserva'); }
    } catch { alert('Error de conexión'); }
    setSaving(false);
  }

  const nights = form.check_in && form.check_out ? dayDiff(form.check_in, form.check_out) : 0;
  const room = rooms.find(r => r.id === form.room_id);
  const total = room?.room_types?.base_price ? nights * room.room_types.base_price : 0;

  return (
    <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rv-modal" style={{ maxWidth: 480 }}>
        <div className="rv-modal-header">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-400" />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text-1)' }}>Nueva Reserva</h2>
          </div>
          <button onClick={onClose} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="rv-modal-body space-y-4">
          {/* Guest search */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Huésped</label>
            {selectedGuest ? (
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <User className="w-4 h-4 text-indigo-400" />
                <span className="text-sm flex-1" style={{ color: 'var(--text-1)' }}>
                  {selectedGuest.first_name} {selectedGuest.last_name}
                </span>
                <button onClick={() => setSelectedGuest(null)} className="p-1 hover:text-rose-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
                <input
                  className="rv-input pl-8"
                  placeholder="Buscar huésped por nombre..."
                  value={guestSearch}
                  onChange={e => setGuestSearch(e.target.value)}
                />
                {(guestResults.length > 0 || searchLoading) && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-xl shadow-lg overflow-hidden"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {searchLoading && (
                      <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-3)' }}>Buscando...</div>
                    )}
                    {guestResults.map(g => (
                      <button key={g.id} onClick={() => { setSelectedGuest(g); setGuestSearch(''); setGuestResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)]" style={{ color: 'var(--text-1)' }}>
                        {g.first_name} {g.last_name}
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-3)' }}>{g.email || g.phone || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Room */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Habitación *</label>
            <select className="rv-select" value={form.room_id}
              onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}>
              <option value="">Seleccionar habitación</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>
                  {r.number} — {r.room_types?.name || r.name}
                  {r.room_types?.base_price ? ` (${formatCOP(r.room_types.base_price)}/noche)` : ''}
                </option>
              ))}
            </select>
          </div>
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Check-in *</label>
              <input type="date" className="rv-input" value={form.check_in}
                onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Check-out *</label>
              <input type="date" className="rv-input" value={form.check_out}
                min={form.check_in}
                onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))} />
            </div>
          </div>
          {nights > 0 && (
            <div className="flex justify-between text-sm p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
              <span style={{ color: 'var(--text-2)' }}>{nights} noche{nights !== 1 ? 's' : ''}</span>
              {total > 0 && <span className="font-semibold" style={{ color: 'var(--text-1)' }}>{formatCOP(total)}</span>}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Notas</label>
            <textarea className="rv-input" rows={2} placeholder="Solicitudes especiales..."
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="rv-modal-footer">
          <button onClick={onClose} className="rv-btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving || !form.room_id || !form.check_in || !form.check_out}
            className="rv-btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear reserva
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GanttCalendar() {
  const { authHeaders, propertyId } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 3); return d;
  });
  const [days, setDays] = useState(30);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [checkInRes, setCheckInRes] = useState(null);
  const [checkOutRes, setCheckOutRes] = useState(null);

  const dates = Array.from({ length: days }, (_, i) => addDays(startDate, i));
  const today = toISO(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const dateFrom = toISO(startDate);
      const dateTo   = toISO(addDays(startDate, days));
      const res = await fetch(
        `${API}/api/rooms/gantt/availability?date_from=${dateFrom}&date_to=${dateTo}`,
        { headers: authHeaders }
      );
      const data = await res.json();
      setRooms(data.rooms || []);
      setReservations(data.reservations || []);
    } catch (err) {
      console.error('Gantt load error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, days, authHeaders]);

  useEffect(() => { load(); }, [load]);

  function getRoomReservations(roomId) {
    return reservations.filter(r => r.room_id === roomId);
  }

  function getBarStyle(res) {
    const startOffset = dayDiff(toISO(startDate), res.check_in);
    const width       = dayDiff(res.check_in, res.check_out);
    const left  = Math.max(0, startOffset) * DAY_W;
    const widthPx = Math.min(width, days - startOffset) * DAY_W - 4;
    if (widthPx <= 0) return null;
    return { left, width: widthPx, color: STATUS_COLORS[res.status] || '#6366F1' };
  }

  async function moveReservation(resId, newRoomId, newCheckIn) {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    const nights = dayDiff(res.check_in, res.check_out);
    const newCheckOut = toISO(addDays(new Date(newCheckIn), nights));
    // Conflict check
    const conflicts = reservations.filter(r =>
      r.id !== resId && r.room_id === newRoomId &&
      r.check_in < newCheckOut && r.check_out > newCheckIn &&
      r.status !== 'cancelled'
    );
    if (conflicts.length > 0) {
      alert('Conflicto: hay otra reserva en esa habitación para esas fechas.');
      return;
    }
    try {
      const response = await fetch(`${API}/api/reservations/${resId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: newRoomId, check_in: newCheckIn, check_out: newCheckOut })
      });
      if (response.ok) load();
      else { const err = await response.json(); alert(err.error || 'No se pudo mover la reserva'); }
    } catch { alert('Error de conexión'); }
  }

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
      moveReservation(resId, roomId, dateStr);
    }
    setDragging(null);
  }
  function handleDragOver(e) { e.preventDefault(); }

  function handleBarClick(res) {
    if (res.status === 'confirmed') setCheckInRes(res);
    else if (res.status === 'checked_in') setCheckOutRes(res);
  }

  const roomStatusBadge = (status) => {
    const map = { available: 'room-available', occupied: 'room-occupied', maintenance: 'room-maintenance', cleaning: 'room-cleaning', blocked: 'room-blocked' };
    const labels = { available: 'Libre', occupied: 'Ocupada', maintenance: 'Mant.', cleaning: 'Limpieza', blocked: 'Bloqueada' };
    return <span className={`rv-badge ${map[status] || 'rv-badge-gray'} text-[9px]`}>{labels[status] || status}</span>;
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Calendario de Reservas</h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Vista Gantt — arrastra para mover · haz clic para check-in/out
          </p>
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
            {fmt(startDate)} — {fmt(addDays(startDate, days - 1))}
          </span>
          <button onClick={() => setStartDate(d => addDays(d, 7))} className="rv-btn-ghost p-1.5">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNewModal(true)} className="rv-btn-primary flex items-center gap-1.5">
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
        <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>
          Clic en barra: check-in (azul) / check-out (verde)
        </span>
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
                  <div className="gantt-row-label">
                    <div>
                      <div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{room.number}</div>
                      <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                        {room.room_types?.name || room.name}
                      </div>
                    </div>
                    {roomStatusBadge(room.status)}
                  </div>
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
                    {roomRes.map(res => {
                      const style = getBarStyle(res);
                      if (!style) return null;
                      const guestName = res.guests
                        ? `${res.guests.first_name} ${res.guests.last_name || ''}`
                        : 'Huésped';
                      const clickable = res.status === 'confirmed' || res.status === 'checked_in';
                      return (
                        <div
                          key={res.id}
                          className="gantt-bar"
                          style={{
                            left: style.left,
                            width: style.width,
                            background: style.color,
                            opacity: dragging === res.id ? 0.5 : 1,
                            cursor: clickable ? 'pointer' : 'grab',
                          }}
                          draggable
                          onDragStart={e => handleDragStart(e, res)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleBarClick(res)}
                          onMouseEnter={e => setTooltip({ res, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
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
        <div className="fixed z-50 rv-card text-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 70, minWidth: 180, maxWidth: 240 }}>
          <div className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
            {tooltip.res.guests
              ? `${tooltip.res.guests.first_name} ${tooltip.res.guests.last_name || ''}`
              : 'Huésped sin nombre'}
          </div>
          <div style={{ color: 'var(--text-2)' }}>
            {tooltip.res.check_in} → {tooltip.res.check_out}
          </div>
          <div className="mt-1">
            <span className="rv-badge"
              style={{ background: STATUS_COLORS[tooltip.res.status] + '25', color: STATUS_COLORS[tooltip.res.status] }}>
              {STATUS_LABELS[tooltip.res.status] || tooltip.res.status}
            </span>
          </div>
          {(tooltip.res.status === 'confirmed' || tooltip.res.status === 'checked_in') && (
            <div className="mt-1 text-[10px]" style={{ color: 'var(--text-3)' }}>
              Clic para {tooltip.res.status === 'confirmed' ? 'check-in' : 'check-out'}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewModal && (
        <NewReservationModal
          rooms={rooms}
          onClose={() => setShowNewModal(false)}
          onDone={load}
          authHeaders={authHeaders}
        />
      )}
      {checkInRes && (
        <CheckInModal
          reservation={checkInRes}
          onClose={() => setCheckInRes(null)}
          onDone={load}
          authHeaders={authHeaders}
        />
      )}
      {checkOutRes && (
        <CheckOutModal
          reservation={checkOutRes}
          onClose={() => setCheckOutRes(null)}
          onDone={load}
          authHeaders={authHeaders}
        />
      )}
    </div>
  );
}
