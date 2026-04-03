import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Save, X, BookOpen, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { value: 'staff_learning', label: 'Aprendizaje IA' },
  { value: 'policies', label: 'Políticas' },
  { value: 'activities', label: 'Actividades' },
  { value: 'transport', label: 'Transporte' },
  { value: 'food', label: 'Comida y bebidas' },
  { value: 'rooms', label: 'Habitaciones' },
  { value: 'general', label: 'General' }
];

function EntryCard({ entry, onEdit, onDelete }) {
  const cat = CATEGORIES.find(c => c.value === entry.category);
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="flex-1">
            <p className="text-white text-sm font-medium leading-snug">{entry.question}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(entry)}
            className="p-1.5 text-gray-500 hover:text-blue-400 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-gray-400 text-xs leading-relaxed mb-3">{entry.answer}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs bg-gray-800 text-gray-400 rounded px-2 py-0.5">
          {cat?.label || entry.category}
        </span>
        <span className="text-xs text-gray-600">
          {entry.created_by && `por ${entry.created_by} · `}
          {new Date(entry.created_at).toLocaleDateString('es-CO')}
        </span>
      </div>
    </div>
  );
}

function EntryForm({ initial, onSave, onCancel, propertyId }) {
  const [form, setForm] = useState({
    question: initial?.question || '',
    answer: initial?.answer || '',
    category: initial?.category || 'general',
    property_id: initial?.property_id || propertyId || null,
    active: true
  });

  return (
    <div className="bg-gray-900 rounded-xl border border-mystica-blue/40 p-4 space-y-3">
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Pregunta del huésped</label>
        <input
          type="text"
          value={form.question}
          onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
          placeholder="¿Cuánto cuesta el tour en lancha?"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-mystica-blue"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Respuesta correcta</label>
        <textarea
          value={form.answer}
          onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
          placeholder="El tour en lancha tiene un costo de $50.000 COP por persona y sale todos los días a las 9am..."
          rows={3}
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-mystica-blue resize-none"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Categoría</label>
        <select
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none"
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ ...form, id: initial?.id })}
          disabled={!form.question.trim() || !form.answer.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-mystica-blue hover:bg-mystica-blue/80 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          Guardar
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function KnowledgeBase({ property }) {
  const { token } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const propertyId = property === 'all' ? null : property;

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('property_id', propertyId);
      const res = await fetch(`${API}/api/social/knowledge?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, propertyId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function handleSave(entry) {
    try {
      const method = entry.id ? 'PUT' : 'POST';
      const url = entry.id ? `${API}/api/social/knowledge/${entry.id}` : `${API}/api/social/knowledge`;
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!res.ok) throw new Error('Error guardando');
      setAdding(false);
      setEditing(null);
      fetchEntries();
    } catch (err) {
      alert('Error guardando: ' + err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Desactivar esta entrada?')) return;
    try {
      await fetch(`${API}/api/social/knowledge/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEntries();
    } catch (err) {
      alert('Error eliminando: ' + err.message);
    }
  }

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.question.toLowerCase().includes(search.toLowerCase()) || e.answer.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || e.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-mystica-blue" />
            Base de Conocimiento
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {entries.length} entradas · La IA usa este conocimiento automáticamente
          </p>
        </div>
        <button
          onClick={() => { setAdding(true); setEditing(null); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-mystica-blue hover:bg-mystica-blue/80 text-white rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva entrada
        </button>
      </div>

      {/* Formulario nueva entrada */}
      {adding && (
        <EntryForm
          propertyId={propertyId}
          onSave={handleSave}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por pregunta o respuesta..."
            className="w-full bg-gray-900 text-white rounded-lg pl-9 pr-3 py-2 text-sm border border-gray-800 focus:outline-none focus:border-gray-600"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-gray-900 text-gray-300 text-sm rounded-lg px-3 py-2 border border-gray-800 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Cargando base de conocimiento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search || filterCat ? 'No hay entradas que coincidan con tu búsqueda' : 'Aún no hay conocimiento guardado. La IA aprenderá automáticamente cuando no pueda responder preguntas.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(entry => (
            editing?.id === entry.id ? (
              <EntryForm
                key={entry.id}
                initial={entry}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={e => { setEditing(e); setAdding(false); }}
                onDelete={handleDelete}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}
