import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, WifiOff, Settings, CheckCircle, XCircle, Clock, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const COP = v => `$${Number(v || 0).toLocaleString('es-CO')}`;

const CHANNELS = [
  { name: 'booking.com', logo: '🏨', color: '#003580' },
  { name: 'airbnb', logo: '🏠', color: '#FF5A5F' },
  { name: 'expedia', logo: '✈️', color: '#FFC107' },
  { name: 'hostelworld', logo: '🌍', color: '#E8002D' },
  { name: 'direct', logo: '🌐', color: '#6366F1' },
  { name: 'tripadvisor', logo: '🦉', color: '#34E0A1' },
];

function ChannelCard({ conn, onToggle, onSync, syncing }) {
  const ch = CHANNELS.find(c => c.name === conn.channel_name?.toLowerCase()) || { logo: '🔗', color: '#6366F1' };
  const lastSync = conn.last_sync ? new Date(conn.last_sync).toLocaleString('es-CO') : 'Nunca';

  return (
    <div className={`rv-card p-4 border-l-4 transition-all ${conn.is_active ? 'border-l-[var(--success)]' : 'border-l-[var(--border)]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--surface-2)]">
            {ch.logo}
          </div>
          <div>
            <div className="font-semibold text-[var(--text-1)] capitalize">{conn.channel_name}</div>
            <div className="text-xs text-[var(--text-3)] mt-0.5">
              {conn.is_active ? (
                <span className="flex items-center gap-1 text-[var(--success)]"><Wifi className="w-3 h-3" /> Conectado</span>
              ) : (
                <span className="flex items-center gap-1 text-[var(--text-3)]"><WifiOff className="w-3 h-3" /> Desactivado</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSync(conn.id)}
            disabled={syncing === conn.id || !conn.is_active}
            className="rv-btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${syncing === conn.id ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
          <button
            onClick={() => onToggle(conn)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              conn.is_active
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
            }`}
          >
            {conn.is_active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-3)]">
        <span>Último sync: {lastSync}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs ${
          conn.sync_status === 'success' ? 'bg-green-500/10 text-green-400' :
          conn.sync_status === 'error'   ? 'bg-red-500/10 text-red-400' :
          'bg-[var(--surface-2)] text-[var(--text-3)]'
        }`}>
          {conn.sync_status || 'Sin estado'}
        </span>
      </div>
    </div>
  );
}

function AvailabilityGrid({ token, pid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { rtId, date, value }
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/channel/availability?property_id=${pid}&days=14`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(await res.json());
    } catch {}
    setLoading(false);
  }, [token, pid]);

  useEffect(() => { load(); }, [load]);

  async function saveOverride(rtId, date, price) {
    setSaving(true);
    try {
      await fetch(`${API}/api/channel/availability/override`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_type_id: rtId, date, price: parseFloat(price) })
      });
      await load();
    } catch {}
    setSaving(false);
    setEditing(null);
  }

  if (loading) return <div className="flex items-center justify-center h-32 text-[var(--text-3)]">Cargando grid...</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left p-2 text-[var(--text-3)] font-medium w-32 sticky left-0 bg-[var(--surface-1)]">
              Tipo habitación
            </th>
            {(data?.dates || []).map(d => (
              <th key={d} className="p-1 text-[var(--text-3)] font-medium text-center min-w-[54px]">
                <div>{d.slice(5)}</div>
                <div className="text-[10px] text-[var(--text-3)] opacity-60">
                  {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(d + 'T12:00:00').getDay()]}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data?.grid || []).map(row => (
            <tr key={row.room_type_id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]/30">
              <td className="p-2 font-medium text-[var(--text-1)] sticky left-0 bg-[var(--surface-1)]">
                {row.room_type_name}
              </td>
              {row.cells.map(cell => {
                const isEditing = editing?.rtId === row.room_type_id && editing?.date === cell.date;
                const pctAvail = Math.round(cell.available / cell.total * 100);
                const cellColor = cell.stop_sell ? 'bg-red-500/10' :
                  pctAvail === 0 ? 'bg-red-500/10' :
                  pctAvail < 30  ? 'bg-orange-500/10' :
                  pctAvail < 70  ? 'bg-yellow-500/10' : 'bg-green-500/10';

                return (
                  <td key={cell.date} className={`p-1 text-center ${cellColor} relative group`}>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          defaultValue={cell.rate}
                          className="w-16 px-1 py-0.5 text-xs bg-[var(--surface-1)] border border-[var(--accent)] rounded text-[var(--text-1)]"
                          onBlur={e => saveOverride(row.room_type_id, cell.date, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveOverride(row.room_type_id, cell.date, e.target.value); if (e.key === 'Escape') setEditing(null); }}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="cursor-pointer" onClick={() => setEditing({ rtId: row.room_type_id, date: cell.date })}>
                        <div className={`font-medium ${cell.stop_sell ? 'line-through text-red-400' : 'text-[var(--text-1)]'}`}>
                          {COP(cell.rate)}
                        </div>
                        <div className="text-[10px] text-[var(--text-3)]">
                          {cell.stop_sell ? 'STOP' : `${cell.available}/${cell.total}`}
                        </div>
                        <Edit2 className="w-2.5 h-2.5 absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-50 text-[var(--accent)]" />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--text-3)]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/20 inline-block" /> Alta disponibilidad</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/20 inline-block" /> Media</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500/20 inline-block" /> Baja</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20 inline-block" /> Sin disp.</span>
        <span className="ml-2 text-[var(--text-3)]">Click en celda para editar tarifa</span>
      </div>
    </div>
  );
}

function SyncLogs({ token, pid }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/channel/sync-logs?property_id=${pid}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setLogs(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, [token, pid]);

  if (loading) return <div className="text-center text-[var(--text-3)] py-4 text-sm">Cargando logs...</div>;

  if (!logs.length) return (
    <div className="text-center text-[var(--text-3)] py-8 text-sm">
      No hay logs de sincronización aún. Ejecuta una sincronización para ver el historial.
    </div>
  );

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {logs.map((log, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
          {log.status === 'success'
            ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          }
          <div className="flex-1 min-w-0">
            <div className="text-sm text-[var(--text-1)] truncate">{log.message}</div>
            <div className="text-xs text-[var(--text-3)]">
              {log.rooms_synced} habitaciones · {new Date(log.created_at).toLocaleString('es-CO')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChannelManager() {
  const { token, propertyId } = useAuth();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [activeTab, setActiveTab] = useState('connections');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChannel, setNewChannel] = useState({ channel_name: '', api_key: '' });

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/channel/connections?property_id=${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConnections(await res.json());
    } catch {}
    setLoading(false);
  }, [token, propertyId]);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  async function handleToggle(conn) {
    try {
      await fetch(`${API}/api/channel/connections/${conn.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !conn.is_active })
      });
      await loadConnections();
    } catch {}
  }

  async function handleSync(channelId) {
    setSyncing(channelId);
    try {
      await fetch(`${API}/api/channel/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId })
      });
      await loadConnections();
    } catch {}
    setSyncing(null);
  }

  async function handleSyncAll() {
    setSyncing('all');
    try {
      await fetch(`${API}/api/channel/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      await loadConnections();
    } catch {}
    setSyncing(null);
  }

  async function handleAddChannel(e) {
    e.preventDefault();
    try {
      await fetch(`${API}/api/channel/connections`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newChannel })
      });
      setShowAddModal(false);
      setNewChannel({ channel_name: '', api_key: '' });
      await loadConnections();
    } catch {}
  }

  const activeCount = connections.filter(c => c.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-1)]">Channel Manager</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">
            {activeCount} canal{activeCount !== 1 ? 'es' : ''} activo{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSyncAll} disabled={syncing === 'all'}
            className="rv-btn-ghost flex items-center gap-1.5 text-sm">
            <RefreshCw className={`w-4 h-4 ${syncing === 'all' ? 'animate-spin' : ''}`} />
            Sync todos
          </button>
          <button onClick={() => setShowAddModal(true)} className="rv-btn text-sm">
            + Conectar canal
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] pb-2">
        {[['connections', 'Canales'], ['grid', 'Grid disponibilidad'], ['logs', 'Historial sync']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === id ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Connections tab */}
      {activeTab === 'connections' && (
        loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-3)]">Cargando...</div>
        ) : connections.length === 0 ? (
          <div className="rv-card p-12 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <div className="text-[var(--text-2)] font-medium mb-2">Sin canales conectados</div>
            <p className="text-sm text-[var(--text-3)] mb-4">Conecta Booking.com, Airbnb, Expedia y más para sincronizar disponibilidad automáticamente.</p>
            <button onClick={() => setShowAddModal(true)} className="rv-btn">Conectar primer canal</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {connections.map(conn => (
              <ChannelCard key={conn.id} conn={conn} onToggle={handleToggle} onSync={handleSync} syncing={syncing} />
            ))}
          </div>
        )
      )}

      {/* Grid tab */}
      {activeTab === 'grid' && (
        <div className="rv-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-1)]">Disponibilidad y tarifas — próximos 14 días</h3>
          </div>
          <AvailabilityGrid token={token} pid={propertyId} />
        </div>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className="rv-card p-4">
          <h3 className="font-semibold text-[var(--text-1)] mb-4">Historial de sincronización</h3>
          <SyncLogs token={token} pid={propertyId} />
        </div>
      )}

      {/* Add channel modal */}
      {showAddModal && (
        <div className="rv-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="rv-modal" onClick={e => e.stopPropagation()}>
            <div className="rv-modal-header">
              <span>Conectar canal OTA</span>
              <button onClick={() => setShowAddModal(false)} className="rv-btn-ghost text-xl">×</button>
            </div>
            <form onSubmit={handleAddChannel} className="rv-modal-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">Canal</label>
                <select value={newChannel.channel_name} onChange={e => setNewChannel({ ...newChannel, channel_name: e.target.value })}
                  className="rv-input w-full" required>
                  <option value="">Seleccionar canal...</option>
                  {CHANNELS.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-2)] mb-1">API Key (opcional)</label>
                <input type="text" value={newChannel.api_key} onChange={e => setNewChannel({ ...newChannel, api_key: e.target.value })}
                  placeholder="sk-..." className="rv-input w-full" />
              </div>
              <div className="rv-modal-footer">
                <button type="button" onClick={() => setShowAddModal(false)} className="rv-btn-ghost">Cancelar</button>
                <button type="submit" className="rv-btn">Conectar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
