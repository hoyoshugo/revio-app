/**
 * PropertyInfoPanel — Info Propiedad estructurada
 *
 * Formulario organizado en secciones colapsables que mapea 1:1 a
 * property_knowledge (category/key). Cada campo hace UPSERT individual
 * al guardar cambios. No contiene datos hardcodeados de ningún cliente.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown, ChevronUp, Save, Plus, X,
  Info, FileText, Compass, Sparkles, Bus, UtensilsCrossed, Phone, Image,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Definición de secciones: cada campo mapea a (category, key)
const SECTIONS = [
  {
    id: 'general',
    label: 'Información general',
    icon: Info,
    fields: [
      { category: 'general', key: 'nombre',    label: 'Nombre de la propiedad', type: 'text' },
      { category: 'general', key: 'tipo',      label: 'Tipo de propiedad',      type: 'text',     placeholder: 'Hostal boutique, hotel, apart-hotel...' },
      { category: 'general', key: 'ubicacion', label: 'Ubicación',              type: 'text',     placeholder: 'Ciudad, región, país' },
      { category: 'general', key: 'gps',       label: 'Coordenadas GPS',        type: 'text',     placeholder: '10.1833° N, 75.7833° W' },
      { category: 'general', key: 'idiomas',   label: 'Idiomas hablados',       type: 'text',     placeholder: 'Español, Inglés, Francés' },
      { category: 'general', key: 'incluye',   label: 'Qué incluye',            type: 'textarea', placeholder: 'Desayuno, WiFi, actividades incluidas...' },
      { category: 'general', key: 'entorno',   label: 'Descripción del entorno', type: 'textarea', placeholder: 'Describe el entorno, naturaleza, vecindario...' },
    ],
  },
  {
    id: 'policies',
    label: 'Políticas',
    icon: FileText,
    fields: [
      { category: 'policies', key: 'checkin',            label: 'Check-in',              type: 'text',     placeholder: 'Desde las 2:00 PM' },
      { category: 'policies', key: 'checkout',           label: 'Check-out',             type: 'text',     placeholder: 'Hasta las 11:00 AM' },
      { category: 'policies', key: 'cancelacion',        label: 'Política de cancelación', type: 'textarea' },
      { category: 'policies', key: 'mascotas',           label: 'Política de mascotas',  type: 'text' },
      { category: 'policies', key: 'restriccion_ninos',  label: 'Restricción de niños',  type: 'text' },
    ],
  },
  {
    id: 'activities',
    label: 'Actividades',
    icon: Sparkles,
    fields: [
      { category: 'activities', key: 'listado',             label: 'Actividades disponibles',         type: 'textarea', placeholder: 'Snorkel, kayak, paseos...' },
      { category: 'activities', key: 'nota_critica',        label: 'Nota crítica',                    type: 'textarea', placeholder: 'Qué actividades tienen costo, restricciones, reglas' },
      { category: 'activities', key: 'bioluminiscencia_regla', label: 'Regla tour bioluminiscencia', type: 'textarea' },
      { category: 'activities', key: 'link',                label: 'URL de actividades',             type: 'text',     placeholder: 'https://...' },
    ],
  },
  {
    id: 'transport',
    label: 'Cómo llegar',
    icon: Bus,
    fields: [
      { category: 'transport', key: 'como_llegar',        label: 'Instrucciones para llegar', type: 'textarea' },
      { category: 'transport', key: 'aliado_principal',   label: 'Aliado principal',          type: 'textarea' },
      { category: 'transport', key: 'aliado_secundario',  label: 'Aliado secundario',         type: 'textarea' },
      { category: 'transport', key: 'link',               label: 'URL cómo llegar',           type: 'text' },
    ],
  },
  {
    id: 'food',
    label: 'Gastronomía',
    icon: UtensilsCrossed,
    fields: [
      { category: 'food',   key: 'descripcion', label: 'Info bar y restaurante', type: 'textarea', placeholder: 'Tipo de cocina, horarios, menú destacado...' },
    ],
  },
  {
    id: 'contact',
    label: 'Contacto',
    icon: Phone,
    fields: [
      { category: 'contact', key: 'horario',         label: 'Horario de atención', type: 'text',     placeholder: '7:00 AM - 10:00 PM' },
      { category: 'contact', key: 'whatsapp',        label: 'WhatsApp',            type: 'text',     placeholder: '+573001234567' },
      { category: 'contact', key: 'web',             label: 'Web',                 type: 'text',     placeholder: 'https://...' },
      { category: 'contact', key: 'booking_engine',  label: 'Motor de reservas',   type: 'text',     placeholder: 'https://booking...' },
    ],
  },
  {
    id: 'faq',
    label: 'FAQ rápidas',
    icon: Info,
    fields: [
      { category: 'faq',     key: 'efectivo', label: 'Efectivo / Cajero', type: 'textarea' },
      { category: 'faq',     key: 'wifi',     label: 'WiFi',              type: 'textarea' },
    ],
  },
  {
    id: 'media',
    label: 'Fotos',
    icon: Image,
    custom: true, // render custom
  },
];

function Chevron({ open }) {
  return open
    ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-2)' }} />
    : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-2)' }} />;
}

function Section({ section, open, onToggle, children }) {
  const Icon = section.icon;
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-opacity-50"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{section.label}</span>
        </div>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder }) {
  const baseStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
  };
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-2)' }}>{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          rows={3}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors"
          style={baseStyle}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors"
          style={baseStyle}
        />
      )}
    </div>
  );
}

function MediaFotos({ photos, onChange }) {
  const [newUrl, setNewUrl] = useState('');

  function add() {
    if (!newUrl.trim()) return;
    onChange([...(photos || []), newUrl.trim()]);
    setNewUrl('');
  }

  function remove(idx) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="https://..."
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
        />
        <button
          onClick={add}
          className="px-3 py-2 rounded-lg text-sm flex items-center gap-1"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
      {(!photos || photos.length === 0) && (
        <p className="text-xs text-center py-6" style={{ color: 'var(--text-3)' }}>
          Aún no hay fotos. Agrega URLs públicas de tus mejores imágenes.
        </p>
      )}
      <div className="space-y-1.5">
        {(photos || []).map((url, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <span className="text-xs font-mono truncate flex-1" style={{ color: 'var(--text-2)' }}>{url}</span>
            <button
              onClick={() => remove(i)}
              className="p-1 rounded hover:bg-red-500/10 transition-colors"
              title="Eliminar"
            >
              <X className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PropertyInfoPanel() {
  const { token, currentProperty, properties } = useAuth();
  const [propertyId, setPropertyId] = useState(currentProperty?.id || properties?.[0]?.id || '');
  const [data, setData] = useState({});
  const [photos, setPhotos] = useState([]);
  const [openSections, setOpenSections] = useState({ general: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propertyId && currentProperty?.id) setPropertyId(currentProperty.id);
  }, [currentProperty, propertyId]);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/knowledge/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        const map = {};
        for (const entry of j.entries || []) {
          if (!map[entry.category]) map[entry.category] = {};
          map[entry.category][entry.key] = { id: entry.id, value: entry.value };
        }
        setData(map);
        // parse fotos si existen
        const mediaFotos = map.media?.fotos?.value;
        if (mediaFotos) {
          try { setPhotos(JSON.parse(mediaFotos)); }
          catch { setPhotos([]); }
        } else {
          setPhotos([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [propertyId, token]);

  useEffect(() => { load(); }, [load]);

  function getValue(category, key) {
    return data[category]?.[key]?.value || '';
  }

  function setValue(category, key, value) {
    setData(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || {}),
        [key]: { ...(prev[category]?.[key] || {}), value },
      },
    }));
  }

  async function upsertEntry(category, key, value) {
    const existing = data[category]?.[key];
    if (existing?.id) {
      // PUT
      const r = await fetch(`${API}/api/knowledge/${propertyId}/${existing.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      return r.ok;
    }
    // POST
    const r = await fetch(`${API}/api/knowledge/${propertyId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, key, value, is_active: true }),
    });
    return r.ok;
  }

  async function save() {
    if (!propertyId) return;
    setSaving(true);
    setMessage(null);
    try {
      // Todos los campos estructurados
      const jobs = [];
      for (const section of SECTIONS) {
        if (section.custom) continue;
        for (const field of section.fields) {
          const val = getValue(field.category, field.key);
          // Solo guardar campos con valor (no creamos entradas vacías)
          if (val && val.trim()) {
            jobs.push(upsertEntry(field.category, field.key, val));
          }
        }
      }
      // Fotos (siempre como JSON en media/fotos)
      jobs.push(upsertEntry('media', 'fotos', JSON.stringify(photos || [])));

      const results = await Promise.all(jobs);
      const ok = results.filter(Boolean).length;
      setMessage({ kind: 'success', text: `Guardado ${ok} campo(s) correctamente.` });
      await load();
    } catch (e) {
      setMessage({ kind: 'error', text: 'Error al guardar: ' + e.message });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 4000);
  }

  const toggle = (id) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
            Info de la propiedad
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
            Esta información la usa el Agente IA para responder a tus huéspedes.
            Mantén los campos actualizados y precisos.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || !propertyId}
          className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Selector de propiedad (si hay múltiples) */}
      {properties && properties.length > 1 && (
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <Compass className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <label className="text-xs" style={{ color: 'var(--text-2)' }}>Propiedad:</label>
          <select
            value={propertyId}
            onChange={e => setPropertyId(e.target.value)}
            className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Mensaje de feedback */}
      {message && (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: message.kind === 'success' ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--danger) 12%, transparent)',
            border: `1px solid ${message.kind === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            color: message.kind === 'success' ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {message.text}
        </div>
      )}

      {loading && (
        <div className="text-center text-sm py-8" style={{ color: 'var(--text-2)' }}>
          Cargando información...
        </div>
      )}

      {/* Secciones */}
      {!loading && SECTIONS.map(section => (
        <Section
          key={section.id}
          section={section}
          open={openSections[section.id]}
          onToggle={() => toggle(section.id)}
        >
          {section.custom && section.id === 'media' ? (
            <MediaFotos photos={photos} onChange={setPhotos} />
          ) : (
            section.fields.map(field => (
              <Field
                key={`${field.category}-${field.key}`}
                label={field.label}
                type={field.type}
                placeholder={field.placeholder}
                value={getValue(field.category, field.key)}
                onChange={(v) => setValue(field.category, field.key, v)}
              />
            ))
          )}
        </Section>
      ))}
    </div>
  );
}
