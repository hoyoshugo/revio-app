import { Router } from 'express';
import { supabase } from '../models/supabase.js';

const router = Router();

// ── GET /api/public/book/:slug — Info de propiedad para booking engine ──
router.get('/:slug', async (req, res) => {
  try {
    const { data: prop, error } = await supabase.from('properties')
      .select('id,name,brand_name,brand_logo_url,brand_primary_color,location,maps_url,languages,whatsapp_number')
      .eq('slug', req.params.slug).eq('is_active', true).single();
    if (error || !prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const { data: roomTypes } = await supabase.from('room_types')
      .select('id,name,slug,description,capacity,beds,base_price,amenities,photos')
      .eq('property_id', prop.id).eq('is_active', true).order('sort_order');

    res.json({ property: prop, room_types: roomTypes || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/public/book/:slug/availability — Verificar disponibilidad ──
router.post('/:slug/availability', async (req, res) => {
  const { check_in, check_out, adults = 1 } = req.body;
  if (!check_in || !check_out) return res.status(400).json({ error: 'check_in y check_out requeridos' });
  try {
    const { data: prop } = await supabase.from('properties').select('id').eq('slug', req.params.slug).single();
    if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Obtener habitaciones disponibles
    const { data: rooms } = await supabase.from('rooms')
      .select('id,number,name,capacity,room_type_id,room_types(id,name,base_price,amenities,photos)')
      .eq('property_id', prop.id).eq('is_active', true).eq('status', 'available');

    // Habitaciones ocupadas en esas fechas
    const { data: occupied } = await supabase.from('reservations')
      .select('room_id').eq('property_id', prop.id).neq('status', 'cancelled')
      .lt('check_in', check_out).gt('check_out', check_in);

    const occupiedIds = new Set((occupied || []).map(r => r.room_id));
    const available = (rooms || []).filter(r => !occupiedIds.has(r.id) && r.capacity >= adults);

    // Precios override si hay
    const { data: overrides } = await supabase.from('price_overrides')
      .select('*').eq('property_id', prop.id).lte('date_from', check_out).gte('date_to', check_in);

    const nights = Math.ceil((new Date(check_out) - new Date(check_in)) / 86400000);
    const result = available.map(room => {
      const rt = room.room_types;
      const override = (overrides || []).find(o => o.room_type_id === rt?.id);
      const pricePerNight = override ? override.price : (rt?.base_price || 0);
      return {
        room_id: room.id, room_number: room.number, room_name: room.name,
        room_type: rt, price_per_night: pricePerNight, total: pricePerNight * nights, nights
      };
    });

    res.json({ available: result, nights, check_in, check_out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/public/book/:slug/reserve — Crear reserva (guest-facing) ──
router.post('/:slug/reserve', async (req, res) => {
  const {
    room_id, check_in, check_out, adults, children,
    guest_first_name, guest_last_name, guest_email, guest_phone,
    guest_document_type, guest_document_number, guest_nationality,
    special_requests, rate_per_night, total_amount
  } = req.body;

  if (!room_id || !check_in || !check_out || !guest_first_name || !guest_email) {
    return res.status(400).json({ error: 'Faltan campos requeridos: room_id, check_in, check_out, guest_first_name, guest_email' });
  }

  try {
    const { data: prop } = await supabase.from('properties').select('id,name').eq('slug', req.params.slug).single();
    if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Verificar disponibilidad
    const { data: conflicts } = await supabase.from('reservations')
      .select('id').eq('room_id', room_id).neq('status', 'cancelled')
      .lt('check_in', check_out).gt('check_out', check_in);
    if (conflicts && conflicts.length > 0) {
      return res.status(409).json({ error: 'Habitación no disponible para esas fechas' });
    }

    // Upsert guest
    let guestId;
    const { data: existingGuest } = await supabase.from('guests')
      .select('id').eq('property_id', prop.id).eq('email', guest_email).maybeSingle();
    if (existingGuest) {
      guestId = existingGuest.id;
    } else {
      const { data: newGuest } = await supabase.from('guests').insert({
        property_id: prop.id, first_name: guest_first_name, last_name: guest_last_name,
        email: guest_email, phone: guest_phone, nationality: guest_nationality,
        document_type: guest_document_type || 'PP', document_number: guest_document_number
      }).select().single();
      guestId = newGuest?.id;
    }

    const { data: room } = await supabase.from('rooms').select('room_type_id').eq('id', room_id).single();

    const { data: reservation, error: resErr } = await supabase.from('reservations').insert({
      property_id: prop.id, room_id, room_type_id: room?.room_type_id,
      guest_id: guestId, check_in, check_out,
      adults: adults || 1, children: children || 0,
      rate_per_night: rate_per_night || 0, total_amount: total_amount || 0,
      currency: 'COP', status: 'confirmed', source: 'booking_engine',
      special_requests, color: '#6366F1'
    }).select().single();
    if (resErr) throw resErr;

    // Mock payment link (integrate Wompi/Stripe in production)
    const paymentLink = process.env.WOMPI_PUBLIC_KEY
      ? `https://checkout.wompi.co/p/?public-key=${process.env.WOMPI_PUBLIC_KEY}&currency=COP&amount-in-cents=${Math.round(total_amount * 100)}&reference=RV-${reservation.id.slice(0, 8)}`
      : null;

    res.status(201).json({
      reservation,
      payment_link: paymentLink,
      confirmation_number: `RV-${reservation.id.slice(0, 8).toUpperCase()}`,
      message: `Reserva confirmada para ${guest_first_name}. ${paymentLink ? 'Completa el pago en el enlace.' : 'Te contactaremos para el pago.'}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
