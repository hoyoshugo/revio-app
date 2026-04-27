import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { AlzioIsotipo } from './ui/Logo.jsx';

/**
 * ErrorBoundary — catch errors in lazy routes / async components.
 *
 * E-AGENT-11 B-FE-1 (2026-04-26): antes un throw en cualquier componente
 * tumbaba toda la SPA a pantalla blanca. Ahora se captura, loguea y se
 * muestra un fallback amigable con CTA para reintentar.
 *
 * No usa Hooks — debe ser class component (React limitation con
 * componentDidCatch).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log estructurado para que se pueda buscar en consola
    console.error('[ErrorBoundary] Captured error:', {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
    });
    this.setState({ errorInfo });

    // Notificar via toast si está montado
    try {
      if (typeof window !== 'undefined' && window.alzioToast) {
        window.alzioToast(
          'Ocurrió un error inesperado. La página se reinicializó.',
          'error'
        );
      }
    } catch { /* silencioso */ }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/panel';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    const errorMessage = this.state.error?.message || 'Error desconocido';

    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-md text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <AlzioIsotipo size={48} />
          </div>

          {/* Icon */}
          <div
            className="inline-flex w-16 h-16 rounded-full items-center justify-center mb-4"
            style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)' }}
          >
            <AlertTriangle className="w-8 h-8" style={{ color: 'var(--danger)' }} />
          </div>

          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--text-1)' }}
          >
            Algo salió mal
          </h1>

          <p
            className="text-sm mb-6"
            style={{ color: 'var(--text-2)' }}
          >
            Encontramos un error inesperado. Tu sesión sigue activa, podés intentar de nuevo o volver al panel.
          </p>

          {/* Stack trace solo en dev */}
          {isDev && (
            <details
              className="text-left mb-4 p-3 rounded-lg"
              style={{
                background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
              }}
            >
              <summary
                className="text-xs font-medium cursor-pointer"
                style={{ color: 'var(--danger)' }}
              >
                Detalle técnico (solo dev)
              </summary>
              <pre
                className="text-[10px] mt-2 overflow-auto max-h-40"
                style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}
              >
                {errorMessage}
                {'\n\n'}
                {this.state.error?.stack}
                {'\n\nComponent stack:'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rv-btn-primary w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
              aria-label="Reintentar"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="rv-btn-outline w-full py-2.5 text-sm font-medium"
              aria-label="Recargar página"
            >
              Recargar página
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="text-xs underline mt-2"
              style={{ color: 'var(--text-3)' }}
              aria-label="Ir al panel"
            >
              ← Ir al panel principal
            </button>
          </div>

          <p
            className="text-xs mt-8"
            style={{ color: 'var(--text-3)' }}
          >
            Si el problema persiste, escribinos a hola@alzio.co
          </p>
        </div>
      </div>
    );
  }
}
