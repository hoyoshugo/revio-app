import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

const SEVERITY_COLORS = {
  critical: 'bg-red-600/20 text-red-400 border-red-600/30',
  error:    'bg-orange-600/20 text-orange-400 border-orange-600/30',
  warning:  'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  info:     'bg-blue-600/20 text-blue-400 border-blue-600/30',
};

const STATUS_COLORS = {
  open:      'bg-red-500/15 text-red-400',
  reviewing: 'bg-yellow-500/15 text-yellow-400',
  resolved:  'bg-green-500/15 text-green-400',
  ignored:   'bg-gray-500/15 text-gray-400',
};

function CorrectModal({ error, onClose, onSave }) {
  const [form, setForm] = useState({ title: '', description: '', success: true, result_notes: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await onSave(form);
    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Registrar corrección</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4 bg-gray-800 rounded-lg px-3 py-2">{error.message}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Título de la corrección</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Descripción</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Resultado</label>
            <textarea rows={2} value={form.result_notes} onChange={e => setForm(f => ({ ...f, result_notes: e.target.value }))}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500 resize-none"
              placeholder="Qué se hizo y cuál fue el resultado..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.success} onChange={e => setForm(f => ({ ...f, success: e.target.checked }))}
              className="rounded" />
            <span className="text-sm text-gray-300">Corrección exitosa</span>
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-700">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-cyan-600 text-white rounded-lg py-2 text-sm hover:bg-cyan-500 disabled:opacity-50">
              {loading ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ErrorsMonitor() {
  const { saFetch } = useSuperAdmin();
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [correctModal, setCorrectModal] = useState(null);

  useEffect(() => { loadErrors(); }, [statusFilter, severityFilter]);

  async function loadErrors() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      const r = await saFetch(`/errors?${params}`);
      const d = await r.json();
      setErrors(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }

  async function updateStatus(id, status) {
    await saFetch(`/errors/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, resolved_by: 'superadmin' })
    });
    await loadErrors();
  }

  async function applyCorrection(errorId, payload) {
    await saFetch(`/errors/${errorId}/correct`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, applied_by: 'superadmin' })
    });
    await updateStatus(errorId, 'resolved');
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Monitor de Errores</h1>
        <p className="text-gray-500 text-sm mt-0.5">{errors.length} errores</p>
      </div>

      <div className="flex gap-3">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500">
          <option value="open">Abiertos</option>
          <option value="reviewing">En revisión</option>
          <option value="resolved">Resueltos</option>
          <option value="all">Todos</option>
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500">
          <option value="all">Todas las severidades</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Cargando errores...</div>
        ) : errors.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Sin errores en esta categoría</p>
          </div>
        ) : errors.map(err => (
          <div key={err.id} className={`bg-gray-900 rounded-xl border p-4 ${SEVERITY_COLORS[err.severity] || 'border-gray-800'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${SEVERITY_COLORS[err.severity] || ''}`}>
                    {err.severity}
                  </span>
                  <span className="text-xs text-gray-500">{err.service} · {err.error_type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[err.status] || ''}`}>
                    {err.status}
                  </span>
                </div>
                <p className="text-white text-sm mt-2">{err.message}</p>
                {err.tenant_id && (
                  <p className="text-gray-500 text-xs mt-1">Cliente: {err.tenant_id}</p>
                )}
                <p className="text-gray-600 text-xs mt-1">
                  {new Date(err.created_at).toLocaleString('es-CO')}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              {err.status === 'open' && (
                <button onClick={() => updateStatus(err.id, 'reviewing')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30">
                  <Clock className="w-3 h-3" /> En revisión
                </button>
              )}
              {['open', 'reviewing'].includes(err.status) && (
                <>
                  <button onClick={() => setCorrectModal(err)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30">
                    Registrar corrección
                  </button>
                  <button onClick={() => updateStatus(err.id, 'ignored')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-gray-700 text-gray-400 hover:bg-gray-600">
                    Ignorar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {correctModal && (
        <CorrectModal
          error={correctModal}
          onClose={() => setCorrectModal(null)}
          onSave={payload => applyCorrection(correctModal.id, payload)}
        />
      )}
    </div>
  );
}
