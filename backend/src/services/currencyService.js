/**
 * Servicio de conversión de monedas para Revio.
 * Fuente default: frankfurter.app (gratuita, open source, basada en BCE).
 * Cache en Supabase tabla currency_rates con TTL configurable.
 */
import { supabase } from '../models/supabase.js';

const CACHE_TTL_MINUTES = parseInt(process.env.CURRENCY_CACHE_TTL_MINUTES || '60');
const API_URL = process.env.CURRENCY_API_URL || 'https://api.frankfurter.app';

export const SUPPORTED_CURRENCIES = [
  'COP', 'USD', 'EUR', 'GBP', 'MXN', 'BRL', 'ARS', 'PEN', 'CLP', 'CAD', 'AUD',
];

/**
 * Tasa de cambio con cache.
 */
export async function getExchangeRate(from = 'COP', to = 'USD') {
  from = from.toUpperCase();
  to = to.toUpperCase();
  if (from === to) return 1;

  // 1. Cache
  try {
    const { data: cached } = await supabase
      .from('currency_rates')
      .select('rate, fetched_at')
      .eq('base_currency', from)
      .eq('target_currency', to)
      .single();

    if (cached) {
      const ageMin = (Date.now() - new Date(cached.fetched_at).getTime()) / 60000;
      if (ageMin < CACHE_TTL_MINUTES) return parseFloat(cached.rate);
    }
  } catch {}

  // 2. Fetch fresh
  try {
    const r = await fetch(`${API_URL}/latest?from=${from}&to=${to}`);
    if (r.ok) {
      const data = await r.json();
      const rate = data.rates?.[to];
      if (rate) {
        await supabase.from('currency_rates').upsert({
          base_currency: from,
          target_currency: to,
          rate,
          source: 'frankfurter.app',
          fetched_at: new Date().toISOString(),
        }, { onConflict: 'base_currency,target_currency' });
        return rate;
      }
    }
  } catch (e) {
    console.error('[Currency] fetch error:', e.message);
  }

  // 3. Stale fallback
  try {
    const { data: stale } = await supabase
      .from('currency_rates')
      .select('rate')
      .eq('base_currency', from)
      .eq('target_currency', to)
      .single();
    if (stale) return parseFloat(stale.rate);
  } catch {}

  return null;
}

/**
 * Convierte un monto entre monedas.
 */
export async function convertAmount(amount, from = 'COP', to = 'USD') {
  if (from === to) return { amount, rate: 1, formatted: formatCurrency(amount, to) };

  const rate = await getExchangeRate(from, to);
  if (!rate) {
    return { amount, rate: null, formatted: formatCurrency(amount, from), error: 'rate_unavailable' };
  }

  const converted = Math.round(amount * rate * 100) / 100;
  return {
    originalAmount: amount,
    originalCurrency: from,
    convertedAmount: converted,
    targetCurrency: to,
    rate,
    formatted: formatCurrency(converted, to),
    formattedOriginal: formatCurrency(amount, from),
  };
}

/**
 * Precio en múltiples monedas (para mostrar en UI).
 */
export async function getPriceInCurrencies(amountCop, currencies = ['COP', 'USD', 'EUR']) {
  const results = {};
  await Promise.all(
    currencies.map(async (currency) => {
      if (currency === 'COP') {
        results[currency] = { amount: amountCop, formatted: formatCurrency(amountCop, 'COP') };
      } else {
        const conv = await convertAmount(amountCop, 'COP', currency);
        results[currency] = {
          amount: conv.convertedAmount,
          formatted: conv.formatted,
          rate: conv.rate,
        };
      }
    })
  );
  return results;
}

/**
 * Formato con Intl.NumberFormat por locale apropiado.
 */
export function formatCurrency(amount, currency = 'COP') {
  const formatters = {
    COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    MXN: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }),
    BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    ARS: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }),
    PEN: new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }),
    CLP: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }),
    CAD: new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }),
    AUD: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }),
  };
  const formatter = formatters[currency] || formatters.USD;
  return formatter.format(amount);
}

/**
 * Refresca todas las tasas (para cron).
 */
export async function refreshAllRates() {
  const base = 'COP';
  const targets = SUPPORTED_CURRENCIES.filter(c => c !== base);

  try {
    const r = await fetch(`${API_URL}/latest?from=${base}&to=${targets.join(',')}`);
    if (!r.ok) return { success: false, status: r.status };
    const data = await r.json();

    const upserts = Object.entries(data.rates).map(([currency, rate]) => ({
      base_currency: base,
      target_currency: currency,
      rate,
      source: 'frankfurter.app',
      fetched_at: new Date().toISOString(),
    }));

    await supabase
      .from('currency_rates')
      .upsert(upserts, { onConflict: 'base_currency,target_currency' });

    console.log(JSON.stringify({ level: 'info', event: 'currency_rates_refreshed', count: upserts.length }));
    return { success: true, count: upserts.length };
  } catch (e) {
    console.error('[Currency] refresh failed:', e.message);
    return { success: false, error: e.message };
  }
}
