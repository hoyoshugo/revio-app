import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://revio-app-production.up.railway.app';

const MODULES = [
  {
    id: 'revenue', name: 'Revenue Agent', icon: '🤖',
    status: 'production', priority: 'P0', color: '#0ea5e9',
    description: 'Agente IA de ventas 24/7. Cierra reservas en WhatsApp, OTAs y redes sociales.',
    tests: '15/15', lines: 2480,
    features: ['Chat IA multiidioma', 'OTAs (Booking, Airbnb)', 'WhatsApp Business', 'Pagos Wompi', 'Sandbox IA', 'Intensidad de ventas'],
    deps: ['LobbyPMS / cualquier PMS', 'Wompi / PayU', 'WhatsApp Business API', 'Claude claude-sonnet-4-6'],
    routes: ['/api/chat', '/api/connections', '/api/dashboard', '/api/sandbox'],
    metrics: { reservas: '+34%', conversion: '28%', respuesta: '<2s' },
    eta: null,
    pending: ['Reconectar WhatsApp (OTP manual)', 'IP fija permanente (CF Worker)'],
  },
  {
    id: 'pms', name: 'PMS Hotelero', icon: '🏨',
    status: 'development', priority: 'P1', color: '#8b5cf6',
    description: 'Sistema completo de gestion hotelera. Reservas, habitaciones, huespedes, DIAN.',
    lines: 1907, pct: 35,
    features: ['Gantt Calendar (690L)', 'GuestDetail (588L)', 'RoomsManager', 'Reservaciones', 'Tarifas dinamicas*', 'DIAN*', 'Channel Manager*'],
    deps: ['DIAN API (habilitacion 4-8 sem)', 'Migracion Colombia API', 'Channel Manager OTAs'],
    routes: ['/api/pms/*'],
    eta: 'S2-S6 2026',
    blocker: 'DIAN habilitacion: iniciar HOY',
  },
  {
    id: 'wallets', name: 'Wallets / NFC', icon: '📲',
    status: 'development', priority: 'P1', color: '#f59e0b',
    description: 'Consumos NFC para bar, restaurante, spa. Cargo automatico a habitacion.',
    lines: 785, pct: 55,
    features: ['WalletPanel (549L)', 'wallets.js (236L)', 'Consumos por habitacion', 'NFC real*', 'PWA meseros offline*', 'Liquidacion check-out*'],
    deps: ['PMS (habitaciones)', 'Hardware NFC (~$50 USD)'],
    routes: ['/api/wallets/*'],
    eta: 'S3-S5 2026',
  },
  {
    id: 'pos', name: 'POS Terminal', icon: '🛒',
    status: 'development', priority: 'P1', color: '#06b6d4',
    description: 'Punto de venta para bar, restaurante y tienda del hostel.',
    lines: 325, pct: 45,
    features: ['pos.js backend (325L)', 'Pedidos por categoria', 'Metodos de pago', 'Frontend completo*', 'Reportes por turno*'],
    deps: ['Wallets (NFC + cargo habitacion)'],
    routes: ['/api/pos/*'],
    eta: 'S1-S2 2026',
  },
  {
    id: 'inventory', name: 'Inventarios', icon: '📦',
    status: 'development', priority: 'P1', color: '#10b981',
    description: 'Control de stock, proveedores y movimientos. Frontend 445L ya existe.',
    lines: 445, pct: 20,
    features: ['Inventory.jsx (445L)', 'Stock por bodega', 'Alertas minimos*', 'Backend routes*', 'Ordenes compra*', 'Valorizacion PEPS*'],
    deps: [],
    routes: ['/api/inventory/*'],
    eta: 'S1 2026',
    urgent: 'Solo falta backend/src/routes/inventory.js',
  },
  {
    id: 'marketing', name: 'Marketing IA', icon: '📣',
    status: 'planned', priority: 'P2', color: '#ec4899',
    description: 'Agencia de marketing digital IA. Estrategias automaticas, Meta Ads, Google Ads.',
    lines: 0, pct: 0,
    features: ['Meta Ads optimizadas', 'Google Ads IA', 'Contenido IA', 'Scheduler posts', 'Analytics PMS', 'ROI real'],
    deps: ['Meta Marketing API (review 2-4 sem)', 'Google Ads API'],
    routes: ['/api/marketing/*'],
    eta: 'S6-S10 2026',
    blocker: 'Solicitar Meta API review HOY',
  },
  {
    id: 'financial', name: 'Financiero', icon: '💹',
    status: 'planned', priority: 'P2', color: '#0ea5e9',
    description: 'KPIs, presupuestos, flujo de caja, VPN/TIR, narrativa IA. Requiere Contable.',
    lines: 0, pct: 0,
    features: ['Presupuestos vs real', 'Flujo de caja', 'VPN / TIR / Payback', 'KPIs tiempo real', 'Narrativa IA', 'Benchmarking'],
    deps: ['Modulo Contable (al menos 40%)'],
    routes: ['/api/financial/*'],
    eta: 'S8+ 2026',
  },
  {
    id: 'accounting', name: 'Contable', icon: '📊',
    status: 'planned', priority: 'P2', color: '#f97316',
    description: 'Sistema contable tipo Siigo. PUC Colombia, DIAN, nomina electronica, impuestos.',
    lines: 159, pct: 5,
    features: ['PUC Colombia*', 'Factura DIAN*', 'Nomina DIAN*', 'IVA/ICA/Retencion*', 'Balance/P&L*', 'EXOGENA*'],
    deps: ['DIAN habilitacion (4-8 sem)', 'Certificado digital Certicamara'],
    routes: ['/api/accounting/*'],
    eta: 'S7+ 2026',
    blocker: 'DIAN habilitacion: el mayor bloqueante del ecosistema',
  },
];

const STATUS_MAP = {
  production:  { label: 'Produccion', dot: 'bg-green-400 animate-pulse', text: 'text-green-400', border: 'border-green-600/60', bg: 'bg-green-950/30' },
  development: { label: 'En desarrollo', dot: 'bg-yellow-400', text: 'text-yellow-400', border: 'border-yellow-600/60', bg: 'bg-yellow-950/30' },
  planned:     { label: 'Planificado', dot: 'bg-gray-500', text: 'text-gray-500', border: 'border-gray-700', bg: 'bg-gray-900/20' },
};

const PRIORITY_STYLE = {
  P0: 'bg-red-950 text-red-300 border border-red-800',
  P1: 'bg-orange-950 text-orange-300 border border-orange-800',
  P2: 'bg-blue-950 text-blue-300 border border-blue-800',
};

export default function EcosystemVisualizer() {
  const [selected, setSelected] = useState('revenue');
  const [health, setHealth] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch(API_BASE + '/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  const filtered = filter === 'all' ? MODULES : MODULES.filter(m => m.status === filter);
  const sel = MODULES.find(m => m.id === selected);

  const totalLines = MODULES.reduce((s, m) => s + m.lines, 0);
  const inProd = MODULES.filter(m => m.status === 'production').length;
  const inDev = MODULES.filter(m => m.status === 'development').length;
  const planned = MODULES.filter(m => m.status === 'planned').length;

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white font-sans">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 sticky top-0 bg-[#0A0F1A]/95 backdrop-blur z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-sm font-bold">R</div>
            <div>
              <span className="font-semibold text-lg">Revio Ecosystem</span>
              <span className="text-xs text-gray-500 ml-3">3H Enterprise SAS · NIT 901696556-6</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              health?.status === 'ok'
                ? 'bg-green-950/50 border-green-800 text-green-400'
                : 'bg-red-950/50 border-red-800 text-red-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${health?.status === 'ok' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              {health?.status === 'ok' ? 'Produccion activa' : 'Sin conexion'}
            </div>
            <div className="text-gray-600 border border-gray-800 rounded-lg px-3 py-1.5">
              {totalLines.toLocaleString()} lineas · v2.1
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Modulos totales', value: MODULES.length, sub: 'del ecosistema', color: 'text-white' },
            { label: 'En produccion', value: inProd, sub: '15/15 tests OK', color: 'text-green-400' },
            { label: 'En desarrollo', value: inDev, sub: 'P1 prioritarios', color: 'text-yellow-400' },
            { label: 'Planificados', value: planned, sub: 'roadmap 2026', color: 'text-gray-400' },
          ].map((s, i) => (
            <div key={i} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <div className={`text-3xl font-bold mb-1 ${s.color}`}>{s.value}</div>
              <div className="text-xs font-medium text-gray-300">{s.label}</div>
              <div className="text-xs text-gray-600 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {['all', 'production', 'development', 'planned'].map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f ? 'bg-sky-600 text-white' : 'bg-gray-800/60 text-gray-400 hover:bg-gray-800'
              }`}>
              {f === 'all' ? `Todos (${MODULES.length})` : STATUS_MAP[f]?.label}
            </button>
          ))}
        </div>

        <div className="flex gap-5">
          {/* Grid de modulos */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(m => {
              const st = STATUS_MAP[m.status];
              const isSelected = selected === m.id;
              return (
                <div key={m.id}
                  onClick={() => setSelected(isSelected ? null : m.id)}
                  className={`rounded-xl p-5 cursor-pointer transition-all border hover:border-gray-600 ${
                    isSelected ? `${st.border} ${st.bg}` : 'border-gray-800 bg-gray-900/40'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{m.icon}</span>
                      <div>
                        <div className="font-semibold text-sm">{m.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          <span className={`text-xs ${st.text}`}>{st.label}</span>
                          {m.lines > 0 && <span className="text-xs text-gray-600">· {m.lines.toLocaleString()}L</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${PRIORITY_STYLE[m.priority]}`}>
                        {m.priority}
                      </span>
                      {m.pct !== undefined && (
                        <span className="text-xs text-gray-600">{m.pct}%</span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed mb-3">{m.description}</p>

                  {/* Barra de progreso */}
                  {m.pct !== undefined && (
                    <div className="mb-3">
                      <div className="w-full bg-gray-800 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full ${m.status === 'production' ? 'bg-green-500' : 'bg-sky-500'}`}
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {m.features.slice(0, 3).map((f, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${
                        f.endsWith('*') ? 'bg-gray-800/80 text-gray-600' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {f.replace('*', '')}
                      </span>
                    ))}
                    {m.features.length > 3 && (
                      <span className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-600">
                        +{m.features.length - 3}
                      </span>
                    )}
                  </div>

                  {m.urgent && (
                    <div className="mt-2 text-xs text-orange-400 bg-orange-950/30 border border-orange-800/50 px-2 py-1 rounded">
                      {m.urgent}
                    </div>
                  )}
                  {m.blocker && (
                    <div className="mt-2 text-xs text-red-400 bg-red-950/30 border border-red-800/50 px-2 py-1 rounded">
                      {m.blocker}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Panel de detalle */}
          {sel && (
            <div className="w-72 flex-shrink-0">
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 sticky top-20 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{sel.icon}</span>
                    <div>
                      <div className="font-semibold">{sel.name}</div>
                      <span className={`text-xs ${STATUS_MAP[sel.status].text}`}>
                        {STATUS_MAP[sel.status].label}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{sel.description}</p>
                </div>

                {sel.metrics && (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(sel.metrics).map(([k, v]) => (
                      <div key={k} className="bg-gray-800 rounded-lg p-2 text-center">
                        <div className="text-sm font-semibold text-green-400">{v}</div>
                        <div className="text-xs text-gray-500">{k}</div>
                      </div>
                    ))}
                  </div>
                )}

                {sel.pct !== undefined && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Progreso</span>
                      <span className="text-gray-300">{sel.pct}% — {sel.lines.toLocaleString()}L</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${sel.status === 'production' ? 'bg-green-500' : 'bg-sky-500'}`}
                        style={{ width: `${sel.pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Funcionalidades</div>
                  <ul className="space-y-1">
                    {sel.features.map((f, i) => (
                      <li key={i} className={`text-xs flex gap-2 ${f.endsWith('*') ? 'text-gray-600' : 'text-gray-300'}`}>
                        <span className={f.endsWith('*') ? 'text-gray-700' : 'text-green-500'}>
                          {f.endsWith('*') ? '○' : '✓'}
                        </span>
                        {f.replace('*', '')}
                        {f.endsWith('*') && <span className="text-gray-700">(pendiente)</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {sel.deps?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dependencias</div>
                    <ul className="space-y-1">
                      {sel.deps.map((d, i) => (
                        <li key={i} className="text-xs text-gray-400 flex gap-2">
                          <span className="text-sky-400">→</span>{d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sel.pending?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2">Pendiente</div>
                    <ul className="space-y-1">
                      {sel.pending.map((p, i) => (
                        <li key={i} className="text-xs text-yellow-600/80 flex gap-2">
                          <span>•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rutas API</div>
                  {sel.routes?.map((r, i) => (
                    <div key={i} className="text-xs font-mono bg-gray-800 rounded px-2 py-1 mb-1 text-gray-400">{r}</div>
                  ))}
                </div>

                {sel.eta && (
                  <div className="text-center py-2 bg-gray-800 rounded-lg text-xs text-gray-400">
                    ETA: {sel.eta}
                  </div>
                )}

                {sel.status === 'production' && (
                  <a href={API_BASE} target="_blank" rel="noopener noreferrer"
                    className="block w-full text-center py-2 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-medium transition-colors">
                    Abrir en produccion →
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex items-center justify-between text-xs text-gray-700">
          <span>© 2026 Revio · TRES HACHE ENTERPRISE SAS · NIT 901696556-6</span>
          <div className="flex gap-4">
            <a href="/legal/terminos" className="hover:text-gray-500">Terminos</a>
            <a href="/legal/privacidad" className="hover:text-gray-500">Privacidad</a>
          </div>
        </div>
      </div>
    </div>
  );
}
