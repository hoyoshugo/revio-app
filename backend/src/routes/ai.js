import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── POST /api/ai/chat — Concierge con streaming SSE ──
router.post('/chat', requireAuth, async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message requerido' });
  const pid = req.user.property_id;

  try {
    // Cargar contexto de la propiedad
    const [{ data: prop }, { data: metrics }] = await Promise.all([
      supabase.from('properties').select('name,location').eq('id', pid).single(),
      supabase.rpc('get_dashboard_metrics', { p_property_id: pid }).maybeSingle().catch(() => ({ data: null }))
    ]);

    const today = new Date().toISOString().split('T')[0];
    const { data: todayRes } = await supabase.from('reservations')
      .select('id,status').eq('property_id', pid)
      .or(`check_in.eq.${today},check_out.eq.${today}`);

    const arrivals = (todayRes || []).filter(r => r.check_in === today).length;
    const departures = (todayRes || []).filter(r => r.check_out === today).length;

    const systemPrompt = `You are Revio Assistant, an expert hotel management AI for ${prop?.name || 'the property'}.
You have access to live operational data:
- Today: ${today}
- Arrivals today: ${arrivals} guests
- Departures today: ${departures} guests
- Location: ${prop?.location || 'Colombia'}

Answer staff questions about operations, guests, pricing, and best practices.
Be concise, professional, and helpful. Respond in the same language the user writes in.`;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const messages = [
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); }
  }
});

// ── POST /api/ai/pricing — Precios inteligentes ──
router.post('/pricing', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { room_type_id, date_from, date_to } = req.body;
  try {
    const [{ data: prop }, { data: roomType }, { data: events }, { data: history }] = await Promise.all([
      supabase.from('properties').select('name,location').eq('id', pid).single(),
      room_type_id ? supabase.from('room_types').select('*').eq('id', room_type_id).single() : { data: null },
      supabase.from('events').select('*').eq('property_id', pid)
        .gte('end_date', date_from || new Date().toISOString().split('T')[0])
        .order('start_date').limit(10),
      supabase.from('reservations').select('check_in,check_out,rate_per_night')
        .eq('property_id', pid).neq('status', 'cancelled')
        .gte('check_in', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0])
        .limit(100)
    ]);

    const prompt = `You are a revenue management expert for ${prop?.name || 'a Colombian hostel'}.

Context:
- Room type: ${roomType?.name || 'All rooms'}, base price: $${roomType?.base_price || 'varies'} COP
- Period to price: ${date_from || 'next 30 days'} to ${date_to || ''}
- Upcoming events: ${JSON.stringify(events?.slice(0, 5) || [])}
- Recent booking history (last 90 days): ${history?.length || 0} reservations
- Average recent rate: ${history?.length ? Math.round(history.reduce((s, r) => s + (r.rate_per_night || 0), 0) / history.length) : 'unknown'} COP

Provide smart pricing recommendations as JSON with this structure:
{
  "recommendations": [
    {
      "date_range": "YYYY-MM-DD to YYYY-MM-DD",
      "suggested_price": 120000,
      "change_percent": "+15%",
      "reason": "Holiday weekend with high demand"
    }
  ],
  "strategy": "Brief overall pricing strategy",
  "insights": ["Key insight 1", "Key insight 2"]
}

Base prices on Colombian peso (COP) market rates for hostels/boutique hotels.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    let parsed;
    try {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    } catch {
      parsed = { raw: response.content[0].text };
    }
    res.json({ pricing: parsed, tokens_used: response.usage?.output_tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/forecast — Pronóstico de ocupación ──
router.post('/forecast', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  try {
    const { data: prop } = await supabase.from('properties').select('name').eq('id', pid).single();
    const { data: history } = await supabase.from('reservations')
      .select('check_in,check_out,status').eq('property_id', pid)
      .neq('status', 'cancelled')
      .gte('check_in', new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0])
      .order('check_in');
    const { data: rooms } = await supabase.from('rooms').select('id').eq('property_id', pid).eq('is_active', true);
    const { data: events } = await supabase.from('events').select('*').eq('property_id', pid)
      .gte('start_date', new Date().toISOString().split('T')[0]).limit(10);

    const totalRooms = rooms?.length || 10;
    const prompt = `You are a hospitality forecasting expert for ${prop?.name || 'a Colombian hostel'}.

Data:
- Total rooms: ${totalRooms}
- Reservations last 90 days: ${history?.length || 0}
- Upcoming events: ${JSON.stringify(events?.slice(0, 5) || [])}
- Historical data sample: ${JSON.stringify(history?.slice(-20) || [])}

Generate a 30-day occupancy forecast. Return JSON:
{
  "forecast": [
    { "week": "Apr 7-13", "occupancy_percent": 72, "trend": "up", "drivers": ["Semana Santa"] }
  ],
  "summary": "Brief narrative of the forecast",
  "recommendations": ["Action 1", "Action 2"],
  "avg_occupancy_30d": 68
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    let parsed;
    try {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    } catch { parsed = { raw: response.content[0].text }; }
    res.json({ forecast: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/review-response — Respuesta a reseñas ──
router.post('/review-response', requireAuth, async (req, res) => {
  const { review_text, platform, rating, guest_name } = req.body;
  if (!review_text) return res.status(400).json({ error: 'review_text requerido' });
  const pid = req.user.property_id;
  try {
    const { data: prop } = await supabase.from('properties').select('name,brand_name').eq('id', pid).single();
    const propertyName = prop?.brand_name || prop?.name || 'nuestra propiedad';
    const prompt = `You are a hospitality manager for ${propertyName}.
A guest named ${guest_name || 'a guest'} left a ${rating || '?'}-star review on ${platform || 'a platform'}:

"${review_text}"

Write a professional, warm, and personalized response. Rules:
1. Respond in the SAME LANGUAGE as the review
2. Thank the guest sincerely
3. Address specific points they mentioned (positive and negative)
4. If negative feedback, acknowledge it professionally and mention improvement steps
5. Invite them to return
6. Keep it under 150 words
7. Sign as "The ${propertyName} Team"

Return ONLY the response text, no extra explanation.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ response_draft: response.content[0].text, tokens_used: response.usage?.output_tokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/guest-insights — Perfil e insights del huésped ──
router.post('/guest-insights', requireAuth, async (req, res) => {
  const { guest_id } = req.body;
  if (!guest_id) return res.status(400).json({ error: 'guest_id requerido' });
  try {
    const { data: guest } = await supabase.from('guests').select('*').eq('id', guest_id).single();
    const { data: reservations } = await supabase.from('reservations')
      .select('check_in,check_out,rate_per_night,total_amount,status,source')
      .eq('guest_id', guest_id).order('check_in');
    const { data: wallets } = await supabase.from('wristband_wallets')
      .select('balance,wallet_transactions(type,amount,description)').eq('guest_id', guest_id);

    const totalSpent = (reservations || []).reduce((s, r) => s + (r.total_amount || 0), 0);
    const avgNights = reservations?.length
      ? (reservations.reduce((s, r) => {
          const nights = Math.ceil((new Date(r.check_out) - new Date(r.check_in)) / 86400000);
          return s + nights;
        }, 0) / reservations.length)
      : 0;

    const prompt = `Analyze this guest and provide hospitality insights:

Guest: ${guest?.first_name} ${guest?.last_name}
Nationality: ${guest?.nationality || 'Unknown'} | Language: ${guest?.language || 'es'}
Total stays: ${reservations?.length || 0} | Total spent: $${totalSpent.toLocaleString()} COP
Average stay: ${avgNights.toFixed(1)} nights
Booking sources: ${[...new Set(reservations?.map(r => r.source) || [])].join(', ')}
Tags: ${guest?.tags?.join(', ') || 'none'}

Return JSON with:
{
  "personality_profile": "1-2 sentence description",
  "spending_pattern": "budget|mid-range|premium|luxury",
  "preferred_stay_length": "short|medium|extended",
  "upsell_opportunities": ["Opportunity 1", "Opportunity 2"],
  "communication_tips": ["Tip 1"],
  "vip_score": 75,
  "insights": ["Key insight 1", "Key insight 2"]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });
    let parsed;
    try {
      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
    } catch { parsed = { raw: response.content[0].text }; }
    res.json({ insights: parsed, guest_summary: { total_stays: reservations?.length || 0, total_spent: totalSpent } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
