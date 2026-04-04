import React, { useState, useEffect } from 'react';
import { Percent, Plus, X, Check, Clock, TrendingUp, Search } from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

const DISCOUNT_TYPES = [
  { value: 'percent_permanent',  label: '% Descuento permanente' },
  { value: 'percent_temporary',  label: '% Descuento temporal (con fecha fin)' },
  { value: 'trial_extension',    label: 'Cortesía extendida (días adicionales)' },
  { value: 'plan_upgrade',       label: 'Upgrade manual de plan' },
];

function DiscountForm({ tenants, plans, onSave, onClose }) {
  const [form, setForm] = useState({
    tenant_id: '', type: 'percent_permanent', value: '',
    expires_at: '', note: '', upgraded_plan_id: ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rv-surface rounded-2xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Nuevo descuento / cortesía</h3>
          <button onClick={onClose} style={{ color: 'var(--text-3)' }}><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Cliente</label>
            <select value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))}
              className="rv-select text-sm">
              <option value="">— Seleccionar —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.business_name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Tipo de descuento</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="rv-select text-sm">
              {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          {form.type !== 'plan_upgrade' && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>
                {form.type === 'trial_extension' ? 'Días adicionales' : 'Porcentaje de descuento (%)'}
              </label>
              <input type="number" min="1" max={form.type === 'trial_extension' ? '365' : '100'}
                value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                className="rv-input text-sm" placeholder={form.type === 'trial_extension' ? '30' : '20'} />
            </div>
          )}

          {form.type === 'plan_upgrade' && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Plan asignado</label>
              <select value={form.upgraded_plan_id} onChange={e => setForm(f => ({ ...f, upgraded_plan_id: e.target.value }))}
                className="rv-select text-sm">
                <option value="">— Seleccionar plan —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} (${(p.price_monthly/1000).toFixed(0)}K COP/mes)</option>)}
              </select>
            </div>
          )}

          {form.type === 'percent_temporary' && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Válido hasta</label>
              <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="rv-input text-sm" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Nota interna</label>
            <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="rv-input text-sm resize-none"
              placeholder="Ej: Cliente referido por evento BogotaTech 2026..." />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rv-btn-ghost text-sm py-2">Cancelar</button>
          <button
            onClick={() => { if (form.tenant_id && (form.value || form.upgraded_plan_id)) { onSave(form); onClose(); } }}
            className="flex-1 rv-btn-primary text-sm py-2">
            Aplicar descuento
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiscountsManager() {
  const { saFetch } = useSuperAdmin();
  const [tenants, setTenants] = useState([]);
  const [plans, setPlans]     = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    Promise.all([
      saFetch('/tenants').then(r => r.json()).then(d => setTenants(Array.isArray(d) ? d : [])),
      saFetch('/plans').then(r => r.json()).then(d => setPlans(Array.isArray(d) ? d : [])),
      saFetch('/discounts').then(r => r.json()).then(d => setDiscounts(Array.isArray(d) ? d : []))
        .catch(() => setDiscounts([])),
    ]).finally(() => setLoading(false));
  }, []);

  async function saveDiscount(form) {
    try {
      await saFetch('/discounts', { method: 'POST', body: JSON.stringify(form) });
      const r = await saFetch('/discounts');
      const d = await r.json();
      setDiscounts(Array.isArray(d) ? d : []);
      setMsg('Descuento aplicado');
      setTimeout(() => setMsg(''), 3000);
    } catch {}
  }

  async function removeDiscount(id) {
    await saFetch(`/discounts/${id}`, { method: 'DELETE' });
    setDiscounts(ds => ds.filter(d => d.id !== id));
  }

  const filtered = discounts.filter(d => {
    if (!search) return true;
    const t = tenants.find(t => t.id === d.tenant_id);
    return t?.business_name?.toLowerCase().includes(search.toLowerCase());
  });

  const TYPE_ICONS = {
    percent_permanent: <Percent className="w-3.5 h-3.5" />,
    percent_temporary: <Clock className="w-3.5 h-3.5" />,
    trial_extension:   <Clock className="w-3.5 h-3.5" />,
    plan_upgrade:      <TrendingUp className="w-3.5 h-3.5" />,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Descuentos Personalizados</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            Descuentos, cortesías y upgrades manuales por cliente
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="rv-btn-primary text-xs flex items-center gap-1.5 px-4 py-2">
          <Plus className="w-3.5 h-3.5" /> Nuevo descuento
        </button>
      </div>

      {msg && (
        <div className="rv-badge rv-badge-green px-4 py-2 rounded-xl text-sm">
          <Check className="w-4 h-4" /> {msg}
        </div>
      )}

      {/* Volume discount config info */}
      <div className="rv-card">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>
          Descuentos automáticos por volumen de propiedades
        </h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { range: '2–3 propiedades', disc: '10%' },
            { range: '4–6 propiedades', disc: '20%' },
            { range: '7+ propiedades', disc: '30%' },
          ].map(({ range, disc }) => (
            <div key={range} className="text-center py-3 px-2 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--accent)' }}>{disc}</div>
              <div style={{ color: 'var(--text-2)' }}>{range}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>en props adicionales</div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>
          Configurables en Planes y Precios. Se aplican automáticamente al calcular la factura.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="rv-input pl-9 text-sm" placeholder="Buscar por cliente..." />
      </div>

      {/* List */}
      <div className="rv-surface overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Percent className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>Sin descuentos aplicados</p>
          </div>
        ) : (
          <div className="divide-y" style={{ '--tw-divide-color': 'var(--border)' }}>
            {filtered.map(disc => {
              const tenant = tenants.find(t => t.id === disc.tenant_id);
              const plan = plans.find(p => p.id === disc.upgraded_plan_id);
              const isExpired = disc.expires_at && new Date(disc.expires_at) < new Date();
              return (
                <div key={disc.id} className="flex items-start gap-3 px-5 py-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isExpired ? 'var(--card)' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
                      color: isExpired ? 'var(--text-3)' : 'var(--accent)'
                    }}>
                    {TYPE_ICONS[disc.type] || <Percent className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                        {tenant?.business_name || disc.tenant_id}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: isExpired ? 'var(--card)' : 'color-mix(in srgb, var(--success) 12%, transparent)',
                          color: isExpired ? 'var(--text-3)' : 'var(--success)'
                        }}>
                        {isExpired ? 'Expirado' : 'Activo'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                      {disc.type === 'percent_permanent' && `${disc.value}% descuento permanente`}
                      {disc.type === 'percent_temporary' && `${disc.value}% hasta ${disc.expires_at ? new Date(disc.expires_at).toLocaleDateString('es-CO') : '—'}`}
                      {disc.type === 'trial_extension' && `${disc.value} días adicionales de cortesía`}
                      {disc.type === 'plan_upgrade' && `Upgrade manual a ${plan?.name || disc.upgraded_plan_id}`}
                    </p>
                    {disc.note && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-3)' }}>{disc.note}</p>}
                  </div>
                  <button onClick={() => removeDiscount(disc.id)}
                    className="p-1 rounded-lg flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-3)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <DiscountForm
          tenants={tenants}
          plans={plans}
          onSave={saveDiscount}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
