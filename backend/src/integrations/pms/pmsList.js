/**
 * Catálogo de PMS compatibles con Revio.
 * status: 'active'      → integración funcional en producción
 *         'ready'       → adapter listo, falta credenciales del cliente
 *         'coming_soon' → planeado, sin adapter aún
 */
export const PMS_LIST = [
  {
    id: 'lobbypms',
    name: 'LobbyPMS',
    icon: '🏨',
    status: 'active',
    countries: ['CO', 'LATAM'],
    website: 'https://app.lobbypms.com',
    apiDocs: 'https://app.lobbypms.com/api-docs',
    fields: [{ key: 'api_token', label: 'API Token', type: 'password' }],
    note: 'Integración completa. Requiere whitelist de IP del proxy fly.io.',
  },
  {
    id: 'cloudbeds',
    name: 'Cloudbeds',
    icon: '☁️',
    status: 'ready',
    countries: ['Global'],
    website: 'https://cloudbeds.com',
    apiDocs: 'https://hotels.cloudbeds.com/api/v1.2/docs',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'property_id', label: 'Property ID', type: 'text' },
    ],
  },
  {
    id: 'mews',
    name: 'Mews',
    icon: '🔷',
    status: 'ready',
    countries: ['Global'],
    website: 'https://www.mews.com',
    apiDocs: 'https://mews-systems.gitbook.io/connector-api',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password' },
      { key: 'client_token', label: 'Client Token', type: 'password' },
    ],
  },
  {
    id: 'little_hotelier',
    name: 'Little Hotelier',
    icon: '🏩',
    status: 'ready',
    countries: ['Global'],
    website: 'https://www.littlehotelier.com',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'property_id', label: 'Property ID', type: 'text' },
    ],
  },
  {
    id: 'clock_pms',
    name: 'Clock PMS',
    icon: '🕐',
    status: 'ready',
    countries: ['Global'],
    website: 'https://www.clock-software.com',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'hotel_code', label: 'Hotel Code', type: 'text' },
    ],
  },
  {
    id: 'opera',
    name: 'Oracle Opera',
    icon: '🔴',
    status: 'coming_soon',
    countries: ['Global'],
    website: 'https://www.oracle.com/industries/hospitality/opera-cloud',
    note: 'Enterprise. Requiere acuerdo con Oracle.',
  },
  {
    id: 'protel',
    name: 'Protel',
    icon: '⚙️',
    status: 'coming_soon',
    countries: ['Global'],
    website: 'https://protel.net',
  },
  {
    id: 'maestro',
    name: 'Maestro PMS',
    icon: '🎵',
    status: 'coming_soon',
    countries: ['US', 'CA'],
    website: 'https://www.maestropms.com',
  },
  {
    id: 'rms',
    name: 'RMS Cloud',
    icon: '☁️',
    status: 'ready',
    countries: ['AU', 'NZ', 'Global'],
    website: 'https://rmscloud.com',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'property_id', label: 'Property ID', type: 'text' },
    ],
  },
  {
    id: 'hotelogix',
    name: 'Hotelogix',
    icon: '🌐',
    status: 'ready',
    countries: ['IN', 'Global'],
    website: 'https://www.hotelogix.com',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password' }],
  },
  {
    id: 'beds24',
    name: 'Beds24',
    icon: '🛏️',
    status: 'ready',
    countries: ['Global'],
    website: 'https://beds24.com',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'prop_key', label: 'Prop Key', type: 'password' },
    ],
    note: 'Excelente para hostales y B&Bs',
  },
  {
    id: 'hostaway',
    name: 'Hostaway',
    icon: '🏠',
    status: 'ready',
    countries: ['Global'],
    website: 'https://www.hostaway.com',
    fields: [
      { key: 'account_id', label: 'Account ID', type: 'text' },
      { key: 'api_key', label: 'API Key', type: 'password' },
    ],
    note: 'Ideal para alquileres vacacionales',
  },
  {
    id: 'lodgify',
    name: 'Lodgify',
    icon: '🏡',
    status: 'ready',
    countries: ['Global'],
    website: 'https://www.lodgify.com',
    fields: [{ key: 'api_key', label: 'API Key', type: 'password' }],
  },
  {
    id: 'loggro',
    name: 'Loggro',
    icon: '🇨🇴',
    status: 'coming_soon',
    countries: ['CO'],
    website: 'https://loggro.com',
    note: 'PMS colombiano con integración DIAN nativa',
  },
  {
    id: 'odoo',
    name: 'Odoo Hotel',
    icon: '🟣',
    status: 'coming_soon',
    countries: ['Global'],
    website: 'https://www.odoo.com/app/hotel-management',
    fields: [
      { key: 'url', label: 'URL del servidor', type: 'text' },
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'database', label: 'Base de datos', type: 'text' },
    ],
  },
  {
    id: 'siigo',
    name: 'Siigo (módulo hotel)',
    icon: '📊',
    status: 'coming_soon',
    countries: ['CO'],
    website: 'https://www.siigo.com',
    note: 'Integración con módulo de hospedaje de Siigo',
  },
  {
    id: 'world_office',
    name: 'World Office',
    icon: '🌍',
    status: 'coming_soon',
    countries: ['CO'],
    website: 'https://worldoffice.com.co',
  },
  {
    id: 'stayntouch',
    name: 'StayNtouch',
    icon: '📱',
    status: 'coming_soon',
    countries: ['US', 'Global'],
    website: 'https://stayntouch.com',
    note: 'PMS mobile-first',
  },
  {
    id: 'guestline',
    name: 'Guestline',
    icon: '🏨',
    status: 'coming_soon',
    countries: ['UK', 'EU'],
    website: 'https://www.guestline.com',
  },
  {
    id: 'custom_webhook',
    name: 'PMS Personalizado (Webhook)',
    icon: '🔧',
    status: 'active',
    countries: ['Global'],
    fields: [
      { key: 'api_endpoint', label: 'URL del endpoint', type: 'text' },
      { key: 'api_key', label: 'API Key / Token', type: 'password' },
      { key: 'api_type', label: 'Tipo de auth', type: 'select', options: ['Bearer', 'Basic', 'API-Key'] },
    ],
    note: 'Para cualquier PMS con API REST. Configura el endpoint y el agente se conectará.',
  },
];

export function getPMSById(id) {
  return PMS_LIST.find(p => p.id === id);
}

export function getActivePMS() {
  return PMS_LIST.filter(p => p.status === 'active');
}

export function getReadyPMS() {
  return PMS_LIST.filter(p => ['active', 'ready'].includes(p.status));
}
