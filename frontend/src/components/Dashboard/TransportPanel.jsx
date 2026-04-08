import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CT_BASE = 'https://visit-sanbernardoislands.com';

const ORIGINS = [
  { id: 'Cartagena',     name: 'Cartagena',     icon: '🏙️' },
  { id: 'Rincón del Mar',name: 'Rincón del Mar',icon: '🏖️' },
];

export default function TransportPanel() {
  const [routes, setRoutes]     = useState([]);
  const [hotels, setHotels]     = useState([]);
  const [options, setOptions]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [reserving, setReserving] = useState(null);
  const [form, setForm] = useState({
    origin: 'Cartagena',
    destination: 'Isla Palma',
    date: new Date().toISOString().split('T')[0],
    passengers: 2,
  });

  const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');

  useEffect(() => { loadInitial(); }, []);

  async function loadInitial() {
    try {
      const [routesR, hotelsR] = await Promise.all([
        fetch(`${API_BASE}/api/transport/routes`),
        fetch(`${API_BASE}/api/transport/hotels`),
      ]);
      if (routesR.ok) {
        const d = await routesR.json();
        setRoutes(d.routes || []);
      }
      if (hotelsR.ok) {
        const d = await hotelsR.json();
        setHotels(d.hotels || []);
      }
    } catch (e) { console.error(e); }
  }

  async function searchOptions() {
    setLoading(true);
    setOptions(null);
    try {
      const params = new URLSearchParams({
        origin: form.origin,
        destination: form.destination,
        date: form.date,
        passengers: String(form.passengers),
      });
      const r = await fetch(`${API_BASE}/api/transport/options?${params}`);
      if (r.ok) setOptions(await r.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function reserveTransport(opt) {
    setReserving(opt.routeId);
    try {
      await fetch(`${API_BASE}/api/transport/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          routeId: opt.routeId,
          date: form.date,
          passengers: form.passengers,
          guestName: 'Por confirmar — desde Revio Dashboard',
          notes: `Reserva creada desde Revio para ${form.passengers} pasajero(s)`,
        }),
      });
      alert('✅ Solicitud de transporte enviada a Caribbean Treasures');
    } catch (e) {
      alert('❌ Error: ' + e.message);
    }
    setReserving(null);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start gap-3">
        <span className="text-3xl">🚤</span>
        <div>
          <h2 className="text-xl font-semibold">Transporte marítimo</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Integración live con Caribbean Treasures · {routes.length} rutas activas · {hotels.length} hoteles aliados
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Origen</label>
            <select
              value={form.origin}
              onChange={e => setForm(p => ({ ...p, origin: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            >
              {ORIGINS.map(o => (
                <option key={o.id} value={o.id}>{o.icon} {o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Destino</label>
            <input
              type="text"
              value={form.destination}
              onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Fecha</label>
            <input
              type="date"
              value={form.date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Pasajeros</label>
            <input
              type="number" min="1" max="20"
              value={form.passengers}
              onChange={e => setForm(p => ({ ...p, passengers: parseInt(e.target.value) || 1 }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={searchOptions}
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm font-medium transition-colors"
        >
          {loading ? '🔍 Buscando...' : '🔍 Buscar disponibilidad'}
        </button>
      </div>

      {/* Resultados de búsqueda */}
      {options && (
        <div className="space-y-3 mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {options.options?.direct?.length > 0 ? 'Opciones disponibles' : 'Sin disponibilidad directa'}
          </h3>

          {options.options?.direct?.length > 0 ? (
            options.options.direct.map((opt, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium">{opt.routeName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{opt.routeCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-400">${opt.price.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">COP / persona</div>
                  </div>
                </div>
                {opt.schedules?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {opt.schedules.map((s, j) => (
                      <span key={j} className="text-xs px-2 py-1 bg-gray-800 rounded-full text-gray-300">
                        🕐 {s.departureTime?.slice(0, 5)} → {s.arrivalTime?.slice(0, 5)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => reserveTransport(opt)}
                    disabled={reserving === opt.routeId}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-xs font-medium"
                  >
                    {reserving === opt.routeId ? '⏳ Reservando...' : '✅ Reservar transporte'}
                  </button>
                  <a
                    href={CT_BASE}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs"
                  >
                    Ver en web ↗
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
              <p className="text-sm text-yellow-300">⚠️ {options.options?.message}</p>
              <a
                href={CT_BASE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-3 text-xs px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white"
              >
                Ver horarios en Caribbean Treasures →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Rutas activas */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Rutas activas ({routes.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {routes.map(r => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{r.origin} → {r.destination}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.code} · 🕐 {r.departureTime}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-blue-400">${r.price.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">{r.capacity} cupos</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hoteles aliados */}
      {hotels.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Hoteles aliados ({hotels.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {hotels.map(h => (
              <span
                key={h.id}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  h.name?.toLowerCase().includes('mistica') || h.name?.toLowerCase().includes('mística')
                    ? 'bg-blue-900/40 border-blue-700 text-blue-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {h.name?.toLowerCase().includes('mistica') || h.name?.toLowerCase().includes('mística') ? '⭐ ' : ''}
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Caribbean Treasures</div>
          <div className="text-xs text-gray-400">Aliado oficial de transporte marítimo</div>
        </div>
        <a
          href={CT_BASE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          visit-sanbernardoislands.com →
        </a>
      </div>
    </div>
  );
}
