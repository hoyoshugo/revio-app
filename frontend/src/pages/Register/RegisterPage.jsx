/**
 * RegisterPage — Registro público de nuevos clientes Revio
 * Crea cuenta y redirige al wizard de onboarding
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check, ArrowRight, Building2 } from 'lucide-react';
import { RevioIsotipo, RevioWordmark } from '../../components/ui/Logo.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function StrengthBar({ password }) {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const colors = ['var(--danger)', 'var(--warning)', 'var(--warning)', 'var(--success)', 'var(--success)'];
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Excelente'];
  if (!password) return null;
  return (
    <div className="space-y-1 mt-1">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-colors"
            style={{ background: i < score ? colors[score] : 'var(--border)' }} />
        ))}
      </div>
      <p className="text-xs" style={{ color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: account info, 2: business info
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '', password: '', name: '',
    business_name: '', phone: '', plan: 'pro',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la cuenta');
      // Store temp token for onboarding
      sessionStorage.setItem('onboarding_token', data.token);
      sessionStorage.setItem('onboarding_tenant', JSON.stringify(data.tenant));
      navigate('/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const plans = [
    { key: 'basico',     name: 'Básico',     price: '299K', desc: '1 propiedad · WhatsApp ilimitado' },
    { key: 'pro',        name: 'Pro',         price: '599K', desc: 'Multi-OTA · Multi-PMS · Analytics avanzado', popular: true },
    { key: 'enterprise', name: 'Enterprise',  price: '1.199K', desc: 'Multi-propiedades · API · SLA 99.9%' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <Link to="/" className="flex items-center gap-2.5">
          <RevioIsotipo size={26} />
          <RevioWordmark size={14} />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm" style={{ color: 'var(--text-3)' }}>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" style={{ color: 'var(--accent)' }}>Ingresar</Link>
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
              <span>Paso {step} de 2</span>
              <span>{step === 1 ? 'Datos de acceso' : 'Tu negocio'}</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${step * 50}%`, background: 'var(--accent)' }} />
            </div>
          </div>

          <div className="rv-surface rounded-2xl p-6">
            <div className="mb-6">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-1)' }}>
                {step === 1 ? 'Crea tu cuenta Revio' : 'Cuéntanos sobre tu negocio'}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-2)' }}>
                {step === 1 ? '14 días gratis · Sin tarjeta de crédito' : 'Podrás cambiarlo después desde el panel'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nombre completo</label>
                    <input type="text" required value={form.name}
                      onChange={e => set('name', e.target.value)}
                      className="rv-input" placeholder="Juan Pérez" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Email</label>
                    <input type="email" required value={form.email}
                      onChange={e => set('email', e.target.value)}
                      className="rv-input" placeholder="juan@mihostal.co" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Contraseña</label>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} required
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        className="rv-input pr-10" placeholder="Mínimo 8 caracteres" minLength={8} />
                      <button type="button" onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-3)' }}>
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <StrengthBar password={form.password} />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                      <Building2 className="w-3.5 h-3.5 inline mr-1" />
                      Nombre de tu hostal/hotel
                    </label>
                    <input type="text" required value={form.business_name}
                      onChange={e => set('business_name', e.target.value)}
                      className="rv-input" placeholder="Hostal Los Andes" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>WhatsApp (con código de país)</label>
                    <input type="tel" value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      className="rv-input" placeholder="+57 300 000 0000" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Plan</label>
                    <div className="space-y-2">
                      {plans.map(p => (
                        <label key={p.key} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                          style={{
                            border: form.plan === p.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                            background: form.plan === p.key ? 'color-mix(in srgb, var(--accent) 5%, var(--card))' : 'var(--card)',
                          }}>
                          <input type="radio" name="plan" value={p.key} checked={form.plan === p.key}
                            onChange={() => set('plan', p.key)} className="sr-only" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{p.name}</span>
                              {p.popular && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>Popular</span>}
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{p.desc}</p>
                          </div>
                          <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>${p.price}K/mes</span>
                          {form.plan === p.key && <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="rv-btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
                {loading ? 'Creando cuenta...' : step === 1 ? (<>Continuar <ArrowRight className="w-4 h-4" /></>) : 'Crear mi cuenta gratis'}
              </button>

              {step === 2 && (
                <button type="button" onClick={() => setStep(1)}
                  className="w-full text-sm text-center" style={{ color: 'var(--text-3)' }}>
                  ← Volver
                </button>
              )}
            </form>
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
            Al registrarte aceptas los{' '}
            <a href="#" style={{ color: 'var(--accent)' }}>Términos de uso</a> y la{' '}
            <a href="#" style={{ color: 'var(--accent)' }}>Política de privacidad</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
