import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';
import { RevioIsotipo } from '../ui/Logo.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';
import { Eye, EyeOff, Shield } from 'lucide-react';

export default function SuperAdminLogin() {
  const { login } = useSuperAdmin();
  const navigate  = useNavigate();
  const [form, setForm]   = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/superadmin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <header className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <RevioIsotipo size={28} />
          <span className="text-base font-normal" style={{ color: 'var(--text-1)' }}>
            rev<span className="font-bold" style={{ color: 'var(--accent)' }}>io</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' }}>
              Super Admin
            </span>
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rv-animate-up">
          <div className="text-center mb-8">
            <div
              className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4"
              style={{ background: 'color-mix(in srgb, var(--warning) 12%, var(--card))', border: '1px solid color-mix(in srgb, var(--warning) 25%, transparent)' }}
            >
              <Shield className="w-7 h-7" style={{ color: 'var(--warning)' }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>Mística Tech</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>Panel de administración del SaaS</p>
          </div>

          <form onSubmit={handleSubmit} className="rv-surface p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Email</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="rv-input"
                placeholder="admin@misticatech.co"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Contraseña</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="rv-input pr-10"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm rounded-xl px-3 py-2.5"
                style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="rv-btn w-full py-2.5 text-sm font-semibold text-white"
              style={{ background: 'color-mix(in srgb, var(--warning) 80%, #000)' }}>
              {loading ? 'Autenticando...' : 'Acceder'}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: 'var(--text-3)' }}>
            Acceso exclusivo — TRES HACHE ENTERPRISE SAS
          </p>
        </div>
      </div>
    </div>
  );
}
