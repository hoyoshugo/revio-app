/**
 * Catálogo de pasarelas de pago compatibles con Revio.
 * Cada gateway expone createLink(amount, currency, reference, config).
 * Las pasarelas marcadas como available:false están listas para implementación
 * pero requieren credenciales / cuenta del cliente.
 */
import { supabase } from '../models/supabase.js';

export const PAYMENT_GATEWAYS = {
  wompi: {
    name: 'Wompi',
    icon: '💳',
    countries: ['CO'],
    currencies: ['COP'],
    available: true,
    createLink: async (amount, currency, reference, config) => {
      const publicKey = config.publicKey || config.wompi_public_key;
      if (!publicKey) return null;
      const params = new URLSearchParams({
        'public-key': publicKey,
        currency,
        'amount-in-cents': String(amount * 100),
        reference,
      });
      return `https://checkout.wompi.co/p/?${params.toString()}`;
    },
  },

  payu: {
    name: 'PayU',
    icon: '💰',
    countries: ['CO', 'MX', 'BR', 'PE', 'AR', 'CL'],
    currencies: ['COP', 'MXN', 'BRL', 'PEN', 'ARS', 'CLP'],
    available: true,
    createLink: async (amount, currency, reference, config) => {
      if (!config.merchantId || !config.accountId) return null;
      const params = new URLSearchParams({
        merchantId: config.merchantId,
        accountId: config.accountId,
        description: reference,
        referenceCode: reference,
        amount: String(amount),
        currency,
        signature: config.signature || '',
        tax: '0',
        taxReturnBase: '0',
      });
      return `https://checkout.payulatam.com/ppp-web-gateway/payment?${params.toString()}`;
    },
  },

  stripe: {
    name: 'Stripe',
    icon: '💜',
    countries: ['US', 'EU', 'GB', 'CO'],
    currencies: ['USD', 'EUR', 'GBP', 'COP'],
    available: false,
    note: 'Requiere cuenta Stripe + Payment Links API',
    createLink: async () => null,
  },

  paypal: {
    name: 'PayPal',
    icon: '🔵',
    countries: ['Global'],
    currencies: ['USD', 'EUR'],
    available: false,
    note: 'PayPal Orders API v2',
    createLink: async () => null,
  },

  mercadopago: {
    name: 'MercadoPago',
    icon: '🟡',
    countries: ['CO', 'MX', 'BR', 'AR', 'CL', 'PE'],
    currencies: ['COP', 'MXN', 'BRL', 'ARS', 'CLP', 'PEN'],
    available: false,
    note: 'MercadoPago Checkout API',
    createLink: async () => null,
  },

  bold: {
    name: 'Bold',
    icon: '⚡',
    countries: ['CO'],
    currencies: ['COP'],
    available: false,
    note: 'Bold.co Payment Links',
    createLink: async () => null,
  },

  addi: {
    name: 'ADDI',
    icon: '🛍️',
    countries: ['CO', 'BR', 'MX'],
    currencies: ['COP', 'BRL', 'MXN'],
    available: false,
    note: 'Financiación en cuotas sin interés',
    createLink: async () => null,
  },

  skrill: {
    name: 'Skrill',
    icon: '💲',
    countries: ['Global'],
    currencies: ['USD', 'EUR', 'GBP'],
    available: false,
    createLink: async () => null,
  },

  wise: {
    name: 'Wise',
    icon: '🌍',
    countries: ['Global'],
    currencies: ['USD', 'EUR', 'GBP', 'COP'],
    available: false,
    note: 'Transferencias internacionales — bajo costo FX',
    createLink: async () => null,
  },

  sistecredito: {
    name: 'Sistecrédito',
    icon: '💳',
    countries: ['CO'],
    currencies: ['COP'],
    available: false,
    note: 'Crédito a cuotas para hoteles — requiere convenio comercial',
    createLink: async () => null,
  },

  credibanco: {
    name: 'Credibanco',
    icon: '🏦',
    countries: ['CO'],
    currencies: ['COP'],
    available: false,
    note: 'Red de adquirencia Visa Colombia — requiere cuenta comercio',
    createLink: async () => null,
  },

  redeban: {
    name: 'Redeban',
    icon: '🏦',
    countries: ['CO'],
    currencies: ['COP'],
    available: false,
    note: 'Red de adquirencia Mastercard Colombia — requiere cuenta comercio',
    createLink: async () => null,
  },
};

/**
 * Crea un link de pago usando el gateway pedido.
 * Si el gateway no está disponible, hace fallback a Wompi.
 */
export async function createPaymentLink(gateway, amount, currency, reference, tenantConfig = {}) {
  const gw = PAYMENT_GATEWAYS[gateway];
  if (!gw || !gw.available) {
    if (tenantConfig.wompi_public_key) {
      return PAYMENT_GATEWAYS.wompi.createLink(amount, currency, reference, {
        publicKey: tenantConfig.wompi_public_key,
      });
    }
    return null;
  }
  return gw.createLink(amount, currency, reference, tenantConfig);
}

/**
 * Devuelve los gateways efectivamente configurados para una propiedad.
 */
export async function getAvailableGateways(propertyId) {
  const ids = Object.keys(PAYMENT_GATEWAYS);
  const { data: connections } = await supabase
    .from('property_connections')
    .select('connection_type, credentials, settings, status')
    .eq('property_id', propertyId)
    .in('connection_type', ids)
    .eq('is_active', true)
    .eq('status', 'connected');

  return (connections || []).map(c => ({
    id: c.connection_type,
    ...PAYMENT_GATEWAYS[c.connection_type],
    configured: true,
  }));
}
