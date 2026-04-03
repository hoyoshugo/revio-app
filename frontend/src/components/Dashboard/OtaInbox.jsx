import React, { useEffect, useState, useRef } from 'react';
import {
  MessageSquare, RefreshCw, Send, Filter,
  CheckCircle, Clock, AlertCircle, ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

const PLATFORM_CONFIG = {
  booking: { label: 'Booking.com', color: 'bg-blue-600', textColor: 'text-blue-400', dot: '🔵' },
  airbnb:  { label: 'Airbnb',       color: 'bg-red-600',  textColor: 'text-red-400',  dot: '🔴' },
  hostelworld: { label: 'Hostelworld', color: 'bg-orange-600', textColor: 'text-orange-400', dot: '🟠' }
};

const STATUS_CONFIG = {
  unread:  { label: 'Sin responder', icon: AlertCircle, color: 'text-yellow-400' },
  replied: { label: 'Respondido',    icon: CheckCircle,  color: 'text-green-400' },
  failed:  { label: 'Error',         icon: AlertCircle,  color: 'text-red-400' },
  read:    { label: 'Leído',         icon: Clock,        color: 'text-gray-400' }
};

export default function OtaInbox({ property }) {
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const replyRef = useRef(null);

  const token = localStorage.getItem('mystica_token');
  const headers = { Authorization: `Bearer ${token}` };

  async function loadMessages() {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (platformFilter) params.platform = platformFilter;
      if (statusFilter) params.status = statusFilter;
      if (property !== 'all') params.property_slug = property;

      const [msgsRes, statsRes] = await Promise.all([
        axios.get('/api/ota/inbox', { headers, params }),
        axios.get('/api/ota/stats', { headers, params: property !== 'all' ? { property_slug: property } : {} })
      ]);

      setMessages(msgsRes.data.messages || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(msg) {
    setSelected(msg);
    setReplyText('');
    try {
      const { data } = await axios.get(`/api/ota/inbox/${msg.id}`, { headers });
      setThread(data.thread || [msg]);
    } catch {
      setThread([msg]);
    }
  }

  async function sendReply() {
    if (!replyText.trim() || !selected || sending) return;
    setSending(true);
    try {
      await axios.post(`/api/ota/inbox/${selected.id}/reply`, { text: replyText }, { headers });
      setReplyText('');
      await loadMessages();
      // Actualizar thread
      setThread(prev => [...prev, {
        id: Date.now(),
        direction: 'outbound',
        body: replyText,
        created_at: new Date().toISOString()
      }]);
    } catch (err) {
      alert('Error enviando respuesta: ' + err.message);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => { loadMessages(); }, [property, platformFilter, statusFilter]);

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            Inbox OTA
            {unreadCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Mensajes centralizados de Booking.com, Airbnb y Hostelworld
          </p>
        </div>
        <button onClick={loadMessages} className="btn-ghost flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Estadísticas por plataforma */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="card text-center">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-500">Total (30d)</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.unread}</div>
            <div className="text-xs text-gray-500">Sin responder</div>
          </div>
          {Object.entries(stats.by_platform || {}).map(([platform, data]) => {
            const pc = PLATFORM_CONFIG[platform];
            return (
              <div key={platform} className="card text-center">
                <div className="text-xl font-bold text-white">{data.unread}/{data.total}</div>
                <div className={`text-xs ${pc?.textColor || 'text-gray-400'}`}>{pc?.label || platform}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={platformFilter}
          onChange={e => setPlatformFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-mystica-blue"
        >
          <option value="">Todas las plataformas</option>
          <option value="booking">Booking.com</option>
          <option value="airbnb">Airbnb</option>
          <option value="hostelworld">Hostelworld</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-mystica-blue"
        >
          <option value="">Todos los estados</option>
          <option value="unread">Sin responder</option>
          <option value="replied">Respondidos</option>
          <option value="failed">Con error</option>
        </select>
      </div>

      {/* Layout: lista + detalle */}
      <div className="grid lg:grid-cols-2 gap-4 h-[60vh]">
        {/* Lista de mensajes */}
        <div className="card overflow-y-auto p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-800 animate-pulse rounded-lg" />)}
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay mensajes de OTAs</p>
              <p className="text-gray-600 text-xs mt-1">Los mensajes aparecen cuando configures los webhooks</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {messages.map(msg => {
                const pc = PLATFORM_CONFIG[msg.platform];
                const sc = STATUS_CONFIG[msg.status];
                const StatusIcon = sc?.icon || Clock;
                const isSelected = selected?.id === msg.id;

                return (
                  <div
                    key={msg.id}
                    onClick={() => loadThread(msg)}
                    className={`p-3 cursor-pointer transition-colors hover:bg-gray-800 ${isSelected ? 'bg-gray-800 border-l-2 border-mystica-blue' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0 mt-0.5">{pc?.dot || '⚫'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium truncate">
                            {msg.guest_name || 'Huésped'}
                          </span>
                          <span className={`text-xs ${pc?.textColor || 'text-gray-400'}`}>
                            {pc?.label || msg.platform}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{msg.body}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusIcon className={`w-3 h-3 ${sc?.color || 'text-gray-400'}`} />
                          <span className={`text-xs ${sc?.color || 'text-gray-400'}`}>{sc?.label}</span>
                          <span className="text-xs text-gray-600">
                            {msg.created_at
                              ? formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: es })
                              : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel de detalle y respuesta */}
        <div className="card flex flex-col p-0 overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Selecciona un mensaje para responder</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header del mensaje seleccionado */}
              <div className="p-3 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium text-sm">{selected.guest_name}</span>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {PLATFORM_CONFIG[selected.platform]?.label} ·
                      Reserva: {selected.platform_reservation_id || 'N/A'}
                    </div>
                  </div>
                  {selected.ai_reply_sent && (
                    <span className="badge bg-green-900/50 text-green-300 text-xs">
                      ✓ IA respondió
                    </span>
                  )}
                </div>
              </div>

              {/* Thread de mensajes */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-950">
                {thread.map((msg, i) => (
                  <div key={msg.id || i} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-mystica-blue/20 text-white border border-mystica-blue/20 rounded-br-sm'
                        : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-sm'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.body}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        {msg.direction === 'outbound' ? '✓ Enviado' : PLATFORM_CONFIG[msg.platform]?.label || 'Huésped'}
                        {msg.created_at && ` · ${format(new Date(msg.created_at), 'HH:mm', { locale: es })}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Área de respuesta */}
              <div className="p-3 border-t border-gray-800">
                {selected.ai_reply_body && (
                  <div className="mb-2 p-2 bg-green-900/20 border border-green-800/30 rounded-lg">
                    <p className="text-xs text-green-400 font-medium mb-1">Respuesta enviada por IA:</p>
                    <p className="text-xs text-gray-300">{selected.ai_reply_body}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    ref={replyRef}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Responder manualmente..."
                    rows={2}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-mystica-blue resize-none"
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) sendReply(); }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || sending}
                    className="btn-primary flex items-center gap-1.5 self-end disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? '...' : 'Enviar'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">Ctrl+Enter para enviar</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
