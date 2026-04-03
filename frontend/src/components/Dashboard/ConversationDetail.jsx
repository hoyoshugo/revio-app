import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, Mail, Phone } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABELS = {
  prospect: 'Prospecto', quoted: 'Cotizado', reserved: 'Reservado',
  paid: 'Pagado', checked_in: 'Hospedado', checked_out: 'Check-out'
};

export default function ConversationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('mystica_token');
      const res = await axios.get(`/api/dashboard/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="space-y-3">
      <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
      <div className="card h-40 animate-pulse" />
    </div>
  );

  const { conversation: conv, messages } = data;

  return (
    <div className="space-y-4 max-w-4xl">
      <button onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      {/* Info del cliente */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-mystica-blue/10 border border-mystica-blue/20 flex items-center justify-center text-mystica-blue font-bold text-lg">
            {conv.guest_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-semibold">{conv.guest_name || 'Visitante'}</h2>
              <span className={`badge badge-${conv.status}`}>{STATUS_LABELS[conv.status] || conv.status}</span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
              {conv.guest_email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{conv.guest_email}</span>}
              {conv.guest_phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{conv.guest_phone}</span>}
              {conv.checkin_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {conv.checkin_date} → {conv.checkout_date}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {conv.properties?.name} · {conv.source} · {conv.guest_language?.toUpperCase()}
              {conv.adults && ` · ${conv.adults} adultos${conv.children ? `, ${conv.children} niños` : ''}`}
            </div>
          </div>
        </div>
      </div>

      {/* Historial de mensajes */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Historial de conversación ({messages.length} mensajes)</h3>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-mystica-blue/20 text-white border border-mystica-blue/20 rounded-br-sm'
                  : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-sm'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {format(new Date(msg.created_at), 'HH:mm', { locale: es })}
                  {msg.model_used && <span className="ml-2 opacity-50">{msg.tokens_used}tok</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
