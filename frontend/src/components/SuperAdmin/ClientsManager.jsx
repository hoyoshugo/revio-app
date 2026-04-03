import React, { useState, useEffect } from 'react';
import { Search, ToggleLeft, ToggleRight, DollarSign, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

const STATUS_COLORS = {
  active:    'bg-green-500/15 text-green-400',
  trial:     'bg-cyan-500/15 text-cyan-400',
  overdue:   'bg-yellow-500/15 text-yellow-400',
  suspended: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-gray-500/15 text-gray-400',
};
const STATUS_LABELS = {
  active: 'Activo', trial: 'Trial', overdue: 'Vencido',
  suspended: 'Suspendido', cancelled: 'Cancelado'
};

function PaymentModal({ tenant, onClose, onSave }) {
  const [form, setForm] = useState({ amount: '', notes: '', period_months: 1 });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await onSave({ ...form, amount: parseFloat(form.amount) });
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Registrar pago — {tenant.business_name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Monto (USD)</label>
            <input
              type="number" step="0.01" min="0" required
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Meses que cubre</label>
            <input
              type="number" min="1" max="12" required
              value={form.period_months} onChange={e => setForm(f => ({ ...f, period_months: parseInt(e.target.value) }))}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-700">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-cyan-600 text-white rounded-lg py-2 text-sm hover:bg-cyan-500 disabled:opacity-50">
              {loading ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NotesModal({ tenant, onClose, onSave }) {
  const [notes, setNotes] = useState(tenant.internal_notes || '');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    await onSave(notes);
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Notas — {tenant.business_name}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)} rows={6}
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="Notas internas sobre este cliente..."
        />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-700">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 bg-cyan-600 text-white rounded-lg py-2 text-sm hover:bg-cyan-500 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar notas'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientsManager() {
  const { saFetch } = useSuperAdmin();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentModal, setPaymentModal] = useState(null);
  const [notesModal, setNotesModal] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadTenants(); }, []);

  async function loadTenants() {
    setLoading(true);
    try {
      const r = await saFetch('/tenants');
      const d = await r.json();
      setTenants(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }

  async function toggleStatus(id) {
    await saFetch(`/tenants/${id}/toggle`, { method: 'POST' });
    await loadTenants();
  }

  async function registerPayment(id, payload) {
    await saFetch(`/tenants/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    setMsg('Pago registrado exitosamente');
    setTimeout(() => setMsg(''), 3000);
    await loadTenants();
  }

  async function saveNotes(id, notes) {
    await saFetch(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ internal_notes: notes })
    });
    await loadTenants();
  }

  const filtered = tenants.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchSearch = !search || t.business_name.toLowerCase().includes(search.toLowerCase()) || t.contact_email.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tenants.length} clientes registrados</p>
        </div>
      </div>

      {msg && <div className="bg-green-500/15 text-green-400 text-sm rounded-lg px-4 py-2">{msg}</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="trial">Trial</option>
          <option value="overdue">Vencidos</option>
          <option value="suspended">Suspendidos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">Sin clientes</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filtered.map(tenant => (
              <div key={tenant.id}>
                <div
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => setExpanded(expanded === tenant.id ? null : tenant.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">{tenant.business_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[tenant.status] || 'bg-gray-800 text-gray-400'}`}>
                        {STATUS_LABELS[tenant.status] || tenant.status}
                      </span>
                    </div>
                    <div className="text-gray-500 text-xs mt-0.5">{tenant.contact_email} · {tenant.plan_name || 'Sin plan'}</div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <div className="text-gray-400 text-xs">Próx. pago</div>
                    <div className="text-white text-xs">
                      {tenant.next_payment_at ? new Date(tenant.next_payment_at).toLocaleDateString('es-CO') : '—'}
                    </div>
                  </div>
                  {expanded === tenant.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>

                {expanded === tenant.id && (
                  <div className="px-5 pb-4 bg-gray-800/30 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-gray-500">Contacto:</span><br /><span className="text-white">{tenant.contact_name || '—'}</span></div>
                      <div><span className="text-gray-500">Teléfono:</span><br /><span className="text-white">{tenant.contact_phone || '—'}</span></div>
                      <div><span className="text-gray-500">Propiedades:</span><br /><span className="text-white">{tenant.property_count ?? '—'}</span></div>
                      <div><span className="text-gray-500">Convs. mes:</span><br /><span className="text-white">{tenant.conversations_this_month ?? 0}</span></div>
                      {tenant.trial_ends_at && (
                        <div><span className="text-gray-500">Trial hasta:</span><br /><span className="text-white">{new Date(tenant.trial_ends_at).toLocaleDateString('es-CO')}</span></div>
                      )}
                      <div><span className="text-gray-500">Onboarding:</span><br /><span className={tenant.onboarding_completed ? 'text-green-400' : 'text-yellow-400'}>{tenant.onboarding_completed ? 'Completo' : 'Pendiente'}</span></div>
                    </div>

                    {tenant.internal_notes && (
                      <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400">
                        <span className="text-gray-500">Nota:</span> {tenant.internal_notes}
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => toggleStatus(tenant.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          tenant.status === 'suspended'
                            ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                            : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                        }`}
                      >
                        {tenant.status === 'suspended' ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        {tenant.status === 'suspended' ? 'Reactivar' : 'Suspender'}
                      </button>
                      <button
                        onClick={() => setPaymentModal(tenant)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Registrar pago
                      </button>
                      <button
                        onClick={() => setNotesModal(tenant)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
                      >
                        Notas internas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {paymentModal && (
        <PaymentModal
          tenant={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSave={payload => registerPayment(paymentModal.id, payload)}
        />
      )}
      {notesModal && (
        <NotesModal
          tenant={notesModal}
          onClose={() => setNotesModal(null)}
          onSave={notes => saveNotes(notesModal.id, notes)}
        />
      )}
    </div>
  );
}
