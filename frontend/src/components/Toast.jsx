/**
 * Toast — sistema de notificaciones global, sin dependencias externas.
 *
 * Uso desde cualquier componente:
 *   window.alzioToast('Guardado correctamente');           // success por default
 *   window.alzioToast('Error guardando: ' + msg, 'error'); // rojo
 *   window.alzioToast('Procesando...', 'info');            // azul
 *
 * Reemplaza window.alert() — todos los alert() del codebase legacy
 * tambien quedan capturados y se muestran como toasts.
 */
import React, { useEffect, useState, useRef } from 'react';

const COLORS = {
  success: { bg: '#10b981', icon: '✓' },
  error: { bg: '#ef4444', icon: '✕' },
  info: { bg: '#6366f1', icon: 'ℹ' },
  warn: { bg: '#f59e0b', icon: '⚠' },
};

let toastIdCounter = 0;

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    function pushToast(message, type = 'success') {
      const id = ++toastIdCounter;
      const t = { id, message: String(message || ''), type: COLORS[type] ? type : 'info' };
      setToasts((prev) => [...prev, t]);
      // Auto-dismiss tras 4.5s
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
        timersRef.current.delete(id);
      }, 4500);
      timersRef.current.set(id, timer);
    }

    // Detectar tipo basado en contenido del mensaje (heurística para alert legacy)
    function inferType(msg) {
      const s = String(msg || '').toLowerCase();
      if (s.includes('error') || s.includes('falló') || s.includes('fallo') || s.startsWith('❌')) return 'error';
      if (s.includes('conflicto') || s.includes('cuidado') || s.startsWith('⚠')) return 'warn';
      if (s.includes('procesando') || s.includes('cargando') || s.includes('enviando')) return 'info';
      return 'success';
    }

    // API global
    window.alzioToast = (msg, type) => pushToast(msg, type || inferType(msg));

    // Monkey-patch window.alert legacy para que use toast
    if (!window.__alzioOriginalAlert) {
      window.__alzioOriginalAlert = window.alert;
      window.alert = (msg) => pushToast(msg, inferType(msg));
    }

    return () => {
      // Cleanup timers solo si el componente realmente desmonta
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  function dismiss(id) {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 100000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const c = COLORS[t.type] || COLORS.info;
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            role="alert"
            style={{
              pointerEvents: 'auto',
              background: c.bg,
              color: 'white',
              padding: '12px 16px',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              fontSize: 13.5,
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              cursor: 'pointer',
              animation: 'alzioToastSlide 0.25s ease-out',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{c.icon}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <span style={{ opacity: 0.7, fontSize: 11, marginLeft: 4 }}>×</span>
          </div>
        );
      })}
      <style>{`@keyframes alzioToastSlide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
}
