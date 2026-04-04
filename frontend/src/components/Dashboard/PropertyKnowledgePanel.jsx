/**
 * PropertyKnowledgePanel — Base de conocimiento dinámica por propiedad
 * El agente IA usa estos datos para responder preguntas sobre la propiedad.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, BookOpen, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { value: 'general',       label: 'Información General',        icon: '🏨', hint: 'Nombre, descripción, historia, ambiente' },
  { value: 'rooms',         label: 'Habitaciones',               icon: '🛏️', hint: 'Tipos, capacidad, precios base, amenidades' },
  { value: 'policies',      label: 'Políticas',                  icon: '📋', hint: 'Check-in/out, cancelación, mascotas, fumar' },
  { value: 'activities',    label: 'Actividades',                icon: '🏄', hint: 'Deportes, tours, experiencias disponibles' },
  { value: 'transport',     label: 'Cómo Llegar',                icon: '🚌', hint: 'Buses, taxis, precios, tiempo de viaje' },
  { value: 'faq',           label: 'Preguntas Frecuentes',       icon: '❓', hint: 'Lo que más preguntan los huéspedes' },
  { value: 'restrictions',  label: 'Restricciones',              icon: '🚫', hint: 'Edades, normas especiales, horarios' },
  { value: 'menu',          label: 'Menú y Restaurante',         icon: '🍽️', hint: 'Desayuno, platos, horarios, precios' },
  { value: 'contact',       label: 'Contacto y Emergencias',     icon: '📞', hint: 'WhatsApp, email, teléfonos de emergencia' },
];

function Badge({ category }) {
  const cat = CATEGORIES.find(c => c.value === category);
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
      {cat?.icon} {cat?.label || category}
    </span>
  );
}

function EntryRow({ entry, onEdit, onDelete, onToggle }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-opacity-50"
      style={{ background: entry.is_active ? 'transparent' : 'color-mix(in srgb, var(--danger) 4%, transparent)' }}>
      <button onClick={() => onToggle(entry)} title={entry.is_active ? 'Desactivar' : 'Activar'}>
        {entry.is_active
          ? <ToggleRight className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
          : <ToggleLeft  className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-3)' }} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-2)' }}>{entry.key}</span>
          <Badge category={entry.category} />
        </div>
        <p className="text-sm" style={{ color: entry.is_active ? 'var(--text-1)' : 'var(--text-3)' }}>
          {entry.value}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(entry)} className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EntryForm({ initial, propertyId, token, onSave, onCancel }) {
  const [form, setForm] = useState({
    category: initial?.category || 'general',
    key: initial?.key || '',
    value: initial?.value || '',
    is_active: initial?.is_active ?? true,
    sort_order: initial?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!form.key.trim() || !form.value.trim()) {
      setError('La clave y el valor son requeridos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = initial?.id
        ? `${API}/api/knowledge/${propertyId}/${initial.id}`
        : `${API}/api/knowledge/${propertyId}`;
      const method = initial?.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      onSave(data.entry);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const cat = CATEGORIES.find(c => c.value === form.category);

  return (
    <div className="rv-surface p-4 rounded-2xl space-y-3 mb-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
        {initial?.id ? 'Editar entrada' : 'Nueva entrada de conocimiento'}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Categoría</label>
          <select className="rv-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
            ))}
          </select>
          {cat && <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>{cat.hint}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Clave (identificador)</label>
          <input className="rv-input font-mono text-xs" value={form.key}
            onChange={e => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
            placeholder="ej: check_in_hora, wifi_clave" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Valor / Información</label>
        <textarea className="rv-input resize-none" rows={3} value={form.value}
          onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
          placeholder="Escribe la información que el agente debe conocer y comunicar a los huéspedes..." />
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rv-btn-ghost px-3 py-1.5 text-xs">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        <button onClick={handleSave} disabled={saving} className="rv-btn-primary px-4 py-1.5 text-xs">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

export default function PropertyKnowledgePanel({ propertyId }) {
  const { token } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedCats, setExpandedCats] = useState(() => {
    const init = {};
    CATEGORIES.forEach(c => { init[c.value] = true; });
    return init;
  });

  const load = useCallback(async () => {
    if (!propertyId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/knowledge/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Error cargando base de conocimiento');
      const data = await res.json();
      setEntries(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId, token]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(entry) {
    if (!confirm(`¿Eliminar "${entry.key}"?`)) return;
    try {
      await fetch(`${API}/api/knowledge/${propertyId}/${entry.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntries(e => e.filter(x => x.id !== entry.id));
    } catch { /* ignore */ }
  }

  async function handleToggle(entry) {
    try {
      const res = await fetch(`${API}/api/knowledge/${propertyId}/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: !entry.is_active }),
      });
      const data = await res.json();
      if (data.entry) setEntries(e => e.map(x => x.id === entry.id ? data.entry : x));
    } catch { /* ignore */ }
  }

  function handleSaved(entry) {
    setEntries(e => {
      const idx = e.findIndex(x => x.id === entry.id);
      if (idx >= 0) {
        const copy = [...e];
        copy[idx] = entry;
        return copy;
      }
      return [...e, entry];
    });
    setShowForm(false);
    setEditing(null);
  }

  // Group by category
  const grouped = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry);
  }

  const activeCount = entries.filter(e => e.is_active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>Base de Conocimiento</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {activeCount} entradas activas · El agente IA las usa en sus respuestas
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="rv-btn-primary px-3 py-2 text-xs flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nueva entrada
        </button>
      </div>

      {/* Form */}
      {(showForm || editing) && (
        <EntryForm
          initial={editing}
          propertyId={propertyId}
          token={token}
          onSave={handleSaved}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Empty state */}
      {loading && (
        <div className="text-center py-12" style={{ color: 'var(--text-3)' }}>
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          Cargando base de conocimiento...
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-12 rv-surface rounded-2xl">
          <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Sin entradas de conocimiento</p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-3)' }}>
            Agrega información sobre tu propiedad para que el agente responda con precisión.
          </p>
          <button onClick={() => setShowForm(true)} className="rv-btn-primary px-4 py-2 text-xs">
            <Plus className="w-3.5 h-3.5" /> Agregar primera entrada
          </button>
        </div>
      )}

      {/* Grouped by category */}
      {!loading && entries.length > 0 && CATEGORIES.map(cat => {
        const catEntries = grouped[cat.value] || [];
        if (catEntries.length === 0) return null;
        const expanded = expandedCats[cat.value];
        return (
          <div key={cat.value} className="rv-surface rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}
              onClick={() => setExpandedCats(x => ({ ...x, [cat.value]: !x[cat.value] }))}>
              <span>{cat.icon}</span>
              <span className="text-sm font-semibold flex-1 text-left" style={{ color: 'var(--text-1)' }}>
                {cat.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
                {catEntries.length}
              </span>
              {expanded
                ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
                : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-3)' }} />}
            </button>
            {expanded && (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {catEntries.map(entry => (
                  <EntryRow key={entry.id} entry={entry}
                    onEdit={e => { setEditing(e); setShowForm(false); }}
                    onDelete={handleDelete}
                    onToggle={handleToggle} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
