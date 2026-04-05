import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wrench, Clock, CheckCircle, SkipForward, Plus, RefreshCw, X, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { elapsedMinutes } from '../../lib/utils.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const COLUMNS = [
  { id: 'pending',     label: 'Pendiente',   icon: Clock,        color: '#F59E0B' },
  { id: 'in_progress', label: 'En progreso', icon: Wrench,       color: '#6366F1' },
  { id: 'done',        label: 'Completada',  icon: CheckCircle,  color: '#10B981' },
  { id: 'skipped',     label: 'Omitida',     icon: SkipForward,  color: '#94A3B8' },
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

function ElapsedBadge({ startedAt, status }) {
  const [mins, setMins] = useState(() => startedAt ? elapsedMinutes(startedAt) : 0);

  useEffect(() => {
    if (status !== 'in_progress' || !startedAt) return;
    const id = setInterval(() => setMins(elapsedMinutes(startedAt)), 60000);
    return () => clearInterval(id);
  }, [startedAt, status]);

  if (status !== 'in_progress' || !startedAt) return null;

  const color = mins > 60 ? '#EF4444' : mins > 30 ? '#F59E0B' : '#10B981';
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
      style={{ background: `${color}20`, color }}>
      {mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h ${mins % 60}m`}
    </span>
  );
}

function TaskCard({ task, onStatusChange, onAssign, staff, dragging, onDragStart, onDragEnd }) {
  return (
    <div
      className="hk-task-card"
      draggable
      onDragStart={() => onDragStart(task)}
      onDragEnd={onDragEnd}
      style={{ opacity: dragging?.id === task.id ? 0.4 : 1, cursor: 'grab' }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
            {TASK_TYPES[task.type] || task.type}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
            {task.rooms ? `Hab. ${task.rooms.number}${task.rooms.name ? ` — ${task.rooms.name}` : ''}` : '—'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <ElapsedBadge startedAt={task.started_at || task.updated_at} status={task.status} />
          <span className="rv-badge text-[10px]"
            style={{ background: `${PRIORITY_COLORS[task.priority]}20`, color: PRIORITY_COLORS[task.priority] }}>
            {task.priority}
          </span>
        </div>
      </div>

      {task.notes && (
        <p className="text-xs mb-2 italic" style={{ color: 'var(--text-3)' }}>{task.notes}</p>
      )}

      {/* Staff assignment */}
      <div className="mb-2">
        <select
          className="rv-select text-xs py-1"
          value={task.assigned_to || ''}
          onChange={e => onAssign(task.id, e.target.value || null)}
          onClick={e => e.stopPropagation()}
        >
          <option value="">Sin asignar</option>
          {(staff || []).map(s => (
            <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
          ))}
        </select>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 flex-wrap">
        {task.status === 'pending' && (
          <>
            <button onClick={() => onStatusChange(task.id, 'in_progress')}
              className="text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ background: '#6366F120', color: '#6366F1' }}>
              Iniciar
            </button>
            <button onClick={() => onStatusChange(task.id, 'skipped')}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
              Omitir
            </button>
          </>
        )}
        {task.status === 'in_progress' && (
          <>
            <button onClick={() => onStatusChange(task.id, 'done')}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: '#10B98120', color: '#10B981' }}>
              Completar
            </button>
            <button onClick={() => onStatusChange(task.id, 'pending')}
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
              Pausar
            </button>
          </>
        )}
        {task.status === 'skipped' && (
          <button onClick={() => onStatusChange(task.id, 'pending')}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: '#F59E0B20', color: '#F59E0B' }}>
            Reactivar
          </button>
        )}
        {task.status === 'done' && (
          <button onClick={() => onStatusChange(task.id, 'in_progress')}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--card)', color: 'var(--text-3)' }}>
            Reabrir
          </button>
        )}
      </div>
    </div>
  );
}

export default function HousekeepingBoard() {
  const { authHeaders } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [rooms, setRooms] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ room_id: '', type: 'daily_clean', priority: 'normal', notes: '' });
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, statsRes, roomsRes] = await Promise.all([
        fetch(`${API}/api/housekeeping?date=${date}`, { headers: authHeaders }),
        fetch(`${API}/api/housekeeping/stats/today`, { headers: authHeaders }),
        fetch(`${API}/api/rooms`, { headers: authHeaders }),
      ]);
      const [td, sd, rd] = await Promise.all([tasksRes.json(), statsRes.json(), roomsRes.json()]);
      setTasks(td.tasks || []);
      setStats(sd.stats || {});
      setRooms(rd.rooms || []);
    } catch {}
    setLoading(false);
  }, [date, authHeaders]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(taskId, status) {
    // Optimistic update
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status } : t));
    try {
      await fetch(`${API}/api/housekeeping/${taskId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      // Refresh stats
      const statsRes = await fetch(`${API}/api/housekeeping/stats/today`, { headers: authHeaders });
      const sd = await statsRes.json();
      setStats(sd.stats || {});
    } catch {
      // Revert on error
      load();
    }
  }

  async function assignStaff(taskId, userId) {
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, assigned_to: userId } : t));
    try {
      await fetch(`${API}/api/housekeeping/${taskId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: userId })
      });
    } catch { load(); }
  }

  async function createTask() {
    if (!newTask.room_id) return;
    try {
      await fetch(`${API}/api/housekeeping`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTask, scheduled_for: date })
      });
      setShowNew(false);
      setNewTask({ room_id: '', type: 'daily_clean', priority: 'normal', notes: '' });
      load();
    } catch {}
  }

  // Drag-and-drop handlers
  function handleDragStart(task) {
    setDragging(task);
  }
  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
  }
  function handleDragOver(e, columnId) {
    e.preventDefault();
    setDragOver(columnId);
  }
  function handleDrop(e, columnId) {
    e.preventDefault();
    if (dragging && dragging.status !== columnId) {
      updateStatus(dragging.id, columnId);
    }
    setDragging(null);
    setDragOver(null);
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
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Tablero de tareas — arrastra para cambiar estado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" className="rv-input text-sm" value={date}
            onChange={e => setDate(e.target.value)} style={{ width: 160 }} />
          <button onClick={load} className="rv-btn-ghost p-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-2)' }} />
          </button>
          <button onClick={() => setShowNew(true)} className="rv-btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {COLUMNS.map(col => {
          const Icon = col.icon;
          const count = stats[col.id] || getColumnTasks(col.id).length;
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
            const isOver = dragOver === col.id;
            return (
              <div key={col.id} className="hk-column"
                onDragOver={e => handleDragOver(e, col.id)}
                onDrop={e => handleDrop(e, col.id)}
                style={{
                  outline: isOver ? `2px dashed ${col.color}` : 'none',
                  outlineOffset: -2,
                  background: isOver ? `${col.color}08` : undefined,
                  borderRadius: 12,
                  transition: 'background 0.15s, outline 0.15s',
                }}>
                <div className="hk-column-header" style={{ borderColor: col.color, color: col.color }}>
                  <Icon className="w-4 h-4" />
                  <span>{col.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-normal"
                    style={{ background: `${col.color}20`, color: col.color }}>
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2 min-h-[80px]">
                  {colTasks.length === 0 ? (
                    <div className="text-xs text-center py-4 rounded-lg"
                      style={{ color: 'var(--text-3)', border: `1px dashed ${isOver ? col.color : 'var(--border)'}` }}>
                      {isOver ? 'Soltar aquí' : 'Sin tareas'}
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={updateStatus}
                        onAssign={assignStaff}
                        staff={staff}
                        dragging={dragging}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
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
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TASK_TYPES).map(([k, v]) => (
                    <button key={k}
                      onClick={() => setNewTask(t => ({ ...t, type: k }))}
                      className="text-xs px-3 py-2 rounded-lg text-left transition-all"
                      style={{
                        border: `1.5px solid ${newTask.type === k ? 'var(--accent)' : 'var(--border)'}`,
                        background: newTask.type === k ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--card)',
                        color: newTask.type === k ? 'var(--accent)' : 'var(--text-2)'
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Prioridad</label>
                <div className="flex gap-2">
                  {['low', 'normal', 'high', 'urgent'].map(p => (
                    <button key={p}
                      onClick={() => setNewTask(t => ({ ...t, priority: p }))}
                      className="flex-1 text-xs py-1.5 rounded-lg transition-all capitalize"
                      style={{
                        border: `1.5px solid ${newTask.priority === p ? PRIORITY_COLORS[p] : 'var(--border)'}`,
                        background: newTask.priority === p ? `${PRIORITY_COLORS[p]}15` : 'var(--card)',
                        color: newTask.priority === p ? PRIORITY_COLORS[p] : 'var(--text-2)'
                      }}>
                      {p === 'low' ? 'Baja' : p === 'normal' ? 'Normal' : p === 'high' ? 'Alta' : 'Urgente'}
                    </button>
                  ))}
                </div>
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
