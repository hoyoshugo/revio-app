/**
 * ConfigPanel — Panel de Configuración completo
 * 6 secciones: General | Propiedades | Usuarios | Conexiones | Notificaciones | Agente IA
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Building2, Users, Plug, Bell, Bot, Package,
  Save, Plus, Trash2, Edit2, Check, X, RefreshCw,
  Eye, EyeOff, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import AiProviderSelector from './AiProviderSelector.jsx';
import { useIntegrationGuide } from './IntegrationGuide.jsx';
import IntegrationsPanel from './IntegrationsPanel.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ============================================================
// PRIMITIVOS
// ============================================================
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-400">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input
      type={type}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-mystica-blue disabled:opacity-50"
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-800 text-gray-300 rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-mystica-blue"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SaveBtn({ onClick, saving, label = 'Guardar cambios' }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 bg-mystica-blue hover:bg-mystica-blue/80 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
    >
      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      {saving ? 'Guardando...' : label}
    </button>
  );
}

function SecretInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 pr-10 text-sm border border-gray-700 focus:outline-none focus:border-mystica-blue"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function TestBtn({ service, slug, token }) {
  const [state, setState] = useState(null); // null | loading | {ok, message}
  async function run() {
    setState('loading');
    try {
      const res = await fetch(`${API}/api/settings/test/${service}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      });
      const data = await res.json();
      setState(data);
    } catch { setState({ ok: false, message: 'Error de red' }); }
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-xs transition-colors"
      >
        {state === 'loading' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
        Probar conexión
      </button>
      {state && state !== 'loading' && (
        <span className={`flex items-center gap-1 text-xs ${state.ok ? 'text-green-400' : 'text-red-400'}`}>
          {state.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {state.message}
        </span>
      )}
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function toast(msg, ok = true) {
  // Simple inline toast — no library needed
  const el = document.createElement('div');
  el.className = `fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-xl transition-all ${ok ? 'bg-green-800 text-green-100' : 'bg-red-800 text-red-100'}`;
  el.innerHTML = `${ok ? '✅' : '❌'} ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ============================================================
// TAB 1: CONFIGURACIÓN GENERAL
// ============================================================
function TabGeneral({ properties, token }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    const p = properties.find(p => p.id === propertyId);
    if (p) setForm({
      name: p.name || '',
      brand_name: p.brand_name || '',
      brand_logo_url: p.brand_logo_url || '',
      brand_primary_color: p.brand_primary_color || '#1a1a2e',
      brand_secondary_color: p.brand_secondary_color || '#00b4d8',
      location: p.location || '',
      whatsapp_number: p.whatsapp_number || '',
      booking_url: p.booking_url || '',
      timezone: p.timezone || 'America/Bogota',
      default_language: p.default_language || 'es'
    });
  }, [propertyId, properties]);

  const f = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, key: 'general', value: form })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast('Configuración general guardada');
    } catch (err) { toast(err.message, false); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      {properties.length > 1 && (
        <Field label="Propiedad a configurar">
          <Select
            value={propertyId}
            onChange={setPropertyId}
            options={properties.map(p => ({ value: p.id, label: p.name }))}
          />
        </Field>
      )}

      <SectionCard title="Identidad del establecimiento">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre del establecimiento">
            <Input value={form.name} onChange={f('name')} placeholder="Hotel Ejemplo Centro" />
          </Field>
          <Field label="Nombre de marca (white-label)">
            <Input value={form.brand_name} onChange={f('brand_name')} placeholder="Mística" />
          </Field>
          <Field label="URL del logo" hint="URL pública de imagen (PNG/SVG recomendado)">
            <Input value={form.brand_logo_url} onChange={f('brand_logo_url')} placeholder="https://..." />
          </Field>
          <Field label="Dirección / Ubicación">
            <Input value={form.location} onChange={f('location')} placeholder="Isla Palma, San Bernardo" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Colores del tema">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Color primario">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.brand_primary_color || '#1a1a2e'}
                onChange={e => f('brand_primary_color')(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer bg-gray-800 border border-gray-700 p-1"
              />
              <Input value={form.brand_primary_color} onChange={f('brand_primary_color')} placeholder="#1a1a2e" />
            </div>
          </Field>
          <Field label="Color secundario">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.brand_secondary_color || '#00b4d8'}
                onChange={e => f('brand_secondary_color')(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer bg-gray-800 border border-gray-700 p-1"
              />
              <Input value={form.brand_secondary_color} onChange={f('brand_secondary_color')} placeholder="#00b4d8" />
            </div>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Idioma y zona horaria">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Idioma por defecto">
            <Select value={form.default_language} onChange={f('default_language')} options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
              { value: 'de', label: 'Deutsch' }
            ]} />
          </Field>
          <Field label="Zona horaria">
            <Select value={form.timezone} onChange={f('timezone')} options={[
              { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
              { value: 'America/New_York', label: 'Nueva York (UTC-5/4)' },
              { value: 'America/Mexico_City', label: 'Ciudad de México (UTC-6/5)' },
              { value: 'Europe/Madrid', label: 'Madrid (UTC+1/2)' },
              { value: 'UTC', label: 'UTC' }
            ]} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Contacto y reservas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="WhatsApp del establecimiento">
            <Input value={form.whatsapp_number} onChange={f('whatsapp_number')} placeholder="+573234392420" />
          </Field>
          <Field label="URL de reservas directas">
            <Input value={form.booking_url} onChange={f('booking_url')} placeholder="https://booking.misticaisland.com" />
          </Field>
        </div>
      </SectionCard>

      <SaveBtn onClick={save} saving={saving} />
    </div>
  );
}

// ============================================================
// TAB 2: PROPIEDADES
// ============================================================
function TabProperties({ properties, token, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const f = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  async function saveProperty() {
    setSaving(true);
    try {
      const url = editing
        ? `${API}/api/settings/properties/${editing.id}`
        : `${API}/api/settings/properties`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast(`Propiedad ${editing ? 'actualizada' : 'creada'}`);
      setEditing(null); setAdding(false); setForm({});
      onRefresh();
    } catch (err) { toast(err.message, false); }
    finally { setSaving(false); }
  }

  async function deactivate(id) {
    if (!confirm('¿Desactivar esta propiedad?')) return;
    await fetch(`${API}/api/settings/properties/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    toast('Propiedad desactivada');
    onRefresh();
  }

  const FormBlock = () => (
    <div className="bg-gray-800/50 rounded-xl border border-mystica-blue/30 p-4 space-y-4">
      <h4 className="text-sm font-medium text-mystica-blue">{editing ? 'Editar propiedad' : 'Nueva propiedad'}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre *"><Input value={form.name} onChange={f('name')} placeholder="Hotel Ejemplo Centro" /></Field>
        <Field label="Slug único *" hint="Solo letras, números y guiones"><Input value={form.slug} onChange={f('slug')} placeholder="isla-palma" disabled={!!editing} /></Field>
        <Field label="Ubicación"><Input value={form.location} onChange={f('location')} placeholder="Isla Palma, Cartagena" /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp_number} onChange={f('whatsapp_number')} placeholder="+573234392420" /></Field>
        <Field label="URL de reservas"><Input value={form.booking_url} onChange={f('booking_url')} placeholder="https://..." /></Field>
        <Field label="Zona horaria">
          <Select value={form.timezone} onChange={f('timezone')} options={[
            { value: 'America/Bogota', label: 'Bogotá' },
            { value: 'America/New_York', label: 'Nueva York' },
            { value: 'UTC', label: 'UTC' }
          ]} />
        </Field>
      </div>
      <div className="flex gap-2">
        <SaveBtn onClick={saveProperty} saving={saving} label={editing ? 'Actualizar' : 'Crear propiedad'} />
        <button onClick={() => { setEditing(null); setAdding(false); setForm({}); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{properties.length} propiedad(es) activa(s)</p>
        <button
          onClick={() => { setAdding(true); setEditing(null); setForm({ timezone: 'America/Bogota', default_language: 'es' }); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-mystica-blue hover:bg-mystica-blue/80 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> Nueva propiedad
        </button>
      </div>

      {adding && <FormBlock />}

      <div className="space-y-3">
        {properties.map(p => (
          <div key={p.id}>
            {editing?.id === p.id ? <FormBlock /> : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{p.name}</span>
                      <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded">{p.slug}</span>
                      {!p.is_active && <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded">Inactiva</span>}
                    </div>
                    {p.location && <p className="text-gray-500 text-xs mt-0.5">{p.location}</p>}
                    {p.whatsapp_number && <p className="text-gray-600 text-xs">{p.whatsapp_number}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(p); setAdding(false); setForm({ ...p }); }}
                      className="p-1.5 text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-800">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deactivate(p.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TAB 3: USUARIOS
// ============================================================
const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Recepción' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'readonly', label: 'Solo lectura' }
];

function TabUsers({ properties, token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/settings/users`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const f = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  async function saveUser() {
    setSaving(true);
    try {
      const url = editing ? `${API}/api/settings/users/${editing.id}` : `${API}/api/settings/users`;
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast(`Usuario ${editing ? 'actualizado' : 'creado'}`);
      setEditing(null); setAdding(false); setForm({});
      fetchUsers();
    } catch (err) { toast(err.message, false); }
    finally { setSaving(false); }
  }

  async function toggleActive(user) {
    await fetch(`${API}/api/settings/users/${user.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active })
    });
    fetchUsers();
  }

  const UserForm = () => (
    <div className="bg-gray-800/50 rounded-xl border border-mystica-blue/30 p-4 space-y-4">
      <h4 className="text-sm font-medium text-mystica-blue">{editing ? 'Editar usuario' : 'Nuevo usuario'}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre"><Input value={form.name} onChange={f('name')} placeholder="Juan García" /></Field>
        <Field label="Email *"><Input value={form.email} onChange={f('email')} placeholder="juan@hotel.com" disabled={!!editing} /></Field>
        <Field label="Contraseña" hint={editing ? 'Dejar vacío para no cambiar' : 'Requerida'}>
          <SecretInput value={form.password} onChange={f('password')} placeholder={editing ? '(sin cambios)' : 'Contraseña...'} />
        </Field>
        <Field label="Rol">
          <Select value={form.role} onChange={f('role')} options={ROLES} />
        </Field>
        <Field label="Propiedad asignada">
          <Select value={form.property_id || ''} onChange={f('property_id')} options={[
            { value: '', label: 'Todas las propiedades' },
            ...properties.map(p => ({ value: p.id, label: p.name }))
          ]} />
        </Field>
      </div>
      <div className="flex gap-2">
        <SaveBtn onClick={saveUser} saving={saving} label={editing ? 'Actualizar' : 'Crear usuario'} />
        <button onClick={() => { setEditing(null); setAdding(false); setForm({}); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{users.length} usuario(s)</p>
        <button
          onClick={() => { setAdding(true); setEditing(null); setForm({ role: 'staff' }); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-mystica-blue hover:bg-mystica-blue/80 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {adding && <UserForm />}

      {loading ? (
        <div className="text-center text-gray-500 py-8">Cargando usuarios...</div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-400 text-xs">Nombre / Email</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs">Rol</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs">Propiedad</th>
                <th className="text-left px-4 py-3 text-gray-400 text-xs">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  {editing?.id === u.id ? (
                    <td colSpan={5} className="p-2"><UserForm /></td>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="text-white text-xs font-medium">{u.name || '—'}</div>
                        <div className="text-gray-500 text-xs">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                          {ROLES.find(r => r.value === u.role)?.label || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {properties.find(p => p.id === u.property_id)?.name || 'Todas'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleActive(u)}
                          className={`text-xs px-2 py-0.5 rounded ${u.is_active !== false ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                          {u.is_active !== false ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => { setEditing(u); setAdding(false); setForm({ ...u, password: '' }); }}
                          className="p-1.5 text-gray-500 hover:text-blue-400 rounded hover:bg-gray-800">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB 4: CONEXIONES Y APIs
// ============================================================
function ConnBlock({ title, icon, children, defaultOpen = false, guideId, onGuide }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <span className="text-base">{icon}</span> {title}
        </span>
        <div className="flex items-center gap-2">
          {guideId && onGuide && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onGuide(guideId); }}
              className="text-xs px-2 py-0.5 rounded-lg"
              style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}
            >
              Instrucciones
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">{children}</div>}
    </div>
  );
}

function HealthBadge({ status }) {
  const map = {
    connected:      { emoji: '🟢', label: 'Conectado',       color: '#22c55e' },
    unchecked:      { emoji: '🟡', label: 'Sin verificar',    color: '#f59e0b' },
    error:          { emoji: '⚫', label: 'Error',            color: '#ef4444' },
    not_configured: { emoji: '🔴', label: 'No configurado',   color: '#6b7280' },
  };
  const s = map[status] || map.not_configured;
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
      style={{ color: s.color, borderColor: s.color, background: s.color + '15' }}
    >
      {s.emoji} {s.label}
    </span>
  );
}

function TabConnections({ properties, token }) {
  const [slug, setSlug] = useState(properties[0]?.slug || '');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState({});
  const [verifying, setVerifying] = useState(false);
  const { openGuide, GuideModal } = useIntegrationGuide();

  const currentProperty = properties.find(p => p.slug === slug) || properties[0];
  const currentPropertyId = currentProperty?.id;

  useEffect(() => {
    const p = properties.find(p => p.slug === slug);
    if (!p) return;
    fetch(`${API}/api/settings?property_id=${p.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setForm(data.settings?.connections || {}))
      .catch(() => {});
    // Cargar estado de salud
    fetch(`${API}/api/integration-health?property_id=${p.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { health: {} })
      .then(data => setHealth(data.health || {}))
      .catch(() => {});
  }, [slug, token, properties]);

  async function verifyNow() {
    if (!currentPropertyId) return;
    setVerifying(true);
    try {
      const r = await fetch(`${API}/api/integration-health/ping`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: currentPropertyId }),
      });
      if (r.ok) {
        // Refetch state
        const h = await fetch(`${API}/api/integration-health?property_id=${currentPropertyId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (h.ok) { const d = await h.json(); setHealth(d.health || {}); }
        toast('Integraciones verificadas');
      }
    } catch (e) { toast('Error al verificar: ' + e.message, false); }
    setVerifying(false);
  }

  const healthOf = (key) => {
    const h = health[key];
    if (!h) return 'unchecked';
    return h.status || 'unchecked';
  };

  const f = (section, key) => (val) => setForm(prev => ({
    ...prev,
    [section]: { ...(prev[section] || {}), [key]: val }
  }));

  async function save(section) {
    setSaving(section);
    const p = properties.find(p => p.slug === slug);
    try {
      // Save connections as a whole
      const res = await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: p?.id, key: 'connections', value: form })
      });
      if (!res.ok) throw new Error((await res.json()).error);

      // Also sync iCal URLs to dedicated key (used by cron sync service)
      if (form.ical) {
        await fetch(`${API}/api/settings`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: p?.id, key: 'ota_ical_urls', value: form.ical })
        });
      }
      toast(`Credenciales de ${section} guardadas`);
      // Auto-verify tras guardar
      verifyNow().catch(() => {});
    } catch (err) { toast(err.message, false); }
    finally { setSaving(null); }
  }

  const g = (section, key) => form[section]?.[key] || '';

  return (
    <div className="space-y-4">
      {GuideModal}
      {properties.length > 1 && (
        <Field label="Propiedad">
          <Select value={slug} onChange={setSlug}
            options={properties.map(p => ({ value: p.slug, label: p.name }))} />
        </Field>
      )}

      {/* Estado de integraciones */}
      <div
        className="flex items-center justify-between gap-3 p-3 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Estado de integraciones:</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>LobbyPMS</span>
            <HealthBadge status={healthOf('lobbypms')} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>Wompi</span>
            <HealthBadge status={healthOf('wompi')} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>WhatsApp</span>
            <HealthBadge status={healthOf('whatsapp')} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--text-2)' }}>Anthropic</span>
            <HealthBadge status={healthOf('anthropic')} />
          </div>
        </div>
        <button
          onClick={verifyNow}
          disabled={verifying}
          className="rv-btn-primary px-3 py-1.5 text-xs disabled:opacity-50 flex-shrink-0"
        >
          {verifying ? 'Verificando...' : 'Verificar ahora'}
        </button>
      </div>

      <ConnBlock title="Sistema de gestión (PMS)" icon="🏨" defaultOpen
        guideId={(g('pms', 'type') || 'lobbypms')} onGuide={openGuide}>
        <Field label="Tipo de PMS" hint="Elige el software de gestión de tu propiedad">
          <Select
            value={g('pms', 'type') || 'lobbypms'}
            onChange={f('pms', 'type')}
            options={[
              { value: 'lobbypms',        label: '🏨 LobbyPMS — Integración completa (LATAM)' },
              { value: 'cloudbeds',       label: '☁️ Cloudbeds — API REST v1.2 (Global)' },
              { value: 'mews',            label: '🔷 Mews — Open API (Global)' },
              { value: 'little_hotelier', label: '🏩 Little Hotelier (Global)' },
              { value: 'clock',           label: '🕐 Clock PMS (Global)' },
              { value: 'beds24',          label: '🛏️ Beds24 — Ideal hostales y B&Bs' },
              { value: 'hostaway',        label: '🏠 Hostaway — Alquileres vacacionales' },
              { value: 'lodgify',         label: '🏡 Lodgify — Vacation rentals' },
              { value: 'rms',             label: '☁️ RMS Cloud (AU/NZ/Global)' },
              { value: 'hotelogix',       label: '🌐 Hotelogix (India/Global)' },
              { value: 'opera',           label: '🔴 Oracle Opera (Enterprise — próximamente)' },
              { value: 'loggro',          label: '🇨🇴 Loggro — PMS colombiano con DIAN' },
              { value: 'odoo',            label: '🟣 Odoo Hotel Management' },
              { value: 'siigo',           label: '📊 Siigo módulo hotel (Colombia)' },
              { value: 'stayntouch',      label: '📱 StayNtouch — Mobile-first PMS' },
              { value: 'guestline',       label: '🏨 Guestline (UK/EU)' },
              { value: 'protel',          label: '⚙️ Protel (Global)' },
              { value: 'maestro',         label: '🎵 Maestro PMS (US/CA)' },
              { value: 'world_office',    label: '🌍 World Office (Colombia)' },
              { value: 'custom',          label: '🔧 Otro / Custom — Endpoint propio' },
            ]}
          />
        </Field>

        {/* LobbyPMS */}
        {(g('pms', 'type') || 'lobbypms') === 'lobbypms' && (
          <Field label="API Token" hint="LobbyPMS → Configuración → Integraciones">
            <SecretInput value={g('lobbypms', 'token')} onChange={f('lobbypms', 'token')} placeholder="Token de acceso..." />
          </Field>
        )}

        {/* Cloudbeds */}
        {g('pms', 'type') === 'cloudbeds' && (<>
          <Field label="Access Token OAuth2" hint="Cloudbeds → Account → API Keys">
            <SecretInput value={g('pms', 'token')} onChange={f('pms', 'token')} placeholder="cb_oauth_..." />
          </Field>
          <Field label="Property ID" hint="ID de tu propiedad en Cloudbeds">
            <Input value={g('pms', 'property_id')} onChange={f('pms', 'property_id')} placeholder="12345" />
          </Field>
        </>)}

        {/* Mews */}
        {g('pms', 'type') === 'mews' && (<>
          <Field label="Access Token" hint="Mews → Settings → Marketplace → Revio Connector">
            <SecretInput value={g('pms', 'token')} onChange={f('pms', 'token')} placeholder="AccessToken..." />
          </Field>
          <Field label="Client Token" hint="Token de cliente proporcionado por Mews">
            <SecretInput value={g('pms', 'client_token')} onChange={f('pms', 'client_token')} placeholder="ClientToken..." />
          </Field>
          <Field label="Service ID" hint="ID del servicio de alojamiento en Mews">
            <Input value={g('pms', 'service_id')} onChange={f('pms', 'service_id')} placeholder="UUID del servicio" />
          </Field>
        </>)}

        {/* Little Hotelier / Clock / Custom */}
        {['little_hotelier', 'clock', 'custom'].includes(g('pms', 'type')) && (<>
          <Field label="Endpoint base" hint="URL base de tu API o webhook PMS">
            <Input value={g('pms', 'endpoint')} onChange={f('pms', 'endpoint')} placeholder="https://tu-pms.com/api" />
          </Field>
          <Field label="API Token / Clave" hint="Bearer token o API key de autenticación">
            <SecretInput value={g('pms', 'token')} onChange={f('pms', 'token')} placeholder="Token..." />
          </Field>
          <Field label="Header de autenticación (opcional)" hint='Por defecto: "Authorization"'>
            <Input value={g('pms', 'auth_header')} onChange={f('pms', 'auth_header')} placeholder="Authorization" />
          </Field>
        </>)}

        <div className="flex items-center justify-between pt-1">
          <TestBtn service={(g('pms', 'type') || 'lobbypms') === 'lobbypms' ? 'lobbypms' : 'pms'} slug={slug} token={token} />
          <SaveBtn onClick={() => save('PMS')} saving={saving === 'PMS'} label="Guardar PMS" />
        </div>
      </ConnBlock>

      <ConnBlock title="Pasarelas de pago" icon="💳" guideId="wompi" onGuide={openGuide}>
        <div className="space-y-4">
          {[
            { key: 'wompi', label: '💳 Wompi (Colombia)', fields: [{ k: 'public_key', l: 'Llave pública', ph: 'pub_prod_...' }, { k: 'private_key', l: 'Llave privada', ph: 'prv_prod_...', secret: true }] },
            { key: 'payu', label: '💰 PayU (LATAM)', fields: [{ k: 'merchant_id', l: 'Merchant ID', ph: '123456' }, { k: 'account_id', l: 'Account ID', ph: '654321' }, { k: 'api_key', l: 'API Key', ph: 'API Key...', secret: true }] },
            { key: 'bold', label: '⚡ Bold (Colombia)', fields: [{ k: 'api_key', l: 'API Key', ph: 'bold_api_...', secret: true }] },
            { key: 'stripe', label: '💜 Stripe (Internacional)', fields: [{ k: 'public_key', l: 'Publishable Key', ph: 'pk_live_...' }, { k: 'secret_key', l: 'Secret Key', ph: 'sk_live_...', secret: true }] },
            { key: 'mercadopago', label: '🟡 MercadoPago (LATAM)', fields: [{ k: 'public_key', l: 'Public Key', ph: 'APP_USR-...' }, { k: 'access_token', l: 'Access Token', ph: 'APP_USR-...', secret: true }] },
            { key: 'paypal', label: '🔵 PayPal', fields: [{ k: 'client_id', l: 'Client ID', ph: 'AAAA...' }, { k: 'secret', l: 'Secret', ph: 'BBBB...', secret: true }] },
            { key: 'addi', label: '🛍️ ADDI (cuotas sin interés)', fields: [{ k: 'ally_slug', l: 'Ally Slug', ph: 'mi-hotel' }, { k: 'client_id', l: 'Client ID', ph: '...' }, { k: 'client_secret', l: 'Client Secret', ph: '...', secret: true }] },
          ].map(({ key, label, fields }) => (
            <div key={key} className="border border-gray-800 rounded-lg p-3 space-y-2">
              <h4 className="text-xs font-semibold text-gray-400">{label}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {fields.map(({ k, l, ph, secret }) => (
                  <Field key={k} label={l}>
                    {secret
                      ? <SecretInput value={g(key, k)} onChange={f(key, k)} placeholder={ph} />
                      : <Input value={g(key, k)} onChange={f(key, k)} placeholder={ph} />
                    }
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
        <SaveBtn onClick={() => save('Pagos')} saving={saving === 'Pagos'} label="Guardar pasarelas" />
      </ConnBlock>

      <ConnBlock title="WhatsApp Business" icon="💬" guideId="whatsapp" onGuide={openGuide}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Access Token">
            <SecretInput value={g('whatsapp', 'token')} onChange={f('whatsapp', 'token')} placeholder="EAA..." />
          </Field>
          <Field label="Phone ID">
            <Input value={g('whatsapp', 'phone_id')} onChange={f('whatsapp', 'phone_id')} placeholder="1234567890" />
          </Field>
        </div>
        <div className="flex items-center justify-between">
          <TestBtn service="whatsapp" slug={slug} token={token} />
          <SaveBtn onClick={() => save('WhatsApp')} saving={saving === 'WhatsApp'} label="Guardar" />
        </div>
      </ConnBlock>

      <ConnBlock title="OTAs — Sincronización iCal (recomendado)" icon="📅" guideId="booking" onGuide={openGuide} defaultOpen>
        <p className="text-xs text-gray-500 mb-3">
          Pega los enlaces iCal exportados desde cada OTA. Sincronización automática cada 15 minutos.
          Funciona sin partner agreement — ideal para cualquier propiedad.
        </p>
        <div className="space-y-2">
          {[
            { k: 'booking_url',     l: '🏩 iCal Booking.com',    ph: 'https://admin.booking.com/hotel/hoteladmin/ical.html?...' },
            { k: 'airbnb_url',      l: '🏠 iCal Airbnb',          ph: 'https://www.airbnb.com/calendar/ical/12345.ics?s=...' },
            { k: 'hostelworld_url', l: '🌍 iCal Hostelworld',     ph: 'https://...' },
            { k: 'vrbo_url',        l: '🏡 iCal VRBO',            ph: 'https://www.vrbo.com/icalendar/...ics' },
            { k: 'expedia_url',     l: '✈️ iCal Expedia',          ph: 'https://...' },
          ].map(({ k, l, ph }) => (
            <Field key={k} label={l}>
              <Input value={g('ical', k)} onChange={f('ical', k)} placeholder={ph} />
            </Field>
          ))}
        </div>
        <SaveBtn onClick={() => save('iCal OTAs')} saving={saving === 'iCal OTAs'} label="Guardar URLs iCal" />
      </ConnBlock>

      <ConnBlock title="OTAs — API Directa (enterprise)" icon="🌐" guideId="booking" onGuide={openGuide}>
        <p className="text-xs text-gray-500 mb-3">
          Para propiedades con partner agreement aprobado por cada OTA.
          La mayoría puede usar solo iCal (arriba).
        </p>
        <div className="space-y-5">
          {[
            { key: 'booking', label: 'Booking.com', fields: [{ k: 'username', l: 'Usuario' }, { k: 'password', l: 'Contraseña', secret: true }, { k: 'hotel_id', l: 'Hotel ID' }] },
            { key: 'airbnb', label: 'Airbnb', fields: [{ k: 'access_token', l: 'Access Token', secret: true }, { k: 'listing_id', l: 'Listing ID' }] },
            { key: 'expedia', label: 'Expedia', fields: [{ k: 'client_id', l: 'Client ID' }, { k: 'client_secret', l: 'Client Secret', secret: true }, { k: 'property_id', l: 'Property ID' }] },
            { key: 'hostelworld', label: 'Hostelworld', fields: [{ k: 'api_key', l: 'API Key', secret: true }, { k: 'property_id', l: 'Property ID' }] }
          ].map(({ key, label, fields }) => (
            <div key={key} className="border border-gray-800 rounded-lg p-3 space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase">{label}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {fields.map(({ k, l, secret }) => (
                  <Field key={k} label={l}>
                    {secret
                      ? <SecretInput value={g(key, k)} onChange={f(key, k)} placeholder={l} />
                      : <Input value={g(key, k)} onChange={f(key, k)} placeholder={l} />
                    }
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
        <SaveBtn onClick={() => save('OTAs')} saving={saving === 'OTAs'} label="Guardar OTAs" />
      </ConnBlock>

      <ConnBlock title="Redes Sociales" icon="📱" guideId="instagram" onGuide={openGuide}>
        <div className="space-y-5">
          {[
            { key: 'instagram', label: 'Instagram', icon: '📸', fields: [{ k: 'access_token', l: 'Access Token', secret: true }, { k: 'business_id', l: 'Business Account ID' }] },
            { key: 'facebook', label: 'Facebook', icon: '🔵', fields: [{ k: 'page_token', l: 'Page Access Token', secret: true }, { k: 'page_id', l: 'Page ID' }] },
            { key: 'google', label: 'Google Business', icon: '🔍', fields: [{ k: 'refresh_token', l: 'OAuth2 Refresh Token', secret: true }, { k: 'location_id', l: 'Location ID' }] },
            { key: 'tripadvisor', label: 'TripAdvisor', icon: '🦉', fields: [{ k: 'api_key', l: 'API Key', secret: true }, { k: 'location_id', l: 'Location ID' }, { k: 'mgmt_token', l: 'Management Token', secret: true }] },
            { key: 'tiktok', label: 'TikTok', icon: '🎵', fields: [{ k: 'access_token', l: 'Access Token', secret: true }, { k: 'open_id', l: 'Open ID' }] }
          ].map(({ key, label, icon, fields }) => (
            <div key={key} className="border border-gray-800 rounded-lg p-3 space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase">{icon} {label}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {fields.map(({ k, l, secret }) => (
                  <Field key={k} label={l}>
                    {secret
                      ? <SecretInput value={g(key, k)} onChange={f(key, k)} placeholder={l} />
                      : <Input value={g(key, k)} onChange={f(key, k)} placeholder={l} />
                    }
                  </Field>
                ))}
              </div>
              <TestBtn service={key} slug={slug} token={token} />
            </div>
          ))}
        </div>
        <SaveBtn onClick={() => save('Redes sociales')} saving={saving === 'Redes sociales'} label="Guardar redes sociales" />
      </ConnBlock>

      <ConnBlock title="Motor IA (Revio AI)" icon="🤖" guideId="claude" onGuide={openGuide}>
        <Field label="API Key" hint="Clave interna del motor de inteligencia artificial de Revio">
          <SecretInput value={g('anthropic', 'api_key')} onChange={f('anthropic', 'api_key')} placeholder="sk-ant-api03-..." />
        </Field>
        <div className="flex items-center justify-between">
          <TestBtn service="anthropic" slug={slug} token={token} />
          <SaveBtn onClick={() => save('Anthropic')} saving={saving === 'Anthropic'} label="Guardar" />
        </div>
      </ConnBlock>
    </div>
  );
}

// ============================================================
// TAB 5: NOTIFICACIONES Y ESCALACIONES
// ============================================================
function TabNotifications({ properties, token }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [form, setForm] = useState({
    system_alert_numbers: ['+573234392420'],
    escalation_numbers: ['+573057673770', '+573006526427'],
    learning_numbers: ['+573057673770', '+573006526427'],
    business_hours: { start: '08:00', end: '22:00', timezone: 'America/Bogota', escalate_outside: true },
    email_alerts: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    fetch(`${API}/api/settings?property_id=${propertyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.settings?.notifications) setForm(data.settings.notifications); })
      .catch(() => {});
  }, [propertyId, token]);

  const setArr = (key, idx, val) => setForm(prev => {
    const arr = [...(prev[key] || [])];
    arr[idx] = val;
    return { ...prev, [key]: arr };
  });
  const addArr = (key) => setForm(prev => ({ ...prev, [key]: [...(prev[key] || []), ''] }));
  const removeArr = (key, idx) => setForm(prev => ({
    ...prev, [key]: prev[key].filter((_, i) => i !== idx)
  }));
  const fHours = (k) => (v) => setForm(prev => ({ ...prev, business_hours: { ...prev.business_hours, [k]: v } }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, key: 'notifications', value: form })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast('Configuración de notificaciones guardada');
    } catch (err) { toast(err.message, false); }
    finally { setSaving(false); }
  }

  function NumberList({ label, hint, stateKey }) {
    return (
      <Field label={label} hint={hint}>
        <div className="space-y-2">
          {(form[stateKey] || []).map((num, i) => (
            <div key={i} className="flex gap-2">
              <Input value={num} onChange={v => setArr(stateKey, i, v)} placeholder="+573..." />
              <button onClick={() => removeArr(stateKey, i)}
                className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={() => addArr(stateKey)}
            className="flex items-center gap-1 text-xs text-mystica-blue hover:text-mystica-blue/80">
            <Plus className="w-3.5 h-3.5" /> Agregar número
          </button>
        </div>
      </Field>
    );
  }

  return (
    <div className="space-y-5">
      {properties.length > 1 && (
        <Field label="Propiedad">
          <Select value={propertyId} onChange={setPropertyId}
            options={properties.map(p => ({ value: p.id, label: p.name }))} />
        </Field>
      )}

      <SectionCard title="Alertas del sistema">
        <NumberList
          label="Números para alertas de sistema"
          hint="Reciben alertas cuando un servicio cae (Monitor de Salud)"
          stateKey="system_alert_numbers"
        />
        <Field label="Email para alertas (opcional)">
          <Input value={form.email_alerts} onChange={v => setForm(prev => ({ ...prev, email_alerts: v }))}
            placeholder="ops@misticahostels.com" />
        </Field>
      </SectionCard>

      <SectionCard title="Escalaciones de clientes">
        <NumberList
          label="Números para escalaciones"
          hint="Reciben alertas cuando la IA detecta un cliente frustrado y pausa el chat"
          stateKey="escalation_numbers"
        />
      </SectionCard>

      <SectionCard title="Aprendizaje continuo">
        <NumberList
          label="Números para preguntas sin respuesta"
          hint="Reciben preguntas que la IA no sabe responder para que el equipo las conteste"
          stateKey="learning_numbers"
        />
      </SectionCard>

      <SectionCard title="Horario de atención del agente">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Hora de inicio">
            <Input value={form.business_hours?.start} onChange={fHours('start')} type="time" />
          </Field>
          <Field label="Hora de cierre">
            <Input value={form.business_hours?.end} onChange={fHours('end')} type="time" />
          </Field>
          <Field label="Zona horaria">
            <Select value={form.business_hours?.timezone} onChange={fHours('timezone')} options={[
              { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
              { value: 'UTC', label: 'UTC' }
            ]} />
          </Field>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.business_hours?.escalate_outside !== false}
            onChange={e => fHours('escalate_outside')(e.target.checked)}
            className="rounded border-gray-700 bg-gray-800 text-mystica-blue"
          />
          <span className="text-sm text-gray-300">Escalar al equipo fuera del horario de atención</span>
        </label>
      </SectionCard>

      <SaveBtn onClick={save} saving={saving} />
    </div>
  );
}

// ============================================================
// TAB 6: AGENTE IA
// ============================================================
function TabAgent({ properties, token }) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [form, setForm] = useState({
    agent_name: 'Mística AI',
    personality: 'warm',
    languages: ['es', 'en'],
    max_discount_pct: 15,
    occupancy_threshold_pct: 60,
    auto_reply_delay_sec: 2,
    default_replies: {
      greeting_es: '¡Hola! Soy Mística AI, tu asistente virtual. ¿En qué puedo ayudarte hoy? 🌊',
      greeting_en: 'Hello! I\'m Mística AI, your virtual assistant. How can I help you today? 🌊',
      no_availability: 'Lo siento, no tenemos disponibilidad para esas fechas. ¿Te puedo mostrar otras opciones?',
      payment_sent: '¡Perfecto! Te enviamos el link de pago. Por favor complétalo en los próximos 30 minutos para confirmar tu reserva.',
      farewell: '¡Fue un placer atenderte! Si necesitas algo más, estamos aquí. ¡Hasta pronto! 🌊'
    }
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    fetch(`${API}/api/settings?property_id=${propertyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.settings?.agent) setForm(prev => ({ ...prev, ...data.settings.agent })); })
      .catch(() => {});
  }, [propertyId, token]);

  const f = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));
  const fReply = (key) => (val) => setForm(prev => ({ ...prev, default_replies: { ...prev.default_replies, [key]: val } }));
  const toggleLang = (lang) => setForm(prev => {
    const langs = prev.languages.includes(lang)
      ? prev.languages.filter(l => l !== lang)
      : [...prev.languages, lang];
    return { ...prev, languages: langs };
  });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, key: 'agent', value: form })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast('Configuración del agente guardada');
    } catch (err) { toast(err.message, false); }
    finally { setSaving(false); }
  }

  const PERSONALITIES = [
    { value: 'warm', label: 'Cálido y cercano' },
    { value: 'formal', label: 'Formal y profesional' },
    { value: 'casual', label: 'Casual y divertido' },
    { value: 'concise', label: 'Conciso y directo' }
  ];
  const LANGS = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' }
  ];

  return (
    <div className="space-y-5">
      {properties.length > 1 && (
        <Field label="Propiedad">
          <Select value={propertyId} onChange={setPropertyId}
            options={properties.map(p => ({ value: p.id, label: p.name }))} />
        </Field>
      )}

      <SectionCard title="Identidad del agente">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nombre del agente" hint="Así se presentará en los chats">
            <Input value={form.agent_name} onChange={f('agent_name')} placeholder="Mística AI" />
          </Field>
          <Field label="Personalidad / Tono">
            <Select value={form.personality} onChange={f('personality')} options={PERSONALITIES} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Idiomas activos">
        <div className="flex flex-wrap gap-2">
          {LANGS.map(({ code, label }) => {
            const active = form.languages?.includes(code);
            return (
              <button
                key={code}
                onClick={() => toggleLang(code)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  active
                    ? 'bg-mystica-blue/20 text-mystica-blue border-mystica-blue/40'
                    : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                }`}
              >
                {active && <Check className="w-3.5 h-3.5 inline mr-1" />}
                {label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Umbrales de descuento">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label={`Descuento máximo: ${form.max_discount_pct}%`}
            hint="El agente nunca ofrecerá más de este porcentaje"
          >
            <input
              type="range" min={0} max={40} step={5}
              value={form.max_discount_pct}
              onChange={e => f('max_discount_pct')(Number(e.target.value))}
              className="w-full accent-mystica-blue"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0%</span><span className="text-mystica-blue font-bold">{form.max_discount_pct}%</span><span>40%</span>
            </div>
          </Field>
          <Field
            label={`Umbral de ocupación: ${form.occupancy_threshold_pct}%`}
            hint="Solo ofrece descuentos cuando la ocupación está por debajo de este %"
          >
            <input
              type="range" min={30} max={90} step={5}
              value={form.occupancy_threshold_pct}
              onChange={e => f('occupancy_threshold_pct')(Number(e.target.value))}
              className="w-full accent-mystica-blue"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>30%</span><span className="text-mystica-blue font-bold">{form.occupancy_threshold_pct}%</span><span>90%</span>
            </div>
          </Field>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          El agente ofrecerá hasta un <strong className="text-mystica-blue">{form.max_discount_pct}%</strong> de descuento solo cuando la ocupación sea menor al <strong className="text-mystica-blue">{form.occupancy_threshold_pct}%</strong>
        </p>
      </SectionCard>

      <SectionCard title="Respuestas predeterminadas editables">
        {[
          { key: 'greeting_es', label: 'Saludo (Español)' },
          { key: 'greeting_en', label: 'Saludo (English)' },
          { key: 'no_availability', label: 'Sin disponibilidad' },
          { key: 'payment_sent', label: 'Link de pago enviado' },
          { key: 'farewell', label: 'Despedida' }
        ].map(({ key, label }) => (
          <Field key={key} label={label}>
            <textarea
              value={form.default_replies?.[key] || ''}
              onChange={e => fReply(key)(e.target.value)}
              rows={2}
              className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-mystica-blue resize-none"
            />
          </Field>
        ))}
      </SectionCard>

      <SectionCard title="Intensidad de Ventas">
        <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
          Controla qué tan proactivo es el agente para generar reservas. Afecta la frecuencia y urgencia de los seguimientos.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              value: 'soft',
              label: 'Suave',
              icon: '🌿',
              desc: '1 seguimiento en 24h · Informativo · Sin urgencia',
              color: 'var(--success)',
            },
            {
              value: 'moderate',
              label: 'Moderado',
              icon: '⚖️',
              desc: '2-3 seguimientos · 6h / 24h / 72h · Balance ventas-servicio',
              color: 'var(--accent)',
              default: true,
            },
            {
              value: 'intense',
              label: 'Intenso',
              icon: '🔥',
              desc: '3 seguimientos · 2h / 6h / 24h · Urgencia + descuento escalado',
              color: 'var(--warning)',
            },
          ].map(mode => {
            const active = (form.sales_intensity || 'moderate') === mode.value;
            return (
              <button key={mode.value}
                onClick={() => f('sales_intensity')(mode.value)}
                className="p-3 rounded-xl text-left transition-all"
                style={{
                  border: active ? `2px solid ${mode.color}` : '1px solid var(--border)',
                  background: active ? `color-mix(in srgb, ${mode.color} 8%, var(--card))` : 'var(--card)',
                }}>
                <div className="text-xl mb-1">{mode.icon}</div>
                <div className="text-xs font-semibold mb-1" style={{ color: active ? mode.color : 'var(--text-1)' }}>
                  {mode.label}
                  {mode.default && <span className="ml-1 text-[9px] px-1 rounded" style={{ background: 'var(--surface)', color: 'var(--text-3)' }}>por defecto</span>}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--text-3)' }}>{mode.desc}</div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Proveedor de Inteligencia Artificial">
        <AiProviderSelector propertyId={propertyId} token={token} />
      </SectionCard>

      <SaveBtn onClick={save} saving={saving} />
    </div>
  );
}

// ============================================================
// TAB MÓDULOS — vista del cliente (solo lectura de sus módulos)
// ============================================================
function TabModules({ token }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`${API}/api/modules`, { headers: { Authorization: `Bearer ${token}` } });
        if (r.ok) {
          const d = await r.json();
          setModules(d.modules || []);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return <div className="text-gray-500 p-4">Cargando módulos...</div>;

  const STATUS = {
    production:  { label: 'Producción', badge: 'bg-green-900/50 border-green-700 text-green-300',   bar: 'bg-green-500' },
    beta:        { label: 'Beta',        badge: 'bg-blue-900/50 border-blue-700 text-blue-300',       bar: 'bg-blue-500' },
    development: { label: 'Desarrollo',  badge: 'bg-yellow-900/50 border-yellow-700 text-yellow-300', bar: 'bg-yellow-500' },
    planned:     { label: 'Planificado', badge: 'bg-gray-800 border-gray-700 text-gray-400',         bar: 'bg-gray-500' },
  };

  const activeCount = modules.filter(m => m.tenant_active).length;
  const available = modules.filter(m => m.tenant_active);
  const notIncluded = modules.filter(m => !m.tenant_active);

  return (
    <div className="space-y-5">
      {/* Header con stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-2xl font-bold text-green-400">{activeCount}</div>
          <div className="text-xs text-gray-500">Módulos activos</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-2xl font-bold text-gray-400">{modules.length - activeCount}</div>
          <div className="text-xs text-gray-500">Disponibles para activar</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-2xl font-bold text-blue-400">
            {modules.filter(m => m.status === 'production' || m.status === 'beta').length}
          </div>
          <div className="text-xs text-gray-500">En producción/beta</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-2xl font-bold text-purple-400">
            {modules.filter(m => m.is_sellable).length}
          </div>
          <div className="text-xs text-gray-500">Vendibles</div>
        </div>
      </div>

      {/* Módulos activos */}
      {available.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ✅ Tu plan incluye ({available.length})
          </h3>
          <div className="space-y-2">
            {available.map(m => {
              const st = STATUS[m.status] || STATUS.planned;
              return (
                <div key={m.id} className="bg-gray-900 border border-green-800/50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-white">{m.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${st.badge}`}>{st.label}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 border border-green-700 text-green-300">
                            Activo
                          </span>
                        </div>
                        {m.description && <div className="text-xs text-gray-500 mt-1">{m.description}</div>}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full ${st.bar}`} style={{ width: `${m.completion_pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{m.completion_pct}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Módulos disponibles para contratar */}
      {notIncluded.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            🔒 Disponibles para agregar a tu plan
          </h3>
          <div className="space-y-2">
            {notIncluded.map(m => {
              const st = STATUS[m.status] || STATUS.planned;
              return (
                <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl grayscale">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-300">{m.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${st.badge}`}>{st.label}</span>
                          {m.is_sellable && m.base_price_cop > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-700 text-purple-300">
                              ${m.base_price_cop.toLocaleString()} COP/mes
                            </span>
                          )}
                        </div>
                        {m.description && <div className="text-xs text-gray-500 mt-1">{m.description}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => window.open('mailto:soporte@revio.co?subject=Activar módulo ' + m.name)}
                      disabled={!m.is_sellable || m.status === 'planned'}
                      className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 rounded-lg whitespace-nowrap"
                    >
                      {m.is_sellable ? '+ Solicitar' : 'Próximamente'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <Lock className="w-3 h-3 inline mr-1" />
        La activación y desactivación de módulos la gestiona el equipo de Revio.
        Para agregar nuevos módulos contacta a <span className="text-blue-400">soporte@revio.co</span>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
const TABS = [
  { id: 'general',       label: 'General',        icon: Settings },
  { id: 'properties',   label: 'Propiedades',     icon: Building2 },
  { id: 'modules',      label: 'Módulos',         icon: Package },
  { id: 'users',        label: 'Usuarios',        icon: Users },
  { id: 'connections',  label: 'Integraciones',   icon: Plug },
  { id: 'notifications',label: 'Notificaciones',  icon: Bell },
  { id: 'agent',        label: 'Agente IA',       icon: Bot }
];

export default function ConfigPanel() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/settings/properties`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setProperties(Array.isArray(data) ? data.filter(p => p.is_active !== false) : []);
    } catch { setProperties([]); }
    finally { setLoading(false); }
  }, [token, refreshKey]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-gray-500">Cargando configuración...</div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-mystica-blue" />
          Configuración
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Gestiona todas las opciones del sistema sin tocar código
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
              activeTab === id
                ? 'bg-mystica-blue/20 text-mystica-blue font-medium'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'general'        && <TabGeneral properties={properties} token={token} />}
        {activeTab === 'properties'     && <TabProperties properties={properties} token={token} onRefresh={() => setRefreshKey(k => k + 1)} />}
        {activeTab === 'modules'        && <TabModules token={token} />}
        {activeTab === 'users'          && <TabUsers properties={properties} token={token} />}
        {activeTab === 'connections'    && <IntegrationsPanel properties={properties} token={token} />}
        {activeTab === 'notifications'  && <TabNotifications properties={properties} token={token} />}
        {activeTab === 'agent'          && <TabAgent properties={properties} token={token} />}
      </div>
    </div>
  );
}
