import React, { useEffect, useState } from 'react';
import { Calendar, DollarSign, User, RefreshCw } from 'lucide-react';
import axios from 'axios';

const STATUS_COLORS = {
  pending: 'badge-prospect',
  confirmed: 'badge-quoted',
  paid: 'badge-paid',
  checked_in: 'badge-checked_in',
  checked_out: 'badge-checked_out',
  cancelled: 'badge-cancelled',
};
const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  paid: 'Pagado',
  checked_in: 'Hospedado',
  checked_out: 'Check-out',
  cancelled: 'Cancelado',
};

export default function BookingsList({ property }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (property !== 'all') params.property_slug = property;
      const { data } = await axios.get('/api/bookings', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setBookings(data.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [property, statusFilter]);

  async function updateStatus(id, status) {
    const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
    await axios.patch(
      `/api/bookings/${id}/status`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    load();
  }

  const totalRevenue = bookings
    .filter((b) => !['cancelled'].includes(b.status))
    .reduce((s, b) => s + (b.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white">Reservas</h1>
          <p className="text-sm text-gray-500">
            {bookings.length} reservas ·
            <span className="text-mystica-green ml-1">
              ${(totalRevenue / 1000000).toFixed(1)}M COP
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-mystica-blue"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button onClick={load} aria-label="Actualizar reservas" className="btn-ghost">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-20 animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No hay reservas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{b.guest_name}</span>
                    <span className={`badge ${STATUS_COLORS[b.status] || 'badge-prospect'}`}>
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {b.checkin_date} → {b.checkout_date} ({b.nights}n)
                      </span>
                      <span>{b.room_type || b.room_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{b.guest_email}</span>
                      <span>{b.guest_phone}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1.5">
                  <div className="text-mystica-green font-bold">
                    ${(b.total_amount / 1000000).toFixed(1)}M
                  </div>
                  {b.status !== 'cancelled' && b.status !== 'checked_out' && (
                    <select
                      value={b.status}
                      onChange={(e) => updateStatus(b.id, e.target.value)}
                      className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
