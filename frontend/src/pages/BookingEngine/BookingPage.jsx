import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar, Users, BedDouble, ChevronRight, ChevronLeft,
  Check, Star, MapPin, Phone, Loader2, ArrowRight
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function fmt(n) { return `$ ${Number(n || 0).toLocaleString('es-CO')}`; }

const STEPS = ['Fechas', 'Habitación', 'Datos', 'Confirmar'];

export default function BookingPage() {
  const { slug } = useParams();
  const [step, setStep] = useState(0);
  const [property, setProperty] = useState(null);
  const [roomTypes, setRoomTypes] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(2);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [guest, setGuest] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    document_type: 'CC', document_number: '', nationality: 'Colombia', special_requests: ''
  });

  useEffect(() => {
    fetch(`${API}/api/public/book/${slug}`)
      .then(r => r.json())
      .then(d => { setProperty(d.property); setRoomTypes(d.room_types || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Set min check-in to today
  const today = new Date().toISOString().split('T')[0];
  const minCheckOut = checkIn
    ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0]
    : today;

  async function searchAvailability() {
    if (!checkIn || !checkOut) return;
    setSearching(true);
    const res = await fetch(`${API}/api/public/book/${slug}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut, adults })
    });
    const data = await res.json();
    setAvailability(data.available || []);
    setSearching(false);
    setStep(1);
  }

  async function confirmBooking() {
    if (!selectedRoom || !guest.first_name || !guest.email) return;
    setBooking(true);
    try {
      const res = await fetch(`${API}/api/public/book/${slug}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: selectedRoom.room_id,
          check_in: checkIn, check_out: checkOut,
          adults, children: 0,
          rate_per_night: selectedRoom.price_per_night,
          total_amount: selectedRoom.total,
          ...guest
        })
      });
      const data = await res.json();
      if (res.ok) setConfirmed(data);
      else alert(data.error || 'Error al confirmar');
    } catch (err) {
      alert('Error de conexión');
    } finally {
      setBooking(false);
    }
  }

  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0F18' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366F1' }} />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D0F18' }}>
        <div className="text-center" style={{ color: '#94A3B8' }}>
          <BedDouble className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Propiedad no encontrada</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #0D0F18 0%, #161927 100%)' }}>
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #059669, #10B981)' }}>
            <Check className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">¡Reserva Confirmada!</h1>
            <p style={{ color: '#94A3B8' }}>{confirmed.message}</p>
          </div>
          <div className="rounded-2xl p-6 text-left space-y-3"
            style={{ background: '#161927', border: '1px solid #1E2436' }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#94A3B8' }}>Confirmación</span>
              <span className="font-mono font-bold" style={{ color: '#6366F1' }}>{confirmed.confirmation_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#94A3B8' }}>Check-in</span>
              <span style={{ color: '#F1F5F9' }}>{checkIn}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#94A3B8' }}>Check-out</span>
              <span style={{ color: '#F1F5F9' }}>{checkOut}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: '#94A3B8' }}>Huésped</span>
              <span style={{ color: '#F1F5F9' }}>{guest.first_name} {guest.last_name}</span>
            </div>
          </div>
          {confirmed.payment_link && (
            <a href={confirmed.payment_link} target="_blank" rel="noopener noreferrer"
              className="block w-full py-4 rounded-2xl text-white font-semibold text-center"
              style={{ background: 'linear-gradient(135deg, #4338CA, #6366F1)' }}>
              Completar pago →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0D0F18 0%, #161927 100%)' }}>
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 py-4"
        style={{ background: 'rgba(13,15,24,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1E2436' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-lg">{property.brand_name || property.name}</div>
            {property.location && (
              <div className="flex items-center gap-1 text-xs" style={{ color: '#94A3B8' }}>
                <MapPin className="w-3 h-3" />{property.location}
              </div>
            )}
          </div>
          <div className="text-xs" style={{ color: '#475569' }}>Reserva directa</div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all`}
                  style={{
                    background: i < step ? '#10B981' : i === step ? '#6366F1' : '#1E2436',
                    color: i <= step ? 'white' : '#475569'
                  }}>
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-xs hidden sm:block"
                  style={{ color: i === step ? '#F1F5F9' : '#475569' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 rounded-full"
                  style={{ background: i < step ? '#10B981' : '#1E2436' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: Dates */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">¿Cuándo quieres venir?</h2>
            <div className="rounded-2xl p-6 space-y-5" style={{ background: '#161927', border: '1px solid #1E2436' }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Check-in</label>
                  <input type="date" min={today} value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm"
                    style={{ background: '#0D0F18', border: '1.5px solid #1E2436', outline: 'none',
                      borderColor: checkIn ? '#6366F1' : '#1E2436' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Check-out</label>
                  <input type="date" min={minCheckOut} value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm"
                    style={{ background: '#0D0F18', border: '1.5px solid #1E2436', outline: 'none',
                      borderColor: checkOut ? '#6366F1' : '#1E2436' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Huéspedes</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setAdults(a => Math.max(1, a - 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                    style={{ background: '#1E2436', color: '#94A3B8' }}>−</button>
                  <span className="text-xl font-bold text-white w-8 text-center">{adults}</span>
                  <button onClick={() => setAdults(a => Math.min(12, a + 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                    style={{ background: '#1E2436', color: '#94A3B8' }}>+</button>
                  <span className="text-sm" style={{ color: '#475569' }}>adultos</span>
                </div>
              </div>
              {nights > 0 && (
                <div className="text-sm" style={{ color: '#94A3B8' }}>
                  {nights} noche{nights !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <button
              onClick={searchAvailability}
              disabled={!checkIn || !checkOut || searching}
              className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: checkIn && checkOut ? 'linear-gradient(135deg, #4338CA, #6366F1)' : '#1E2436',
                color: checkIn && checkOut ? 'white' : '#475569' }}>
              {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
              {searching ? 'Buscando...' : 'Ver disponibilidad'}
            </button>
          </div>
        )}

        {/* Step 1: Room selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(0)} className="rv-btn-ghost p-2">
                <ChevronLeft className="w-4 h-4" style={{ color: '#94A3B8' }} />
              </button>
              <h2 className="text-xl font-bold text-white">Elige tu habitación</h2>
            </div>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              {checkIn} → {checkOut} · {nights} noche{nights !== 1 ? 's' : ''} · {adults} adulto{adults !== 1 ? 's' : ''}
            </p>
            {availability.length === 0 ? (
              <div className="rounded-2xl p-8 text-center space-y-4" style={{ background: '#161927', border: '1px solid #1E2436' }}>
                <BedDouble className="w-12 h-12 mx-auto" style={{ color: '#475569' }} />
                <p style={{ color: '#94A3B8' }}>No hay habitaciones disponibles para esas fechas</p>
                <button onClick={() => setStep(0)} className="text-sm" style={{ color: '#6366F1' }}>Cambiar fechas</button>
              </div>
            ) : (
              <div className="space-y-3">
                {availability.map(room => (
                  <div key={room.room_id}
                    onClick={() => { setSelectedRoom(room); setStep(2); }}
                    className="rounded-2xl p-5 cursor-pointer transition-all"
                    style={{
                      background: '#161927', border: '1.5px solid #1E2436',
                      borderColor: selectedRoom?.room_id === room.room_id ? '#6366F1' : '#1E2436'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#6366F1'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = selectedRoom?.room_id === room.room_id ? '#6366F1' : '#1E2436'}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{room.room_type?.name || room.room_name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: '#94A3B8' }}>
                          <span><Users className="inline w-3.5 h-3.5 mr-1" />Hasta {room.room_type?.capacity || 2} personas</span>
                          <span><BedDouble className="inline w-3.5 h-3.5 mr-1" />Hab. {room.room_number}</span>
                        </div>
                        {room.room_type?.amenities?.length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-2">
                            {room.room_type.amenities.slice(0, 4).map((a, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: '#1E2436', color: '#94A3B8' }}>{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold" style={{ color: '#818CF8' }}>
                          {fmt(room.price_per_night)}
                        </div>
                        <div className="text-xs" style={{ color: '#475569' }}>por noche</div>
                        <div className="text-sm font-semibold mt-1" style={{ color: '#F1F5F9' }}>
                          Total: {fmt(room.total)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-3 text-sm" style={{ color: '#6366F1' }}>
                      Seleccionar <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Guest details */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(1)} className="rv-btn-ghost p-2">
                <ChevronLeft className="w-4 h-4" style={{ color: '#94A3B8' }} />
              </button>
              <h2 className="text-xl font-bold text-white">Tus datos</h2>
            </div>
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#161927', border: '1px solid #1E2436' }}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'first_name', label: 'Nombre *', type: 'text' },
                  { key: 'last_name',  label: 'Apellido', type: 'text' },
                  { key: 'email',  label: 'Email *', type: 'email' },
                  { key: 'phone',  label: 'Teléfono', type: 'tel' },
                  { key: 'document_number', label: 'Nro. Documento', type: 'text' },
                  { key: 'nationality', label: 'Nacionalidad', type: 'text' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: '#94A3B8' }}>{label}</label>
                    <input type={type} value={guest[key]}
                      onChange={e => setGuest(g => ({ ...g, [key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-white text-sm"
                      style={{ background: '#0D0F18', border: '1.5px solid #1E2436', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#94A3B8' }}>Solicitudes especiales</label>
                <textarea value={guest.special_requests}
                  onChange={e => setGuest(g => ({ ...g, special_requests: e.target.value }))}
                  rows={2} placeholder="Llegada tardía, cama extra, preferencias..."
                  className="w-full px-3 py-2.5 rounded-xl text-white text-sm resize-none"
                  style={{ background: '#0D0F18', border: '1.5px solid #1E2436', outline: 'none' }} />
              </div>
            </div>
            <button onClick={() => guest.first_name && guest.email && setStep(3)}
              disabled={!guest.first_name || !guest.email}
              className="w-full py-4 rounded-2xl font-semibold text-white"
              style={{ background: guest.first_name && guest.email ? 'linear-gradient(135deg, #4338CA, #6366F1)' : '#1E2436',
                color: guest.first_name && guest.email ? 'white' : '#475569' }}>
              Continuar
            </button>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep(2)} className="rv-btn-ghost p-2">
                <ChevronLeft className="w-4 h-4" style={{ color: '#94A3B8' }} />
              </button>
              <h2 className="text-xl font-bold text-white">Confirmar reserva</h2>
            </div>
            <div className="rounded-2xl p-5 space-y-3" style={{ background: '#161927', border: '1px solid #1E2436' }}>
              <h3 className="font-semibold text-white text-sm mb-3">Resumen</h3>
              {[
                { label: 'Propiedad', value: property.brand_name || property.name },
                { label: 'Habitación', value: selectedRoom?.room_type?.name || selectedRoom?.room_name },
                { label: 'Check-in', value: checkIn },
                { label: 'Check-out', value: checkOut },
                { label: 'Noches', value: nights },
                { label: 'Huéspedes', value: `${adults} adultos` },
                { label: 'Huésped', value: `${guest.first_name} ${guest.last_name}` },
                { label: 'Email', value: guest.email },
              ].map(r => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span style={{ color: '#94A3B8' }}>{r.label}</span>
                  <span style={{ color: '#F1F5F9' }}>{r.value}</span>
                </div>
              ))}
              <div className="pt-3 mt-3 border-t" style={{ borderColor: '#1E2436' }}>
                <div className="flex justify-between text-base font-bold">
                  <span style={{ color: '#94A3B8' }}>Total</span>
                  <span style={{ color: '#818CF8' }}>{fmt(selectedRoom?.total)}</span>
                </div>
              </div>
            </div>
            <button onClick={confirmBooking} disabled={booking}
              className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #4338CA, #6366F1)' }}>
              {booking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {booking ? 'Confirmando...' : 'Confirmar reserva'}
            </button>
            <p className="text-xs text-center" style={{ color: '#475569' }}>
              Al confirmar aceptas los términos y condiciones. Sin cargos hasta el check-in.
            </p>
          </div>
        )}
      </div>

      <div className="h-12" />

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 pb-6 text-center">
        <p className="text-xs" style={{ color: '#1E2436' }}>
          Powered by <span style={{ color: '#6366F1' }}>Revio</span> · revio.co
        </p>
      </footer>
    </div>
  );
}
