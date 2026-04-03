import React, { useState, useEffect } from 'react';
import { Plus, Edit2, X, Check } from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

const EMPTY_PLAN = {
  name: '', slug: '', price_monthly: '', currency: 'USD',
  max_properties: 1, max_conversations_month: 500, max_users: 3,
  grace_period_days: 3, is_active: true,
  channels_allowed: ['whatsapp', 'web'],
  features: { health_monitor: false, learning_engine: false, escalations: false, reports: false }
};

const ALL_CHANNELS = ['whatsapp', 'web', 'booking', 'airbnb', 'hostelworld', 'expedia', 'instagram', 'facebook', 'google', 'tripadvisor', 'tiktok'];
const ALL_FEATURES = ['health_monitor', 'learning_engine', 'escalations', 'reports', 'white_label'];

function PlanForm({ initial, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial);

  function toggleChannel(ch) {
    setForm(f => ({
      ...f,
      channels_allowed: f.channels_allowed.includes(ch)
        ? f.channels_allowed.filter(c => c !== ch)
        : [...f.channels_allowed, ch]
    }));
  }

  function toggleFeature(feat) {
    setForm(f => ({ ...f, features: { ...f.features, [feat]: !f.features[feat] } }));
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nombre del plan</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
            placeholder="Pro" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Slug</label>
          <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase() }))}
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
            placeholder="pro" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Precio mensual (USD)</label>
          <input type="number" value={form.price_monthly} onChange={e => setForm(f => ({ ...f, price_monthly: e.target.value }))}
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Período de gracia (días)</label>
          <input type="number" value={form.grace_period_days} onChange={e => setForm(f => ({ ...f, grace_period_days: parseInt(e.target.value) }))}
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Máx. propiedades</label>
          <input type="number" value={form.max_properties} onChange={e => setForm(f => ({ ...f, max_properties: parseInt(e.target.value) }))}
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Máx. conversaciones/mes</label>
          <input type="number" value={form.max_conversations_month} onChange={e => setForm(f => ({ ...f, max_conversations_month: parseInt(e.target.value) }))}
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Máx. usuarios</label>
          <input type="number" value={form.max_users} onChange={e => setForm(f => ({ ...f, max_users: parseInt(e.target.value) }))}
            className="w-full bg-gray-900 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">Canales permitidos</label>
        <div className="flex flex-wrap gap-2">
          {ALL_CHANNELS.map(ch => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                form.channels_allowed.includes(ch)
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-600/50'
                  : 'bg-gray-700 text-gray-400 border border-transparent'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">Features</label>
        <div className="flex flex-wrap gap-2">
          {ALL_FEATURES.map(feat => (
            <button
              key={feat}
              type="button"
              onClick={() => toggleFeature(feat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                form.features[feat]
                  ? 'bg-green-600/20 text-green-300 border border-green-600/40'
                  : 'bg-gray-700 text-gray-400 border border-transparent'
              }`}
            >
              {feat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-gray-700 text-gray-300 rounded-lg py-2 text-sm hover:bg-gray-600">Cancelar</button>
        <button onClick={() => onSave(form)} disabled={loading} className="flex-1 bg-cyan-600 text-white rounded-lg py-2 text-sm hover:bg-cyan-500 disabled:opacity-50">
          {loading ? 'Guardando...' : 'Guardar plan'}
        </button>
      </div>
    </div>
  );
}

export default function PlansManager() {
  const { saFetch } = useSuperAdmin();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' | plan.id
  const [msg, setMsg] = useState('');

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    setLoading(true);
    try {
      const r = await saFetch('/plans');
      const d = await r.json();
      setPlans(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  }

  async function savePlan(form) {
    setSaving(true);
    try {
      const isNew = editing === 'new';
      await saFetch(isNew ? '/plans' : `/plans/${editing}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ ...form, price_monthly: parseFloat(form.price_monthly) })
      });
      setMsg(isNew ? 'Plan creado' : 'Plan actualizado');
      setTimeout(() => setMsg(''), 3000);
      setEditing(null);
      await loadPlans();
    } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Cargando planes...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Planes y Precios</h1>
          <p className="text-gray-500 text-sm mt-0.5">{plans.length} planes definidos</p>
        </div>
        {editing !== 'new' && (
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Nuevo plan
          </button>
        )}
      </div>

      {msg && <div className="bg-green-500/15 text-green-400 text-sm rounded-lg px-4 py-2">{msg}</div>}

      {editing === 'new' && (
        <PlanForm initial={EMPTY_PLAN} onSave={savePlan} onCancel={() => setEditing(null)} loading={saving} />
      )}

      <div className="grid gap-4">
        {plans.map(plan => (
          editing === plan.id ? (
            <PlanForm key={plan.id} initial={plan} onSave={savePlan} onCancel={() => setEditing(null)} loading={saving} />
          ) : (
            <div key={plan.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{plan.name}</h3>
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{plan.slug}</span>
                    {!plan.is_active && <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded">Inactivo</span>}
                  </div>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">${plan.price_monthly}<span className="text-sm text-gray-500 font-normal">/mes</span></p>
                </div>
                <button onClick={() => setEditing(plan.id)} className="text-gray-400 hover:text-white p-1">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                <div className="bg-gray-800 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Propiedades</div>
                  <div className="text-white font-medium">{plan.max_properties}</div>
                </div>
                <div className="bg-gray-800 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Convs./mes</div>
                  <div className="text-white font-medium">{plan.max_conversations_month?.toLocaleString()}</div>
                </div>
                <div className="bg-gray-800 rounded-lg px-3 py-2">
                  <div className="text-gray-500">Gracia</div>
                  <div className="text-white font-medium">{plan.grace_period_days} días</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(plan.channels_allowed || []).map(ch => (
                  <span key={ch} className="text-xs bg-cyan-600/10 text-cyan-400 px-2 py-0.5 rounded">{ch}</span>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(plan.features || {}).filter(([, v]) => v).map(([k]) => (
                  <span key={k} className="text-xs bg-green-600/10 text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
                    <Check className="w-3 h-3" /> {k.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
