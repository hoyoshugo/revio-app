import { Router } from 'express';
import { supabase } from '../models/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ── GET /api/invoices ─────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const pid = req.query.property_id || req.user.property_id;
  const { status, guest_id, limit = 50, page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let q = supabase.from('invoices')
      .select('*, guests(first_name,last_name,email), reservations(confirmation_number)', { count: 'exact' })
      .eq('property_id', pid)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    if (status) q = q.eq('status', status);
    if (guest_id) q = q.eq('guest_id', guest_id);
    const { data, count, error } = await q;
    if (error) throw error;
    res.json({ data: data || [], total: count || 0, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/invoices ────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const pid = req.user.property_id;
  const { reservation_id, guest_id, items = [], notes, tax_rate = 0.19 } = req.body;

  try {
    // Auto-increment invoice number using tenant config
    const { data: prop } = await supabase.from('properties').select('tenant_id,name').eq('id', pid).single();
    const tenantId = prop?.tenant_id;

    // Use property-level sequence stored in a settings key
    const { data: seqRow } = await supabase.from('settings')
      .select('value').eq('key', 'invoice_counter').eq('property_id', pid).maybeSingle();
    const counter = parseInt(seqRow?.value || '1000') + 1;
    await supabase.from('settings').upsert(
      { property_id: pid, key: 'invoice_counter', value: String(counter) },
      { onConflict: 'property_id,key' }
    );
    const invoiceNumber = `FAC-${String(counter).padStart(5, '0')}`;

    const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity || 1) * parseFloat(i.unit_price || 0)), 0);
    const taxAmount = Math.round(subtotal * parseFloat(tax_rate) * 100) / 100;
    const total = subtotal + taxAmount;

    const { data, error } = await supabase.from('invoices').insert({
      property_id: pid, reservation_id, guest_id,
      invoice_number: invoiceNumber, status: 'issued',
      subtotal, tax_amount: taxAmount, total_amount: total,
      items: JSON.stringify(items), notes,
      issued_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/invoices/:id/pdf ─────────────────────────────────
router.get('/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { data: invoice, error } = await supabase.from('invoices')
      .select('*, guests(first_name,last_name,email), reservations(confirmation_number), properties(name,location,phone)')
      .eq('id', req.params.id).single();
    if (error || !invoice) return res.status(404).json({ error: 'Factura no encontrada' });

    let PDFDocument;
    try {
      const pdfkit = await import('pdfkit');
      PDFDocument = pdfkit.default || pdfkit;
    } catch {
      return res.status(501).json({ error: 'pdfkit no instalado. Agrega pdfkit a backend/package.json' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=factura-${invoice.invoice_number}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(22).font('Helvetica-Bold').text('REVIO PMS', { align: 'center' });
    doc.fontSize(13).font('Helvetica').text(invoice.properties?.name || 'Propiedad', { align: 'center' });
    if (invoice.properties?.location) doc.fontSize(10).text(invoice.properties.location, { align: 'center' });
    doc.moveDown();

    // Invoice info
    doc.fontSize(16).font('Helvetica-Bold').text(`Factura ${invoice.invoice_number}`);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Fecha: ${new Date(invoice.issued_at || invoice.created_at).toLocaleDateString('es-CO')}`);
    doc.text(`Vencimiento: ${invoice.due_date || 'N/A'}`);
    doc.text(`Estado: ${invoice.status}`);
    if (invoice.reservations?.confirmation_number) {
      doc.text(`Reserva: ${invoice.reservations.confirmation_number}`);
    }
    doc.moveDown();

    // Guest
    const guest = invoice.guests;
    if (guest) {
      doc.fontSize(13).font('Helvetica-Bold').text('Cliente');
      doc.fontSize(11).font('Helvetica').text(`${guest.first_name || ''} ${guest.last_name || ''}`);
      if (guest.email) doc.text(guest.email);
    }
    doc.moveDown();

    // Items
    let parsedItems = [];
    try { parsedItems = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []); } catch {}
    if (parsedItems.length) {
      doc.fontSize(13).font('Helvetica-Bold').text('Detalle');
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.fontSize(10).font('Helvetica');
      for (const item of parsedItems) {
        const line = `${item.description || item.name || '—'}  ×${item.quantity || 1}  @$${Number(item.unit_price || 0).toLocaleString('es-CO')} = $${Number((item.quantity || 1) * (item.unit_price || 0)).toLocaleString('es-CO')}`;
        doc.text(line);
      }
      doc.moveTo(50, doc.y + 4).lineTo(545, doc.y + 4).stroke();
      doc.moveDown();
    }

    // Totals
    doc.fontSize(12).font('Helvetica').text(`Subtotal: $${Number(invoice.subtotal || 0).toLocaleString('es-CO')}`);
    doc.text(`IVA: $${Number(invoice.tax_amount || 0).toLocaleString('es-CO')}`);
    doc.fontSize(15).font('Helvetica-Bold').text(`TOTAL: $${Number(invoice.total_amount || 0).toLocaleString('es-CO')}`);
    doc.moveDown(2);

    doc.fontSize(9).font('Helvetica').fillColor('gray').text('Generado por Revio PMS © 2026', { align: 'center' });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/invoices/:id ───────────────────────────────────
router.patch('/:id', requireAuth, async (req, res) => {
  const allowed = ['status', 'notes', 'paid_at', 'due_date'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase.from('invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
