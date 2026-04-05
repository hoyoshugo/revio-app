import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, BedDouble, MessageSquare, AlertTriangle, DollarSign, Wrench } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../lib/supabaseClient.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ICON_MAP = {
  reservation: BedDouble,
  message: MessageSquare,
  alert: AlertTriangle,
  payment: DollarSign,
  housekeeping: Wrench,
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Fallback: poll notifications every 30s if no Supabase realtime
function useNotifications(token, pid) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  async function fetchNotifications() {
    try {
      const res = await fetch(`${API}/api/notifications?property_id=${pid}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.notifications || []);
        setNotifications(list);
        setUnread(list.filter(n => !n.read_at).length);
      }
    } catch {}
  }

  useEffect(() => {
    if (!token || !pid) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);

    // Supabase realtime if available
    let sub;
    try {
      sub = supabase
        .channel(`notifications:${pid}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `property_id=eq.${pid}`
        }, payload => {
          setNotifications(prev => [payload.new, ...prev.slice(0, 19)]);
          setUnread(prev => prev + 1);
        })
        .subscribe();
    } catch {}

    return () => {
      clearInterval(interval);
      try { sub?.unsubscribe(); } catch {}
    };
  }, [token, pid]);

  async function markAllRead() {
    try {
      await fetch(`${API}/api/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: pid })
      });
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnread(0);
    } catch {}
  }

  async function markRead(id) {
    try {
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch {}
  }

  return { notifications, unread, markAllRead, markRead, refetch: fetchNotifications };
}

export default function NotificationsBell() {
  const { token, propertyId } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const { notifications, unread, markAllRead, markRead } = useNotifications(token, propertyId);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="rv-btn-ghost relative p-2 rounded-lg"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5 text-[var(--text-2)]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rv-card shadow-2xl z-50 overflow-hidden border border-[var(--border)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-semibold text-[var(--text-1)] text-sm">Notificaciones</span>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="rv-btn-ghost text-xs flex items-center gap-1 text-[var(--accent)]">
                  <CheckCheck className="w-3 h-3" /> Leer todo
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rv-btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[var(--border)]">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-[var(--text-3)] text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Sin notificaciones
              </div>
            ) : (
              notifications.map(n => {
                const Icon = ICON_MAP[n.type] || Bell;
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    onClick={() => { if (isUnread) markRead(n.id); }}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--surface-2)] ${
                      isUnread ? 'bg-[var(--accent)]/5' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isUnread ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--text-3)]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight ${isUnread ? 'font-medium text-[var(--text-1)]' : 'text-[var(--text-2)]'}`}>
                        {n.title || n.message}
                      </p>
                      {n.body && <p className="text-xs text-[var(--text-3)] mt-0.5 truncate">{n.body}</p>}
                      <p className="text-[10px] text-[var(--text-3)] mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {isUnread && <div className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0 mt-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
