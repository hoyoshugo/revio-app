/**
 * Integración con Caribbean Treasures (visit-sanbernardoislands.com)
 * Sistema de transporte marítimo para el Archipiélago de San Bernardo.
 *
 * Schema real verificado de la API:
 * - GET /api/rutas       → { rutas: [{id, route_code, origen, destino, precio, capacidad_max, hora_salida, activa}] }
 * - GET /api/horarios    → { horarios: [{id, route_code, hora_salida, hora_llegada, dias_semana, activo}] }
 * - GET /api/hoteles     → { hoteles: [{id, nombre, activo}] }
 * - GET /api/temporadas  → { temporadas: [...] }
 * - POST /api/reservaciones → crear reserva
 */

const CT_BASE_URL = process.env.CARIBBEAN_TREASURES_API_URL || 'https://visit-sanbernardoislands.com/api';
const CT_API_KEY = process.env.CARIBBEAN_TREASURES_API_KEY;

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (CT_API_KEY) h.Authorization = `Bearer ${CT_API_KEY}`;
  return h;
}

// ─── RUTAS ─────────────────────────────────────────
export async function getRoutes() {
  try {
    const r = await fetch(`${CT_BASE_URL}/rutas`, { headers: headers() });
    if (!r.ok) return { success: false, routes: [], error: `HTTP ${r.status}` };
    const data = await r.json();
    const rutas = data.rutas || data.routes || [];
    return {
      success: true,
      routes: rutas.filter(r => r.activa !== false).map(r => ({
        id: r.id,
        code: r.route_code,
        origin: r.origen,
        destination: r.destino,
        departureTime: r.hora_salida,
        price: Number(r.precio) || 0,
        capacity: r.capacidad_max || 0,
        comissionPct: r.comision_pct || 0,
        agentComissionPct: r.comision_agente_pct || 0,
      })),
    };
  } catch (e) {
    return { success: false, routes: [], error: e.message };
  }
}

// ─── HORARIOS ──────────────────────────────────────
export async function getSchedules(routeCode = null) {
  try {
    const r = await fetch(`${CT_BASE_URL}/horarios`, { headers: headers() });
    if (!r.ok) return { success: false, schedules: [] };
    const data = await r.json();
    let horarios = (data.horarios || []).filter(h => h.activo !== false);
    if (routeCode) horarios = horarios.filter(h => h.route_code === routeCode);
    return {
      success: true,
      schedules: horarios.map(h => ({
        id: h.id,
        routeCode: h.route_code,
        departureTime: h.hora_salida,
        arrivalTime: h.hora_llegada,
        days: (h.dias_semana || '').split(',').map(d => d.trim()).filter(Boolean),
      })),
    };
  } catch (e) {
    return { success: false, schedules: [], error: e.message };
  }
}

// ─── DISPONIBILIDAD ────────────────────────────────
export async function checkAvailability(routeId, date, passengers = 1) {
  try {
    const params = new URLSearchParams({ ruta_id: routeId, fecha: date, pasajeros: String(passengers) });
    const r = await fetch(`${CT_BASE_URL}/capacidad?${params}`, { headers: headers() });
    if (!r.ok) return { available: null, spots: null, fallback: true };
    const data = await r.json();
    const spots = data.cupos_disponibles ?? data.cupos ?? data.spots ?? null;
    return {
      available: spots !== null ? spots >= passengers : null,
      spots,
      data,
    };
  } catch (e) {
    return { available: null, spots: null, error: e.message };
  }
}

// ─── HOTELES ALIADOS ───────────────────────────────
export async function getPartnerHotels() {
  try {
    const r = await fetch(`${CT_BASE_URL}/hoteles`, { headers: headers() });
    if (!r.ok) return { success: false, hotels: [] };
    const data = await r.json();
    return {
      success: true,
      hotels: (data.hoteles || []).filter(h => h.activo !== false).map(h => ({
        id: h.id,
        name: h.nombre,
        order: h.orden || 0,
      })),
    };
  } catch (e) {
    return { success: false, hotels: [], error: e.message };
  }
}

// ─── CREAR RESERVA DE TRANSPORTE ───────────────────
export async function createTransportReservation(payload) {
  try {
    const {
      routeId, date, time, passengers,
      guestName, guestEmail, guestPhone,
      hotelId, notes,
      revioReservationId,
    } = payload;

    const body = {
      ruta_id: routeId,
      fecha: date,
      hora: time,
      pasajeros: passengers,
      nombre_cliente: guestName,
      email_cliente: guestEmail,
      telefono_cliente: guestPhone,
      hotel_destino_id: hotelId,
      notas: notes,
      referencia_externa: revioReservationId ? `REVIO-${revioReservationId}` : undefined,
    };

    const r = await fetch(`${CT_BASE_URL}/reservaciones`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    let data;
    try { data = await r.json(); } catch { data = { raw: await r.text() }; }
    return { success: r.ok, status: r.status, reservation: data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ─── BÚSQUEDA INTELIGENTE PARA EL AGENTE ───────────
/**
 * Busca opciones de transporte desde un origen hacia un destino.
 * Hace match flexible (incluye sinónimos como "isla palma" → "Islas de San Bernardo").
 */
export async function getTransportOptions(origin, destination, date, passengers = 1) {
  const { routes } = await getRoutes();
  const { schedules } = await getSchedules();

  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const oN = norm(origin);
  const dN = norm(destination);

  // Sinónimos comunes
  const aliasOrigen = { 'isla palma': 'islas de san bernardo', 'islas': 'islas de san bernardo' };
  const aliasDestino = aliasOrigen;
  const oResolved = aliasOrigen[oN] || oN;
  const dResolved = aliasDestino[dN] || dN;

  const matching = routes.filter(r => {
    const origenN = norm(r.origin);
    const destinoN = norm(r.destination);
    return (origenN.includes(oResolved) || oResolved.includes(origenN)) &&
           (destinoN.includes(dResolved) || dResolved.includes(destinoN));
  });

  if (!matching.length) {
    return {
      direct: [],
      message: `No encontré rutas directas desde ${origin} hacia ${destination}. ` +
               'Consulta horarios actualizados en visit-sanbernardoislands.com',
    };
  }

  const direct = matching.map(route => {
    const routeSchedules = schedules.filter(s => s.routeCode === route.code);
    return {
      routeId: route.id,
      routeCode: route.code,
      routeName: `${route.origin} → ${route.destination}`,
      origin: route.origin,
      destination: route.destination,
      price: route.price,
      capacity: route.capacity,
      schedules: routeSchedules,
      provider: 'Caribbean Treasures',
      bookingUrl: 'https://visit-sanbernardoislands.com',
    };
  });

  return { direct };
}

/**
 * Formatea las opciones de transporte como mensaje legible para el agente IA.
 */
export function formatTransportForAgent(options, origin, date) {
  if (!options.direct?.length) {
    return `Para el transporte desde ${origin}, te recomiendo nuestro aliado Caribbean Treasures:\n` +
           `🚤 visit-sanbernardoislands.com\n` +
           `También puedo coordinar la reserva por ti.`;
  }

  let msg = `🚤 *Opciones de transporte para el ${date || 'día solicitado'}:*\n\n`;

  options.direct.forEach((opt, i) => {
    msg += `*${i + 1}. ${opt.routeName}*\n`;
    msg += `   💰 $${opt.price.toLocaleString()} COP por persona\n`;
    if (opt.schedules?.length) {
      const times = opt.schedules.map(s => s.departureTime?.slice(0, 5)).filter(Boolean);
      if (times.length) msg += `   🕐 Salidas: ${times.join(', ')}\n`;
    }
    if (opt.capacity) msg += `   👥 Capacidad: ${opt.capacity} pasajeros\n`;
    msg += '\n';
  });

  msg += '¿Te ayudo a reservar el transporte junto con tu hospedaje? ✨';
  return msg;
}
