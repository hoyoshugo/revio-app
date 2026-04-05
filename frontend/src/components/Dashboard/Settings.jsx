import React, { useState, useEffect } from 'react';
import { Save, Building2, Users, CreditCard, Plug, Palette, Star, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const COP = v => `$${Number(v || 0).toLocaleString('es-CO')}`;

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium w-full rounded-lg text-left transition-colors ${
        active ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
      }`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-2)] mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--text-3)] mt-1">{hint}</p>}
    </div>
  );
}

// ── TAB: Propiedad ────────────────────────────────────────────
function PropertyTab({ token, pid }) {
  const [form, setForm] = useState({
    name: '', brand_name: '', location: '', phone: '', email: '', website: '',
    description: '', check_in_time: '15:00', check_out_time: '12:00', currency: 'COP',
    timezone: 'America/Bogota', tax_rate: 8
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/settings/property?property_id=${pid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) { const d = await res.json(); setForm(f => ({ ...f, ...d })); }
      } catch {}
    })();
  }, [token, pid]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/api/settings/property`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: pid, ...form })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre del establecimiento">
          <input value={form.name} onChange={e => up('name', e.target.value)} className="rv-input w-full" />
        </Field>
        <Field label="Nombre de marca">
          <input value={form.brand_name} onChange={e => up('brand_name', e.target.value)} className="rv-input w-full" />
        </Field>
        <Field label="Ciudad / Ubicación">
          <input value={form.location} onChange={e => up('location', e.target.value)} className="rv-input w-full" />
        </Field>
        <Field label="Teléfono">
          <input value={form.phone} onChange={e => up('phone', e.target.value)} className="rv-input w-full" placeholder="+57 300 000 0000" />
        </Field>
        <Field label="Email de contacto">
          <input type="email" value={form.email} onChange={e => up('email', e.target.value)} className="rv-input w-full" />
        </Field>
        <Field label="Sitio web">
          <input value={form.website} onChange={e => up('website', e.target.value)} className="rv-input w-full" placeholder="https://..." />
        </Field>
        <Field label="Check-in">
          <input type="time" value={form.check_in_time} onChange={e => up('check_in_time', e.target.value)} className="rv-input w-full" />
        </Field>
        <Field label="Check-out">
          <input type="time" value={form.check_out_time} onChange={e => up('check_out_time', e.target.value)} className="rv-input w-full" />
        </Field>
        <Field label="Moneda">
          <select value={form.currency} onChange={e => up('currency', e.target.value)} className="rv-input w-full">
            <option value="COP">COP — Peso colombiano</option>
            <option value="USD">USD — Dólar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </Field>
        <Field label="IVA (%)" hint="Aplicado en POS y facturas">
          <input type="number" min={0} max={100} value={form.tax_rate} onChange={e => up('tax_rate', e.target.value)} className="rv-input w-full" />
        </Field>
      </div>
      <Field label="Descripción">
        <textarea rows={3} value={form.description} onChange={e => up('description', e.target.value)}
          className="rv-input w-full resize-none" placeholder="Descripción breve del establecimiento..." />
      </Field>
      <button type="submit" disabled={saving}
        className="rv-btn flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saved ? '¡Guardado!' : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  );
}

// ── TAB: Usuarios ─────────────────────────────────────────────
function UsersTab({ token, pid }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });

  async function load() {
    try {
      const res = await fetch(`${API}/api/settings/users?property_id=${pid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [token, pid]);

  async function addUser(e) {
    e.preventDefault();
    try {
      await fetch(`${API}/api/settings/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: pid, ...form })
      });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'staff' });
      load();
    } catch {}
  }

  async function toggleActive(userId, current) {
    try {
      await fetch(`${API}/api/settings/users/${userId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current })
      });
      load();
    } catch {}
  }

  const ROLES = { super_admin: 'Super Admin', admin: 'Admin', manager: 'Manager', receptionist: 'Recepcionista', staff: 'Staff' };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--text-3)]">{users.length} usuario{users.length !== 1 ? 's' : ''}</div>
        <button onClick={() => setShowForm(s => !s)} className="rv-btn text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {showForm && (
        <form onSubmit={addUser} className="rv-card p-4 space-y-3 border border-[var(--accent)]/30">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre"><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="rv-input w-full" required /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="rv-input w-full" required /></Field>
            <Field label="Contraseña"><input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="rv-input w-full" required /></Field>
            <Field label="Rol">
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="rv-input w-full">
                {Object.entries(ROLES).filter(([k]) => k !== 'super_admin').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rv-btn text-sm">Crear</button>
            <button type="button" onClick={() => setShowForm(false)} className="rv-btn-ghost text-sm">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-[var(--text-3)] text-sm">Cargando...</div> : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="rv-card p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] font-bold text-sm flex-shrink-0">
                {u.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--text-1)] text-sm">{u.name}</div>
                <div className="text-xs text-[var(--text-3)]">{u.email} · {ROLES[u.role] || u.role}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs ${u.is_active ? 'bg-green-500/10 text-green-400' : 'bg-[var(--surface-2)] text-[var(--text-3)]'}`}>
                  {u.is_active ? 'Activo' : 'Inactivo'}
                </span>
                <button onClick={() => toggleActive(u.id, u.is_active)} className="rv-btn-ghost text-xs">
                  {u.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TAB: Facturación ──────────────────────────────────────────
function BillingTab({ token, pid }) {
  const PLANS = [
    { id: 'starter', name: 'Starter', price: 149000, features: ['1 propiedad', 'Agente IA básico', '500 mensajes/mes', 'Dashboard PMS', 'Soporte email'] },
    { id: 'pro', name: 'Pro', price: 349000, features: ['3 propiedades', 'Agente IA avanzado', 'Mensajes ilimitados', 'Channel Manager', 'WhatsApp Business', 'Soporte prioritario'] },
    { id: 'enterprise', name: 'Enterprise', price: 0, features: ['Propiedades ilimitadas', 'IA personalizada', 'API acceso total', 'Integración LobbyPMS', 'SLA 99.9%', 'Soporte dedicado'] },
  ];

  const [currentPlan] = useState('pro');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="font-semibold text-[var(--text-1)] mb-1">Plan actual</h3>
        <p className="text-sm text-[var(--text-3)]">Gestiona tu suscripción y método de pago</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <div key={plan.id} className={`rv-card p-5 relative ${currentPlan === plan.id ? 'border-2 border-[var(--accent)]' : 'border border-[var(--border)]'}`}>
            {currentPlan === plan.id && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-white text-xs px-3 py-0.5 rounded-full">
                Plan actual
              </div>
            )}
            <div className="font-bold text-[var(--text-1)] text-lg mb-1">{plan.name}</div>
            <div className="text-2xl font-bold text-[var(--accent)] mb-4">
              {plan.price > 0 ? COP(plan.price) : 'A medida'}
              {plan.price > 0 && <span className="text-sm font-normal text-[var(--text-3)]">/mes</span>}
            </div>
            <ul className="space-y-1.5 mb-4">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-[var(--text-2)]">
                  <Star className="w-3 h-3 text-[var(--accent)] flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {currentPlan !== plan.id && (
              <button className={`w-full text-sm py-2 rounded-lg font-medium transition-colors ${
                plan.price === 0 ? 'border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10' : 'rv-btn'
              }`}>
                {plan.price === 0 ? 'Contactar ventas' : plan.price > (PLANS.find(p => p.id === currentPlan)?.price || 0) ? 'Actualizar' : 'Reducir plan'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rv-card p-4">
        <h3 className="font-semibold text-[var(--text-1)] mb-3">Método de pago</h3>
        <div className="flex items-center gap-3 text-sm text-[var(--text-2)]">
          <CreditCard className="w-5 h-5 text-[var(--accent)]" />
          <span>•••• •••• •••• 4242</span>
          <span className="text-[var(--text-3)]">Vence 12/27</span>
          <button className="rv-btn-ghost text-xs ml-auto">Cambiar</button>
        </div>
      </div>
    </div>
  );
}

// ── TAB: Integraciones ────────────────────────────────────────
function IntegrationsTab({ token, pid }) {
  const [keys, setKeys] = useState({
    anthropic_key: '', wompi_public: '', wompi_private: '',
    whatsapp_token: '', whatsapp_phone_id: '', lobbypms_key: ''
  });
  const [show, setShow] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/settings/integrations?property_id=${pid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setKeys(await res.json());
      } catch {}
    })();
  }, [token, pid]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${API}/api/settings/integrations`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: pid, ...keys })
      });
    } catch {}
    setSaving(false);
  }

  const INTEGRATIONS = [
    { group: 'IA', fields: [{ key: 'anthropic_key', label: 'Anthropic API Key', placeholder: 'sk-ant-...' }] },
    { group: 'Pagos', fields: [
      { key: 'wompi_public', label: 'Wompi Llave Pública', placeholder: 'pub_...' },
      { key: 'wompi_private', label: 'Wompi Llave Privada', placeholder: 'prv_...' },
    ]},
    { group: 'WhatsApp', fields: [
      { key: 'whatsapp_token', label: 'WhatsApp Access Token', placeholder: 'EAAj...' },
      { key: 'whatsapp_phone_id', label: 'Phone Number ID', placeholder: '123456789' },
    ]},
    { group: 'PMS', fields: [{ key: 'lobbypms_key', label: 'LobbyPMS API Key', placeholder: 'lp_...' }] },
  ];

  return (
    <form onSubmit={save} className="space-y-6 max-w-2xl">
      {INTEGRATIONS.map(({ group, fields }) => (
        <div key={group}>
          <h3 className="font-semibold text-[var(--text-1)] mb-3 flex items-center gap-2">
            <Plug className="w-4 h-4 text-[var(--accent)]" /> {group}
          </h3>
          <div className="space-y-3">
            {fields.map(({ key, label, placeholder }) => (
              <Field key={key} label={label}>
                <div className="relative">
                  <input
                    type={show[key] ? 'text' : 'password'}
                    value={keys[key] || ''}
                    onChange={e => setKeys(k => ({ ...k, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="rv-input w-full pr-10"
                  />
                  <button type="button" onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text-1)]">
                    {show[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
            ))}
          </div>
        </div>
      ))}
      <button type="submit" disabled={saving} className="rv-btn flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Guardando...' : 'Guardar credenciales'}
      </button>
    </form>
  );
}

// ── TAB: Apariencia ───────────────────────────────────────────
function AppearanceTab({ token, pid }) {
  const [form, setForm] = useState({
    primary_color: '#6366F1',
    logo_url: '',
    cover_url: '',
    widget_greeting: '¡Hola! ¿En qué puedo ayudarte hoy? 🌊',
    widget_name: 'Asistente Virtual',
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Color principal">
          <div className="flex items-center gap-2">
            <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="w-10 h-10 rounded cursor-pointer border border-[var(--border)] bg-transparent" />
            <input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="rv-input flex-1" placeholder="#6366F1" />
          </div>
        </Field>
        <Field label="URL del logo">
          <input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            className="rv-input w-full" placeholder="https://..." />
        </Field>
        <Field label="URL portada (Booking Engine)">
          <input value={form.cover_url} onChange={e => setForm(f => ({ ...f, cover_url: e.target.value }))}
            className="rv-input w-full" placeholder="https://..." />
        </Field>
        <Field label="Nombre del widget IA">
          <input value={form.widget_name} onChange={e => setForm(f => ({ ...f, widget_name: e.target.value }))}
            className="rv-input w-full" />
        </Field>
      </div>
      <Field label="Mensaje de bienvenida del widget">
        <textarea rows={2} value={form.widget_greeting} onChange={e => setForm(f => ({ ...f, widget_greeting: e.target.value }))}
          className="rv-input w-full resize-none" />
      </Field>

      {/* Widget preview */}
      <div className="rv-card p-4">
        <h4 className="text-sm font-medium text-[var(--text-2)] mb-3">Vista previa del widget</h4>
        <div className="flex justify-end">
          <div className="w-64 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
            <div className="p-3 text-white text-xs font-medium" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.primary_color}aa)` }}>
              {form.widget_name}
            </div>
            <div className="p-3 bg-gray-50 text-xs text-gray-700">{form.widget_greeting}</div>
          </div>
        </div>
      </div>

      <button className="rv-btn flex items-center gap-2">
        <Save className="w-4 h-4" /> Guardar apariencia
      </button>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
const TABS = [
  { id: 'property', label: 'Propiedad', icon: Building2 },
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'billing', label: 'Facturación', icon: CreditCard },
  { id: 'integrations', label: 'Integraciones', icon: Plug },
  { id: 'appearance', label: 'Apariencia', icon: Palette },
];

export default function Settings() {
  const { token, propertyId } = useAuth();
  const [tab, setTab] = useState('property');
  const tabProps = { token, pid: propertyId };

  return (
    <div className="flex gap-6 max-w-5xl">
      {/* Sidebar */}
      <div className="w-48 flex-shrink-0 space-y-1">
        {TABS.map(t => (
          <TabBtn key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--text-1)]">{TABS.find(t => t.id === tab)?.label}</h1>
        </div>
        {tab === 'property'     && <PropertyTab     {...tabProps} />}
        {tab === 'users'        && <UsersTab        {...tabProps} />}
        {tab === 'billing'      && <BillingTab      {...tabProps} />}
        {tab === 'integrations' && <IntegrationsTab {...tabProps} />}
        {tab === 'appearance'   && <AppearanceTab   {...tabProps} />}
      </div>
    </div>
  );
}
