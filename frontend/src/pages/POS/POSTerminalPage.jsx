import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import POSTerminal from '../../components/Dashboard/POSTerminal.jsx';

function Clock24() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-sm" style={{ color: 'var(--text-2)' }}>
      {time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export default function POSTerminalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Minimal POS header — 48px */}
      <header style={{
        height: 48,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)'
      }}>
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>
            Revio POS
          </span>
          {user?.property_name && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--card)', color: 'var(--text-2)' }}>
              {user.property_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Clock24 />
          {user && (
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {user.name || user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg"
            style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </header>

      {/* POS terminal — fills remaining 100vh - 48px */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <POSTerminal standalone />
      </div>
    </div>
  );
}
