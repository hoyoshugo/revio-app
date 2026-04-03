import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL y SUPABASE_ANON_KEY son requeridas');
}

// Usar service key solo si es un JWT válido (empieza con eyJ)
// Si es una clave publishable (sb_publishable_...) usar anon key como fallback
const activeKey = supabaseServiceKey?.startsWith('eyJ') ? supabaseServiceKey : supabaseAnonKey;

// Cliente backend
export const supabase = createClient(supabaseUrl, activeKey, {
  auth: { persistSession: false }
});

// Cliente público (para operaciones del widget)
export const supabasePublic = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// HELPERS: Conversations
// ============================================================
export const db = {
  async getProperty(slug) {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    if (error) throw error;
    return data;
  },

  async getAllProperties() {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;
    return data;
  },

  async getOrCreateConversation(sessionId, propertyId) {
    // Buscar existente
    let { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (!data) {
      const { data: created, error } = await supabase
        .from('conversations')
        .insert({ session_id: sessionId, property_id: propertyId })
        .select()
        .single();
      if (error) throw error;
      data = created;
    }
    return data;
  },

  async updateConversation(id, updates) {
    const { data, error } = await supabase
      .from('conversations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async saveMessage(conversationId, role, content, meta = {}) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        tokens_used: meta.tokens_used,
        model_used: meta.model_used,
        response_time_ms: meta.response_time_ms,
        tools_called: meta.tools_called || []
      })
      .select()
      .single();
    if (error) throw error;

    // Actualizar contador de mensajes y timestamp
    await supabase
      .from('conversations')
      .update({
        total_messages: supabase.rpc('increment', { x: 1 }),
        last_message_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    return data;
  },

  async getConversationMessages(conversationId, limit = 50) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // ============================================================
  // BOOKINGS
  // ============================================================
  async createBooking(bookingData) {
    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBooking(id, updates) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getBooking(id) {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, properties(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getBookingsByProperty(propertyId, filters = {}) {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.checkin_date) query = query.eq('checkin_date', filters.checkin_date);
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // ============================================================
  // PAYMENTS
  // ============================================================
  async createPayment(paymentData) {
    const { data, error } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePayment(reference, updates) {
    const { data, error } = await supabase
      .from('payments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('wompi_reference', reference)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // COMMUNICATIONS
  // ============================================================
  async scheduleCommunication(commData) {
    const { data, error } = await supabase
      .from('communications')
      .insert(commData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPendingCommunications() {
    const { data, error } = await supabase
      .from('communications')
      .select('*, bookings(*), properties(*)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });
    if (error) throw error;
    return data;
  },

  async markCommunicationSent(id, result) {
    const { data, error } = await supabase
      .from('communications')
      .update({
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        provider_message_id: result.message_id,
        provider_response: result.response,
        error_message: result.error
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ============================================================
  // API LOGS
  // ============================================================
  async logApiCall(logData) {
    const { error } = await supabase.from('api_logs').insert(logData);
    if (error) console.error('Error guardando API log:', error.message);
  },

  // ============================================================
  // DASHBOARD
  // ============================================================
  async getDashboardMetrics(propertyId = null) {
    let query = supabase.from('v_dashboard_metrics').select('*');
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getConversationsList(propertyId, filters = {}) {
    let query = supabase
      .from('conversations')
      .select(`
        id, session_id, guest_name, guest_email, guest_phone,
        guest_language, status, property_interest,
        checkin_date, checkout_date, adults, children,
        total_messages, last_message_at, source, created_at,
        properties(name, slug)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (propertyId) query = query.eq('property_id', propertyId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.limit) query = query.limit(filters.limit || 50);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getWeeklyReport(propertyId) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [bookings, conversations, communications] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .eq('property_id', propertyId)
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('conversations')
        .select('id, status, guest_language, source, created_at')
        .eq('property_id', propertyId)
        .gte('created_at', sevenDaysAgo.toISOString()),
      supabase
        .from('communications')
        .select('id, type, status, sequence_step, created_at')
        .eq('property_id', propertyId)
        .gte('created_at', sevenDaysAgo.toISOString())
    ]);

    return {
      bookings: bookings.data || [],
      conversations: conversations.data || [],
      communications: communications.data || []
    };
  }
};

export default db;
