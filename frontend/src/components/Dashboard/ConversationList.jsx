import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS = {
  prospect: 'Prospecto',
  quoted: 'Cotizado',
  reserved: 'Reservado',
  paid: 'Pagado',
  checked_in: 'Hospedado',
  checked_out: 'Check-out',
  post_stay: 'Post-estadía'
};

const LANG_FLAGS = { es: '🇨🇴', en: '🇬🇧', fr: '🇫🇷', de: '🇩🇪' };

export default function ConversationList({ property }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('mystica_token');
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (property !== 'all') params.property_slug = property;
      const { data } = await axios.get('/api/dashboard/conversations', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setConversations(data.conversations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [property, statusFilter]);

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.guest_name?.toLowerCase().includes(q) ||
      c.guest_email?.toLowerCase().includes(q) ||
      c.guest_phone?.includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Conversaciones</h1>
        <span className="text-sm text-gray-500">{conversations.length} total</span>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email..."
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-mystica-blue"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-mystica-blue"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-gray-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No hay conversaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(conv => (
            <div
              key={conv.id}
              onClick={() => navigate(`/conversations/${conv.id}`)}
              className="card hover:border-mystica-blue/50 cursor-pointer transition-colors flex items-center gap-3"
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-mystica-blue/10 border border-mystica-blue/20 flex items-center justify-center text-mystica-blue font-bold text-sm flex-shrink-0">
                {conv.guest_name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate">
                    {conv.guest_name || 'Visitante anónimo'}
                  </span>
                  <span className="text-gray-500 text-xs">{LANG_FLAGS[conv.guest_language] || '🌐'}</span>
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {conv.guest_email || conv.guest_phone || 'Sin contacto'} ·
                  {conv.property_interest && ` ${conv.property_interest}`}
                </div>
              </div>

              {/* Estado y tiempo */}
              <div className="text-right flex-shrink-0 space-y-1">
                <span className={`badge badge-${conv.status}`}>
                  {STATUS_LABELS[conv.status] || conv.status}
                </span>
                <div className="text-xs text-gray-600">
                  {conv.last_message_at
                    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: es })
                    : '—'}
                </div>
              </div>

              {/* Mensajes */}
              <div className="text-xs text-gray-600 flex-shrink-0 text-center w-8">
                <MessageSquare className="w-3 h-3 mx-auto" />
                {conv.total_messages}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
