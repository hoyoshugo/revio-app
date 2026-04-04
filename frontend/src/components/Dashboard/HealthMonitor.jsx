import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Clock, Shield, Zap, Code, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const SA_API = API;

const SERVICE_LABELS = {
  backend: 'Backend API',
  supabase: 'Base de datos',
  lobbypms: 'LobbyPMS',
  wompi: 'Wompi (pagos)',
  whatsapp: 'WhatsApp'
};

const SERVICE_ICONS = {
  backend: '⚙️',
  supabase: '🗄️',
  lobbypms: '🏨',
  wompi: '💳',
  whatsapp: '💬'
};

// ─── Semáforo del Guardian ────────────────────────────────────
function GuardianLight({ status }) {
  const config = {
    healthy: { color: 'bg-green-500', ring: 'ring-green-500/30', label: 'Sistema saludable', icon: '🟢', text: 'text-green-400' },
    warning: { color: 'bg-yellow-400', ring: 'ring-yellow-400/30', label: 'Con advertencias', icon: '🟡', text: 'text-yellow-400' },
    critical: { color: 'bg-red-500', ring: 'ring-red-500/30', label: 'Estado crítico', icon: '🔴', text: 'text-red-400' },
  };
  const c = config[status] || config.healthy;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-4 h-4 rounded-full ${c.color} ring-4 ${c.ring} animate-pulse`} />
      <span className={`font-semibold text-sm ${c.text}`}>{c.label}</span>
    </div>
  );
}

// ─── Categoría del reporte ───────────────────────────────────
function FindingCategory({ icon: Icon, label, findings = [] }) {
  const criticals = findings.filter(f => f.level === 'critical').length;
  const warnings = findings.filter(f => f.level === 'warning').length;
  const [open, setOpen] = useState(criticals > 0);

  if (findings.length === 0) return null;

  return (
    <div className="bg-gray-800/60 rounded-xl border border-gray-700/50">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-white text-sm font-medium">{label}</span>
          <div className="flex gap-1.5">
            {criticals > 0 && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{criticals} crítico{criticals > 1 ? 's' : ''}</span>}
            {warnings > 0 && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">{warnings} aviso{warnings > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-700/50 divide-y divide-gray-700/30">
          {findings.map((f, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0">
                  {f.level === 'critical' ? '🔴' : f.level === 'warning' ? '🟡' : '🟢'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-200 text-xs">{f.description}</p>
                  {f.file && (
                    <p className="text-gray-500 text-xs mt-0.5 font-mono">{f.file}{f.line ? `:${f.line}` : ''}</p>
                  )}
                  {f.fix && (
                    <div className="mt-2 bg-gray-900 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-1">Fix recomendado:</p>
                      <pre className="text-xs text-cyan-300 whitespace-pre-wrap break-all">{f.fix}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de servicio ────────────────────────────────────
function ServiceCard({ name, data }) {
  const isOk = data?.status === 'ok';
  const isDegraded = data?.status === 'degraded';
  return (
    <div className={`rounded-xl border p-4 ${
      isOk ? 'bg-green-950/30 border-green-800/40' :
      isDegraded ? 'bg-yellow-950/30 border-yellow-800/40' :
      'bg-red-950/30 border-red-800/40'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{SERVICE_ICONS[name]}</span>
          <span className="text-white text-sm font-medium">{SERVICE_LABELS[name] || name}</span>
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium ${
          isOk ? 'text-green-400' : isDegraded ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {isOk ? <CheckCircle className="w-3.5 h-3.5" /> : isDegraded ? <AlertCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {isOk ? 'Operativo' : isDegraded ? 'Degradado' : 'Caído'}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        {data?.response_time_ms != null && (
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{data.response_time_ms}ms</span>
        )}
        {data?.checked_at && <span>{new Date(data.checked_at).toLocaleTimeString('es-CO')}</span>}
      </div>
      {data?.error && (
        <div className="mt-2 text-red-400 text-xs bg-red-950/50 rounded px-2 py-1 break-all">{data.error}</div>
      )}
    </div>
  );
}

export default function HealthMonitor() {
  const { token } = useAuth();
  const [status, setStatus] = useState({});
  const [history, setHistory] = useState([]);
  const [guardianReport, setGuardianReport] = useState(null);
  const [guardianHistory, setGuardianHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeTab, setActiveTab] = useState('services');

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/social/health`, { headers: authHeaders });
      const data = await res.json();
      setStatus(data && typeof data === 'object' && !data.error ? data : {});
      setLastRefresh(new Date());
    } catch {}
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: 30 });
      if (selectedService) params.set('service', selectedService);
      const res = await fetch(`${API}/api/social/health/history?${params}`, { headers: authHeaders });
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [token, selectedService]);

  // Fetch guardian reports from superadmin API
  const fetchGuardianReports = useCallback(async () => {
    try {
      // Try superadmin endpoint (requires SA token stored in sessionStorage)
      const saToken = sessionStorage.getItem('sa_token');
      if (!saToken) return;
      const [latestRes, histRes] = await Promise.all([
        fetch(`${SA_API}/api/sa/health-reports/latest`, { headers: { Authorization: `Bearer ${saToken}` } }),
        fetch(`${SA_API}/api/sa/health-reports?limit=10`, { headers: { Authorization: `Bearer ${saToken}` } })
      ]);
      if (latestRes.ok) {
        const latest = await latestRes.json();
        setGuardianReport(latest);
      }
      if (histRes.ok) {
        const hist = await histRes.json();
        setGuardianHistory(Array.isArray(hist) ? hist : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    fetchGuardianReports();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchHistory, fetchGuardianReports]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const allOk = Object.values(status).every(s => s?.status === 'ok');
  const downCount = Object.values(status).filter(s => s?.status === 'down').length;
  const hasGuardianReport = guardianReport && guardianReport.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Monitor de Salud</h1>
          <p className="text-gray-500 text-sm mt-0.5">Estado en tiempo real + análisis system-guardian</p>
        </div>
        <button
          onClick={() => { fetchStatus(); fetchHistory(); fetchGuardianReports(); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Semáforo del Guardian */}
      {hasGuardianReport && (
        <div className={`rounded-xl p-4 border ${
          guardianReport.status === 'healthy' ? 'bg-green-950/30 border-green-700/40' :
          guardianReport.status === 'warning' ? 'bg-yellow-950/30 border-yellow-700/40' :
          'bg-red-950/30 border-red-700/40'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <GuardianLight status={guardianReport.status} />
            <div className="flex gap-4 text-xs">
              <span className="text-red-400">🔴 {guardianReport.critical_count} críticos</span>
              <span className="text-yellow-400">🟡 {guardianReport.warning_count} avisos</span>
              <span className="text-green-400">🟢 {guardianReport.ok_count} OK</span>
            </div>
            <span className="text-gray-600 text-xs">
              Último análisis: {new Date(guardianReport.created_at).toLocaleString('es-CO')}
            </span>
          </div>
          {guardianReport.critical_count > 0 && (
            <p className="mt-2 text-xs text-red-300 bg-red-950/40 rounded-lg px-3 py-2">
              ⚠️ Hay {guardianReport.critical_count} problema(s) crítico(s). Ejecuta <code className="bg-gray-900 px-1 rounded">/system-guardian</code> para ver el análisis completo con fixes.
            </p>
          )}
        </div>
      )}

      {/* Estado global de servicios */}
      <div className={`rounded-xl p-4 border ${allOk ? 'bg-green-950/40 border-green-700/40' : 'bg-red-950/40 border-red-700/40'}`}>
        <div className="flex items-center gap-3">
          {allOk ? <CheckCircle className="w-6 h-6 text-green-400" /> : <XCircle className="w-6 h-6 text-red-400" />}
          <div>
            <div className={`font-semibold ${allOk ? 'text-green-300' : 'text-red-300'}`}>
              {allOk ? 'Todos los servicios operativos' : `${downCount} servicio(s) con problemas`}
            </div>
            {lastRefresh && (
              <div className="text-xs text-gray-500">Actualizado: {lastRefresh.toLocaleTimeString('es-CO')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
        {[
          { key: 'services', label: 'Servicios', icon: Activity },
          { key: 'guardian', label: 'Guardian Report', icon: Shield },
          { key: 'history', label: 'Historial', icon: Clock },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm transition-colors ${
              activeTab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab: Servicios */}
      {activeTab === 'services' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(SERVICE_LABELS).map(name => (
            <ServiceCard key={name} name={name} data={status[name]} />
          ))}
        </div>
      )}

      {/* Tab: Guardian Report */}
      {activeTab === 'guardian' && (
        <div className="space-y-4">
          {!hasGuardianReport ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
              <Shield className="w-8 h-8 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">Sin reportes del guardian aún</p>
              <p className="text-gray-600 text-xs mt-2">
                El sistema generará el primer análisis automáticamente en la próxima revisión programada.
              </p>
            </div>
          ) : (
            <>
              {/* Findings por categoría */}
              {guardianReport.findings && (
                <div className="space-y-3">
                  <FindingCategory
                    icon={Shield}
                    label="Seguridad"
                    findings={guardianReport.findings.security || []}
                  />
                  <FindingCategory
                    icon={Zap}
                    label="Rendimiento"
                    findings={guardianReport.findings.performance || []}
                  />
                  <FindingCategory
                    icon={Activity}
                    label="Funcionalidad"
                    findings={guardianReport.findings.functionality || []}
                  />
                  <FindingCategory
                    icon={Code}
                    label="Calidad de Código"
                    findings={guardianReport.findings.code_quality || []}
                  />
                </div>
              )}

              {/* Texto completo del reporte */}
              {guardianReport.report_text && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <h3 className="text-white text-sm font-medium mb-3">Reporte completo</h3>
                  <pre className="text-gray-400 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                    {guardianReport.report_text}
                  </pre>
                </div>
              )}

              {/* Historial de reportes del guardian */}
              {guardianHistory.length > 1 && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="text-white text-sm font-medium">Historial de análisis</h3>
                  </div>
                  <div className="divide-y divide-gray-800/50">
                    {guardianHistory.map(r => (
                      <div key={r.id} className="flex items-center px-4 py-3 gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          r.status === 'healthy' ? 'bg-green-500' :
                          r.status === 'warning' ? 'bg-yellow-400' : 'bg-red-500'
                        }`} />
                        <div className="flex-1 min-w-0 flex items-center gap-3 text-xs">
                          <span className="text-red-400">🔴 {r.critical_count}</span>
                          <span className="text-yellow-400">🟡 {r.warning_count}</span>
                          <span className="text-gray-500 ml-auto">{new Date(r.created_at).toLocaleString('es-CO')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Historial de servicios */}
      {activeTab === 'history' && (
        <div>
          <div className="flex justify-end mb-3">
            <select
              value={selectedService}
              onChange={e => setSelectedService(e.target.value)}
              className="bg-gray-800 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-gray-700 focus:outline-none"
            >
              <option value="">Todos los servicios</option>
              {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-center text-gray-500 py-8 text-sm">Cargando historial...</div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Servicio</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Tiempo resp.</th>
                    <th className="text-left px-4 py-3 text-gray-400 text-xs font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-600 text-xs">Sin historial aún</td></tr>
                  ) : history.map((h, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2 text-gray-300 text-xs">
                        {SERVICE_ICONS[h.service]} {SERVICE_LABELS[h.service] || h.service}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${
                          h.status === 'ok' ? 'text-green-400' : h.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {h.status === 'ok' ? '● Operativo' : h.status === 'degraded' ? '● Degradado' : '● Caído'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs">
                        {h.response_time_ms != null ? `${h.response_time_ms}ms` : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {new Date(h.checked_at).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
