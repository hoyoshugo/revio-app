import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import axios from 'axios';

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', icon: AlertCircle, color: 'text-yellow-400' },
  approved: { label: 'Aprobado', icon: CheckCircle, color: 'text-green-400' },
  declined: { label: 'Rechazado', icon: XCircle, color: 'text-red-400' },
  voided: { label: 'Anulado', icon: XCircle, color: 'text-gray-400' },
  error: { label: 'Error', icon: XCircle, color: 'text-red-400' },
};

export default function PaymentsPanel({ property }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
      const params = {};
      if (filter) params.status = filter;
      if (property !== 'all') params.property_slug = property;
      const { data } = await axios.get('/api/payments', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setPayments(data.payments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [property, filter]);

  async function resendPaymentLink(bookingId) {
    const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
    try {
      const { data } = await axios.post(
        `/api/bookings/${bookingId}/resend-payment`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      alert(`Link enviado: ${data.payment_link_url}`);
    } catch (err) {
      alert('Error generando link: ' + err.message);
    }
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const pendingTotal = pending.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pagos</h1>
          {pending.length > 0 && (
            <p className="text-sm text-yellow-400 mt-0.5">
              {pending.length} pendientes · ${(pendingTotal / 1000000).toFixed(1)}M COP
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option>
            <option value="declined">Rechazados</option>
          </select>
          <button onClick={load} aria-label="Actualizar pagos" className="btn-ghost">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No hay pagos registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.error;
            const Icon = sc.icon;
            return (
              <div key={p.id} className="card flex items-center gap-3">
                <Icon className={`w-5 h-5 flex-shrink-0 ${sc.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">
                    {p.bookings?.guest_name || 'Cliente'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Ref: {p.wompi_reference} · Check-in: {p.bookings?.checkin_date}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-white font-bold">${(p.amount / 1000000).toFixed(1)}M</div>
                  <span className={`text-xs font-medium ${sc.color}`}>{sc.label}</span>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-1 flex-shrink-0">
                    {p.payment_link_url && (
                      <a
                        href={p.payment_link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost p-1.5"
                        title="Abrir link de pago"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {p.booking_id && (
                      <button
                        onClick={() => resendPaymentLink(p.booking_id)}
                        aria-label="Generar nuevo link de pago"
                        className="btn-ghost p-1.5 text-xs"
                        title="Generar nuevo link"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
