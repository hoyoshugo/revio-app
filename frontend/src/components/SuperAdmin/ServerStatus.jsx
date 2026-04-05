import React, { useState, useEffect, useCallback } from 'react';
import {
  Server, Copy, CheckCircle, XCircle, RefreshCw, ExternalLink,
  AlertTriangle, Shield, Wifi, Globe, Clock, ArrowRight
} from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-lg transition-colors"
      style={{ color: copied ? 'var(--success)' : 'var(--text-3)', background: 'var(--card)' }}
      title="Copiar IP">
      {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatusBadge({ ok, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        background: `color-mix(in srgb, ${ok ? 'var(--success)' : 'var(--danger)'} 12%, transparent)`,
        color: ok ? 'var(--success)' : 'var(--danger)'
      }}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

export default function ServerStatus() {
  const { token } = useSuperAdmin();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/sa/server-ip`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const ipChanged = data && data.stored_ip && data.current_ip !== data.stored_ip;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
            <Server className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            Estado del Servidor
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
            IP de Railway y configuración de whitelist para integraciones externas
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="rv-btn-ghost text-xs flex items-center gap-1.5 px-3 py-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rv-surface p-4 flex items-center gap-2" style={{ color: 'var(--danger)' }}>
          <XCircle className="w-4 h-4" />
          <span className="text-sm">Error: {error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="rv-surface p-8 flex items-center justify-center gap-2" style={{ color: 'var(--text-3)' }}>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Detectando IP del servidor...</span>
        </div>
      )}

      {data && (
        <>
          {/* IP actual — card principal */}
          <div className="rv-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
                    IP actual del servidor Railway
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                    {data.current_ip || '—'}
                  </span>
                  {data.current_ip && <CopyButton text={data.current_ip} />}
                </div>
                {data.detected_at && (
                  <div className="flex items-center gap-1.5 mt-2" style={{ color: 'var(--text-3)' }}>
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">
                      Detectada: {new Date(data.detected_at).toLocaleString('es-CO')}
                    </span>
                    {data.change_count > 0 && (
                      <span className="text-xs ml-2">
                        · {data.change_count} cambio{data.change_count !== 1 ? 's' : ''} registrados
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                <StatusBadge ok={!ipChanged} label={ipChanged ? 'IP cambió' : 'IP estable'} />
                <StatusBadge ok={data.proxy_configured} label={data.proxy_configured ? 'Proxy activo' : 'Sin proxy'} />
              </div>
            </div>

            {/* IP anterior */}
            {data.previous_ip && (
              <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>IP anterior:</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
                  {data.previous_ip}
                </span>
                <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-3)' }} />
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}>
                  {data.current_ip}
                </span>
                {data.previous_detected_at && (
                  <span className="text-xs ml-auto" style={{ color: 'var(--text-3)' }}>
                    Cambió: {new Date(data.previous_detected_at).toLocaleString('es-CO')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Alerta si IP no está registrada */}
          {ipChanged && (
            <div className="rv-surface p-4 flex items-start gap-3"
              style={{ borderLeft: '3px solid var(--warning)', background: 'color-mix(in srgb, var(--warning) 6%, transparent)' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
                  La IP actual difiere de la registrada
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
                  La IP en Supabase es <code className="font-mono">{data.stored_ip}</code> pero el servidor reporta{' '}
                  <code className="font-mono">{data.current_ip}</code>. Esto ocurre cuando Railway redeploya entre
                  el registro y la consulta actual.
                </div>
              </div>
            </div>
          )}

          {/* Instrucciones LobbyPMS */}
          <div className="rv-surface overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                  Whitelist de LobbyPMS
                </span>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm space-y-1.5" style={{ color: 'var(--text-2)' }}>
                <p>
                  LobbyPMS restringe el acceso por IP. Railway usa <strong style={{ color: 'var(--warning)' }}>IPs rotativas</strong> —
                  la IP cambia con cada redeploy Y puede variar entre instancias del mismo servidor.
                </p>
                <p>
                  La solución definitiva es el <strong style={{ color: 'var(--text-1)' }}>Cloudflare Worker proxy</strong> (ver abajo).
                  Mientras tanto, puedes agregar la IP actual al whitelist como medida temporal.
                </p>
              </div>

              {/* Pasos */}
              <ol className="space-y-3">
                {[
                  { n: 1, text: 'Copiar la IP actual del servidor', action: data.current_ip ? <CopyButton text={data.current_ip} /> : null },
                  { n: 2, text: 'Ir a LobbyPMS → Configuración → API → Restricciones IP', action: (
                    <a href="https://app.lobbypms.com/settings/api" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
                      Abrir LobbyPMS <ExternalLink className="w-3 h-3" />
                    </a>
                  )},
                  { n: 3, text: `Agregar ${data.current_ip || '(IP actual)'} a la lista de IPs permitidas`, action: null },
                  { n: 4, text: 'Guardar cambios — el acceso se restablece inmediatamente', action: null },
                ].map(({ n, text, action }) => (
                  <li key={n} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                      {n}
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm flex-1" style={{ color: 'var(--text-2)' }}>{text}</span>
                      {action}
                    </div>
                  </li>
                ))}
              </ol>

              <a href="https://app.lobbypms.com/settings/api" target="_blank" rel="noopener noreferrer"
                className="rv-btn-primary text-sm inline-flex items-center gap-2 px-4 py-2">
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir LobbyPMS Whitelist
              </a>
            </div>
          </div>

          {/* Solución permanente: Cloudflare Worker */}
          <div className="rv-surface overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4" style={{ color: data.proxy_configured ? 'var(--success)' : 'var(--text-3)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                  Solución permanente: Cloudflare Worker Proxy
                </span>
                {data.proxy_configured ? (
                  <StatusBadge ok={true} label="Configurado" />
                ) : (
                  <StatusBadge ok={false} label="No configurado" />
                )}
              </div>
            </div>
            <div className="p-4 space-y-3 text-sm" style={{ color: 'var(--text-2)' }}>
              {data.proxy_configured ? (
                <p>
                  El proxy de Cloudflare está activo. Las IPs de Cloudflare Workers son estables
                  y no cambian con los redeploys de Railway. Solo necesitas whitelist las IPs de
                  Cloudflare una vez.
                </p>
              ) : (
                <>
                  <p>
                    Configura el Cloudflare Worker proxy para eliminar el problema de IP dinámica
                    <strong style={{ color: 'var(--text-1)' }}> de forma permanente</strong>. El worker
                    tiene IPs fijas de Cloudflare — solo configuras el whitelist una vez.
                  </p>
                  <div className="space-y-2">
                    <div className="font-medium text-xs" style={{ color: 'var(--text-1)' }}>Setup (5 min):</div>
                    <ol className="space-y-1.5 text-xs list-decimal list-inside" style={{ color: 'var(--text-2)' }}>
                      <li>Ir a <code>dash.cloudflare.com</code> → Workers & Pages → Create Worker</li>
                      <li>Pegar el código de <code>backend/cloudflare-proxy/lobbypms-proxy.js</code></li>
                      <li>Agregar variable de entorno: <code>LOBBYPMS_SECRET</code> (secreto compartido)</li>
                      <li>En Railway: agregar <code>LOBBYPMS_PROXY_URL</code> y <code>LOBBYPMS_PROXY_SECRET</code></li>
                      <li>En LobbyPMS: whitelist las IPs de Cloudflare (ver lista abajo)</li>
                    </ol>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)' }}>
                      Cloudflare Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                    <a href="https://www.cloudflare.com/ips-v4" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}>
                      IPs Cloudflare (v4) <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
