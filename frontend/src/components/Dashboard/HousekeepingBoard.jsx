import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Clock, CheckCircle, SkipForward, Plus, RefreshCw, X, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function getToken() { return localStorage.getItem('revio_token'); }

const COLUMNS = [
  { id: 'pending',     label: 'Pendiente',    icon: Clock,        color: '#F59E0B' },
  { id: 'in_progress', label: 'En progreso',  icon: Wrench,       color: '#6366F1' },
  { id: 'done',        label: 'Completada',   icon: CheckCircle,  color: '#10B981' },
  { id: 'skipped',     label: 'Omitida',      icon: SkipForward,  color: '#94A3B8' },
];

const TASK_TYPES = {
  checkout_clean: 'Limpieza checkout',
  daily_clean:    'Limpieza diaria',
  deep_clean:     'Limpieza profunda',
  maintenance:    'Mantenimiento',
  inspection:     'Inspección',
  setup:          'Preparación',
};

const PRIORITY_COLORS = {
  low:    '#94A3B8',
  normal: '#6366F1',
  high:   '#F59E0B',
  urgent: '#EF4444',
};

export default function HousekeepingBoard() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ room_id: '', type: 'daily_clean', priority: 'normal', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [tasksRes, statsRes, roomsRes] = await Promise.all([
      fetch(`${API}/api/housekeeping?date=${date}`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch(`${API}/api/housekeeping/stats/today`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      fetch(`${API}/api/rooms`, { headers: { Authorization: `Bearer ${getToken()}` } }),
    ]);
    const [td, sd, rd] = await Promise.all([tasksRes.json(), statsRes.json(), roomsRes.json()]);
    setTasks(td.tasks || []);
    setStats(sd.stats || {});
    setRooms(rd.rooms || []);
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(taskId, status) {
    await fetch(`${API}/api/housekeeping/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ status })
    });
    load();
  }

  async function createTask() {
    if (!newTask.room_id) return;
    await fetch(`${API}/api/housekeeping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ ...newTask, scheduled_for: date })
    });
    setShowNew(false);
    setNewTask({ room_id: '', type: 'daily_clean', priority: 'normal', notes: '' });
    load();
  }

  function getColumnTasks(status) {
    return tasks.filter(t => t.status === status);
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>Housekeeping</h1>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>Tablero de tareas de limpieza y mantenimiento</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" className="rv-input text-sm" value={date}
            onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
          <button onClick={load} className="rv-btn-ghost p-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-2)' }} />
          </button>
          <button onClick={() => setShowNew(true)} className="rv-btn-primary">
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {COLUMNS.map(col => {
          const Icon = col.icon;
          const count = stats[col.id] || 0;
          return (
            <div key={col.id} className="rv-card flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${col.color}20` }}>
                <Icon className="w-4 h-4" style={{ color: col.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{count}</div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>{col.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="hk-board flex-1 overflow-y-auto">
          {COLUMNS.map(col => {
            const colTasks = getColumnTasks(col.id);
            const Icon = col.icon;
            return (
              <div key={col.id} className="hk-column">
                <div className="hk-column-header" style={{ borderColor: col.color, color: col.color }}>
                  <Icon className="w-4 h-4" />
                  <span>{col.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-normal"
                    style={{ background: `${col.color}20`, color: col.color }}>
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {colTasks.length === 0 ? (
                    <div className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>
                      Sin tareas
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <div key={task.id} className="hk-task-card">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                              {TASK_TYPES[task.type] || task.type}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                              {task.rooms ? `Hab. ${task.rooms.number}${task.rooms.name ? ` — ${task.rooms.name}` : ''}` : '—'}
                            </div>
                          </div>
                          <span className="rv-badge text-[10px]"
                            style={{ background: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}>
                            {task.priority}
                          </span>
                        </div>

                        {task.notes && (
                          <p className="text-xs mb-2 italic" style={{ color: 'var(--text-3)' }}>{task.notes}</p>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-1 flex-wrap">
                          {col.id === 'pending' && (
                            <button onClick={() => updateStatus(task.id, 'in_progress')}
                              className="text-xs px-2 py-1 rounded-lg transition-colors"
                              style={{ background: '#6366F120', color: '#6366F1' }}>
                              Iniciar
                            </button>
                          )}
                          {col.id === 'in_progress' && (
                            <>
                              <button onClick={() => updateStatus(task.id, 'done')}
                                className="text-xs px-2 py-1 rounded-lg"
                                style={{ background: '#10B98120', color: '#10B981' }}>
                                Completar
                              </button>
                              <button onClick={() => updateStatus(task.id, 'pending')}
                                className="text-xs px-2 py-1 rounded-lg"
                                style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
                                Pausar
                              </button>
                            </>
                          )}
                          {col.id === 'pending' && (
                            <button onClick={() => updateStatus(task.id, 'skipped')}
                              className="text-xs px-2 py-1 rounded-lg"
                              style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
                              Omitir
                            </button>
                          )}
                          {col.id === 'skipped' && (
                            <button onClick={() => updateStatus(task.id, 'pending')}
                              className="text-xs px-2 py-1 rounded-lg"
                              style={{ background: '#F59E0B20', color: '#F59E0B' }}>
                              Reactivar
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New task modal */}
      {showNew && (
        <div className="rv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="rv-modal" style={{ maxWidth: 440 }}>
            <div className="rv-modal-header">
              <h2 className="font-semibold" style={{ color: 'var(--text-1)' }}>Nueva Tarea</h2>
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="rv-modal-body space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Habitación *</label>
                <select className="rv-select" value={newTask.room_id}
                  onChange={e => setNewTask(t => ({ ...t, room_id: e.target.value }))}>
                  <option value="">Seleccionar habitación</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.number} — {r.room_types?.name || r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Tipo de tarea</label>
                <select className="rv-select" value={newTask.type}
                  onChange={e => setNewTask(t => ({ ...t, type: e.target.value }))}>
                  {Object.entries(TASK_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Prioridad</label>
                <select className="rv-select" value={newTask.priority}
                  onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}>
                  <option value="low">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Notas</label>
                <textarea className="rv-input" rows={3} placeholder="Instrucciones adicionales..."
                  value={newTask.notes} onChange={e => setNewTask(t => ({ ...t, notes: e.target.value }))} />
              </div>
            </div>
            <div className="rv-modal-footer">
              <button onClick={() => setShowNew(false)} className="rv-btn-ghost">Cancelar</button>
              <button onClick={createTask} className="rv-btn-primary">Crear tarea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
