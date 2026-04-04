import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext.jsx';
import { RevioIsotipo } from '../ui/Logo.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('/api/dashboard/login', { email, password });
      login(data.token, data.user);
      navigate('/panel');
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <RevioIsotipo size={28} />
          <span className="text-base font-normal tracking-tight" style={{ color: 'var(--text-1)' }}>
            rev<span className="font-bold" style={{ color: 'var(--accent)' }}>io</span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rv-animate-up">

          {/* Icon */}
          <div className="text-center mb-8">
            <div
              className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 rv-glow"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--card))' }}
            >
              <RevioIsotipo size={32} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
              Accede a tu panel
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
              Revenue intelligence · by 3H Enterprise
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="rv-surface p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="rv-input"
                placeholder="tu@empresa.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="rv-input pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-3)' }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-sm rounded-xl px-3 py-2.5"
                style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rv-btn-primary w-full py-2.5 text-sm font-semibold"
            >
              {loading ? 'Ingresando...' : 'Ingresar al panel'}
            </button>

            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              ¿Nuevo en Revio?
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <Link
              to="/register"
              className="rv-btn-outline w-full py-2.5 text-sm font-medium"
            >
              Empieza gratis 14 días
            </Link>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
            TRES HACHE ENTERPRISE SAS · NIT 901696556-6
          </p>
        </div>
      </div>
    </div>
  );
}
