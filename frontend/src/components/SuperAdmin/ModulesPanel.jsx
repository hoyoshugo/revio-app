import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_CONFIG = {
  production:  { label: 'Producción', color: 'bg-green-500',  badge: 'bg-green-900/50 border-green-700 text-green-300' },
  beta:        { label: 'Beta',        color: 'bg-blue-500',   badge: 'bg-blue-900/50 border-blue-700 text-blue-300' },
  development: { label: 'Desarrollo',  color: 'bg-yellow-500', badge: 'bg-yellow-900/50 border-yellow-700 text-yellow-300' },
  planned:     { label: 'Planificado', color: 'bg-gray-500',   badge: 'bg-gray-800 border-gray-700 text-gray-400' },
};

export default function ModulesPanel() {
  const [modules, setModules]           = useState([]);
  const [tenants, setTenants]           = useState([]);
  const [tenantModules, setTenantModules] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [editForm, setEditForm]         = useState({});

  const token = localStorage.getItem('sa_token') || localStorage.getItem('revio_token');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [modsR, tenantsR] = await Promise.all([
        fetch(API_BASE + '/api/modules/all', { headers: { Authorization: 'Bearer ' + token } }),
        fetch(API_BASE + '/api/sa/tenants',  { headers: { Authorization: 'Bearer ' + token } }),
      ]);

      if (modsR.ok) {
        const d = await modsR.json();
        setModules(d.modules || []);
        setTenantModules(d.tenantModules || []);
      }
      if (tenantsR.ok) {
        const d = await tenantsR.json();
        setTenants(Array.isArray(d) ? d : d.tenants || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function isActive(tenantId, moduleId) {
    return tenantModules.some(tm => tm.tenant_id === tenantId && tm.module_id === moduleId && tm.is_active);
  }

  async function toggleModule(tenantId, moduleId, currentActive) {
    const key = tenantId + moduleId;
    setSaving(key);
    try {
      await fetch(`${API_BASE}/api/modules/${moduleId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tenantId, active: !currentActive }),
      });
      await loadData();
    } catch (e) { console.error(e); }
    setSaving(null);
  }

  async function saveModule(moduleId) {
    setSaving(moduleId);
    try {
      await fetch(`${API_BASE}/api/modules/${moduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(editForm),
      });
      await loadData();
      setEditingModule(null);
      setEditForm({});
    } catch (e) { console.error(e); }
    setSaving(null);
  }

  function startEdit(mod) {
    setEditingModule(mod.id);
    setEditForm({
      completion_pct: mod.completion_pct,
      status: mod.status,
      is_sellable: mod.is_sellable,
      base_price_cop: mod.base_price_cop,
    });
  }

  if (loading) return (
    <div className="p-8 text-center text-gray-400">
      <div className="animate-spin text-2xl mb-2">⚙️</div>
      Cargando módulos...
    </div>
  );

  const stats = [
    { label: 'En producción', count: modules.filter(m => m.status === 'production').length, color: 'text-green-400' },
    { label: 'En beta',        count: modules.filter(m => m.status === 'beta').length,        color: 'text-blue-400' },
    { label: 'En desarrollo',  count: modules.filter(m => m.status === 'development').length, color: 'text-yellow-400' },
    { label: 'Vendibles',      count: modules.filter(m => m.is_sellable).length,              color: 'text-purple-400' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-1">Gestión de Módulos</h2>
        <p className="text-gray-400 text-sm">
          Controla qué módulos están disponibles para cada cliente.
          Solo los módulos en producción o beta se pueden vender.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className={`text-2xl font-semibold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Módulos */}
        <div className="flex-1 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Módulos del ecosistema
          </h3>

          {modules.map(mod => {
            const st = STATUS_CONFIG[mod.status] || STATUS_CONFIG.planned;
            const isEditing = editingModule === mod.id;

            return (
              <div key={mod.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{mod.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{mod.name}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${st.badge}`}>
                            {st.label}
                          </span>
                          {mod.is_sellable && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-700 text-purple-300">
                              💰 {mod.base_price_cop > 0 ? `$${mod.base_price_cop.toLocaleString()}` : 'Incluido'}
                            </span>
                          )}
                          <span className="text-xs text-gray-600 font-mono">{mod.priority}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => isEditing ? (setEditingModule(null), setEditForm({})) : startEdit(mod)}
                      className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                    >
                      {isEditing ? '✕ Cerrar' : '✏️ Editar'}
                    </button>
                  </div>

                  {/* Barra progreso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Completitud</span>
                      <span className={`font-medium ${st.badge.includes('green') ? 'text-green-400' : st.badge.includes('blue') ? 'text-blue-400' : st.badge.includes('yellow') ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {mod.completion_pct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${st.color}`} style={{ width: `${mod.completion_pct}%` }} />
                    </div>
                  </div>

                  {/* Form edición */}
                  {isEditing && (
                    <div className="mt-3 p-3 bg-gray-800 rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Completitud %</label>
                          <input
                            type="number" min="0" max="100"
                            value={editForm.completion_pct}
                            onChange={e => setEditForm(f => ({ ...f, completion_pct: parseInt(e.target.value) }))}
                            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Estado</label>
                          <select
                            value={editForm.status}
                            onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
                          >
                            <option value="planned">Planificado</option>
                            <option value="development">Desarrollo</option>
                            <option value="beta">Beta</option>
                            <option value="production">Producción</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.is_sellable}
                            onChange={e => setEditForm(f => ({ ...f, is_sellable: e.target.checked }))}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-xs text-gray-300">Disponible para venta</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-400">Precio COP</label>
                          <input
                            type="number"
                            value={editForm.base_price_cop}
                            onChange={e => setEditForm(f => ({ ...f, base_price_cop: parseInt(e.target.value) }))}
                            className="w-28 bg-gray-700 rounded-lg px-2 py-1 text-sm border border-gray-600 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={saving === mod.id}
                          onClick={() => saveModule(mod.id)}
                          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                        >
                          {saving === mod.id ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button
                          onClick={() => { setEditingModule(null); setEditForm({}); }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggle por tenant */}
                {tenants.length > 0 && (
                  <div className="border-t border-gray-800 px-4 py-3">
                    <div className="text-xs text-gray-500 mb-2">Activado para clientes:</div>
                    <div className="flex flex-wrap gap-2">
                      {tenants.map(tenant => {
                        const active = isActive(tenant.id, mod.id);
                        const key = tenant.id + mod.id;
                        return (
                          <button
                            key={tenant.id}
                            disabled={saving === key}
                            onClick={() => toggleModule(tenant.id, mod.id, active)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                              active
                                ? 'bg-green-900/50 border-green-700 text-green-300 hover:bg-green-900'
                                : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {saving === key ? '...' : (active ? '✅ ' : '○ ')}
                            {tenant.business_name || tenant.contact_email}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Panel lateral por tenant */}
        <div className="w-60 flex-shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Por cliente
          </h3>
          <div className="space-y-3">
            {tenants.map(tenant => {
              const activeCount = tenantModules.filter(tm => tm.tenant_id === tenant.id && tm.is_active).length;
              const activeIds = tenantModules.filter(tm => tm.tenant_id === tenant.id && tm.is_active).map(tm => tm.module_id);
              return (
                <div
                  key={tenant.id}
                  onClick={() => setSelectedTenant(selectedTenant === tenant.id ? null : tenant.id)}
                  className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedTenant === tenant.id ? 'border-blue-600' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="font-medium text-sm mb-0.5 truncate">{tenant.business_name}</div>
                  <div className="text-xs text-gray-400 truncate">{tenant.contact_email}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-blue-400">{activeCount}</span>
                    <span className="text-xs text-gray-500">módulos activos</span>
                  </div>
                  {selectedTenant === tenant.id && activeIds.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-gray-800 pt-2">
                      {modules.filter(m => activeIds.includes(m.id)).map(m => (
                        <div key={m.id} className="text-xs text-green-400 flex items-center gap-1">
                          <span>{m.icon}</span> {m.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
