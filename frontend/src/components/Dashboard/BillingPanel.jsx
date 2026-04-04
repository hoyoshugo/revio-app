/**
 * BillingPanel — Facturación por propiedad (Módulo C)
 * - Plan base + propiedades adicionales con descuento por volumen
 * - Vista de factura actual + historial
 */
import React, { useState, useEffect } from 'react';
import {
  CreditCard, Building2, TrendingDown, FileText,
  CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
  Download, Zap, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PLAN_PRICES = {
  basico:     { base: 299000, extra: 149000, name: 'Básico' },
  pro:        { base: 599000, extra: 249000, name: 'Pro' },
  enterprise: { base: 1199000, extra: 399000, name: 'Enterprise' },
};

function getVolumeDiscount(propCount) {
  if (propCount >= 7) return { pct: 30, label: '7+ propiedades' };
  if (propCount >= 4) return { pct: 20, label: '4–6 propiedades' };
  if (propCount >= 2) return { pct: 10, label: '2–3 propiedades' };
  return { pct: 0, label: null };
}

function calcBill(planKey, propCount, customDiscountPct = 0) {
  const plan = PLAN_PRICES[planKey] || PLAN_PRICES.basico;
  const extras = Math.max(0, propCount - 1);
  const baseAmount = plan.base;
  const extraAmount = extras * plan.extra;
  const vol = getVolumeDiscount(propCount);
  const volumeDiscount = Math.round(extraAmount * vol.pct / 100);
  const extraNet = extraAmount - volumeDiscount;
  const subtotal = baseAmount + extraNet;
  const customDiscount = Math.round(subtotal * customDiscountPct / 100);
  const total = subtotal - customDiscount;
  return { baseAmount, extras, extraAmount, vol, volumeDiscount, extraNet, subtotal, customDiscount, total, plan };
}

function COP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO') + ' COP';
}

function StatusBadge({ status }) {
  const styles = {
    active:    { bg: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)', label: 'Activo' },
    trial:     { bg: 'color-mix(in srgb, var(--accent) 12%, transparent)',  color: 'var(--accent)',   label: 'Trial' },
    suspended: { bg: 'color-mix(in srgb, var(--danger) 12%, transparent)',  color: 'var(--danger)',   label: 'Suspendido' },
    past_due:  { bg: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)',  label: 'Vencido' },
  };
  const s = styles[status] || styles.active;
  return (
    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function InvoiceLine({ label, amount, sub, highlight, negative }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? 'border-t mt-1' : ''}`}
      style={highlight ? { borderColor: 'var(--border)' } : {}}>
      <div>
        <span className="text-sm" style={{ color: highlight ? 'var(--text-1)' : 'var(--text-2)' }}>{label}</span>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
      <span className={`text-sm font-medium ${highlight ? 'text-base font-bold' : ''}`}
        style={{ color: negative ? 'var(--success)' : highlight ? 'var(--text-1)' : 'var(--text-2)' }}>
        {negative ? '−' : ''}{COP(amount)}
      </span>
    </div>
  );
}

export default function BillingPanel() {
  const { token } = useAuth();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/dashboard/billing`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setBilling(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="rv-skeleton h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  // Fallback data for display even without backend
  const plan = billing?.plan || 'basico';
  const propCount = billing?.property_count || 1;
  const customDiscountPct = billing?.discount_pct || 0;
  const status = billing?.status || 'trial';
  const trialDaysLeft = billing?.trial_days_left ?? 14;
  const nextBillingDate = billing?.next_billing_date;
  const invoiceHistory = billing?.invoice_history || [];

  const bill = calcBill(plan, propCount, customDiscountPct);
  const annualMultiplier = annual ? 10 : 12; // 2 months free
  const annualSaving = annual ? bill.total * 2 : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Facturación</h3>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>Plan {bill.plan.name} · {propCount} propiedad{propCount !== 1 ? 'es' : ''}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Trial banner */}
      {status === 'trial' && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
          <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
              {trialDaysLeft > 0 ? `${trialDaysLeft} días de prueba restantes` : 'Tu período de prueba ha finalizado'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
              Activa tu suscripción para continuar usando Revio sin interrupciones.
            </p>
          </div>
          <button className="rv-btn-primary text-xs px-3 py-1.5 whitespace-nowrap ml-auto">
            Activar plan
          </button>
        </div>
      )}

      {/* Annual toggle */}
      <div className="flex items-center justify-center gap-3 py-2">
        <span className="text-xs" style={{ color: annual ? 'var(--text-3)' : 'var(--text-1)' }}>Mensual</span>
        <button
          onClick={() => setAnnual(a => !a)}
          className="relative w-11 h-6 rounded-full transition-colors"
          style={{ background: annual ? 'var(--accent)' : 'var(--border)' }}
        >
          <span className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200"
            style={{ left: annual ? '24px' : '4px' }} />
        </button>
        <span className="text-xs" style={{ color: annual ? 'var(--text-1)' : 'var(--text-3)' }}>
          Anual
          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
            2 meses gratis
          </span>
        </span>
      </div>

      {/* Invoice breakdown */}
      <div className="rv-card px-5 py-4 space-y-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
          {annual ? 'Resumen anual' : 'Resumen mensual'}
        </h4>

        <InvoiceLine
          label={`Plan ${bill.plan.name}`}
          sub="1 propiedad incluida"
          amount={annual ? bill.baseAmount * 10 : bill.baseAmount}
        />

        {bill.extras > 0 && (
          <InvoiceLine
            label={`${bill.extras} propiedad${bill.extras > 1 ? 'es' : ''} adicional${bill.extras > 1 ? 'es' : ''}`}
            sub={`${COP(bill.plan.extra)}/mes c/u`}
            amount={annual ? bill.extraAmount * 10 : bill.extraAmount}
          />
        )}

        {bill.vol.pct > 0 && (
          <InvoiceLine
            label={`Descuento por volumen ${bill.vol.pct}%`}
            sub={bill.vol.label}
            amount={annual ? bill.volumeDiscount * 10 : bill.volumeDiscount}
            negative
          />
        )}

        {customDiscountPct > 0 && (
          <InvoiceLine
            label={`Descuento personalizado ${customDiscountPct}%`}
            sub="Aplicado por Revio"
            amount={annual ? bill.customDiscount * 10 : bill.customDiscount}
            negative
          />
        )}

        {annual && (
          <InvoiceLine
            label="Ahorro plan anual"
            sub="2 meses gratis"
            amount={annualSaving}
            negative
          />
        )}

        <InvoiceLine
          label="Total"
          sub={annual ? 'Facturado una vez al año' : `Próxima factura: ${nextBillingDate ? new Date(nextBillingDate).toLocaleDateString('es-CO') : '—'}`}
          amount={annual ? bill.total * 10 : bill.total}
          highlight
        />
      </div>

      {/* Properties breakdown */}
      <div className="rv-card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
            Propiedades activas
          </h4>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-3)' }}>
            <Building2 className="w-3.5 h-3.5" />
            {propCount} / ilimitadas
          </div>
        </div>

        {/* Volume discount tiers */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { range: '2–3', pct: '10%', active: propCount >= 2 && propCount <= 3 },
            { range: '4–6', pct: '20%', active: propCount >= 4 && propCount <= 6 },
            { range: '7+',  pct: '30%', active: propCount >= 7 },
          ].map(({ range, pct, active }) => (
            <div key={range} className="text-center py-2.5 px-2 rounded-xl"
              style={{
                background: active ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'var(--surface)',
                border: `1px solid ${active ? 'color-mix(in srgb, var(--success) 30%, transparent)' : 'var(--border)'}`,
              }}>
              <div className="text-sm font-bold" style={{ color: active ? 'var(--success)' : 'var(--text-3)' }}>{pct}</div>
              <div className="text-[10px] mt-0.5" style={{ color: active ? 'var(--text-2)' : 'var(--text-3)' }}>{range} props</div>
              {active && <CheckCircle className="w-3 h-3 mx-auto mt-1" style={{ color: 'var(--success)' }} />}
            </div>
          ))}
        </div>

        {bill.vol.pct === 0 && propCount === 1 && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Agrega una segunda propiedad y obtén 10% de descuento en extras.
          </div>
        )}
      </div>

      {/* Payment method placeholder */}
      {status === 'active' && (
        <div className="rv-card px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-6 rounded flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                VISA
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>•••• •••• •••• 4242</p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Vence 12/27</p>
              </div>
            </div>
            <button className="rv-btn-ghost text-xs px-3 py-1.5">Cambiar</button>
          </div>
        </div>
      )}

      {/* Invoice history */}
      <div className="rv-card overflow-hidden">
        <button
          onClick={() => setShowHistory(h => !h)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Historial de facturas</span>
          </div>
          {showHistory ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
                       : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-3)' }} />}
        </button>

        {showHistory && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {invoiceHistory.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>Sin facturas aún</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Aparecerán aquí después de tu primer ciclo de pago</p>
              </div>
            ) : (
              <div className="divide-y" style={{ '--tw-divide-color': 'var(--border)' }}>
                {invoiceHistory.map((inv, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                        {new Date(inv.date).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{COP(inv.amount)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: inv.paid ? 'color-mix(in srgb, var(--success) 12%, transparent)' : 'color-mix(in srgb, var(--warning) 12%, transparent)',
                        color: inv.paid ? 'var(--success)' : 'var(--warning)'
                      }}>
                      {inv.paid ? 'Pagado' : 'Pendiente'}
                    </span>
                    <button className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text-3)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Activate CTA */}
      {(status === 'trial' || status === 'suspended') && (
        <div className="rv-card px-5 py-5 text-center space-y-3"
          style={{ border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
          <Zap className="w-8 h-8 mx-auto" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              Activa tu plan {bill.plan.name}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
              {COP(annual ? bill.total * 10 : bill.total)} {annual ? 'anuales' : 'al mes'} · Sin contratos · Cancela cuando quieras
            </p>
          </div>
          <button className="rv-btn-primary text-sm px-6 py-2.5">
            Suscribirse con Wompi
          </button>
          <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
            Pago seguro procesado por Wompi · TRES HACHE ENTERPRISE SAS · NIT 901696556-6
          </p>
        </div>
      )}
    </div>
  );
}
