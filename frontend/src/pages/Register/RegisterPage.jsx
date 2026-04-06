import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Check, ArrowRight, Building2, ChevronLeft } from 'lucide-react';
import { RevioIsotipo, RevioWordmark } from '../../components/ui/Logo.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STEPS = [
  { n: 1, label: 'Cuenta' },
  { n: 2, label: 'Propiedad' },
  { n: 3, label: 'Plan' },
  { n: 4, label: 'Habitación' },
  { n: 5, label: 'Finalizar' },
];

const PROPERTY_TYPES = [
  { id: 'hotel', label: 'Hotel', emoji: '🏨' },
  { id: 'hostel', label: 'Hostel', emoji: '🛏️' },
  { id: 'glamping', label: 'Glamping', emoji: '🏕️' },
  { id: 'cabin', label: 'Cabaña', emoji: '🏠' },
  { id: 'apartment', label: 'Apartamento', emoji: '🏢' },
  { id: 'beach_club', label: 'Beach Club', emoji: '🏖️' },
  { id: 'resort', label: 'Resort', emoji: '🌴' },
  { id: 'bnb', label: 'B&B', emoji: '☕' },
];

const PLANS = [
  {
    id: 'starter', name: 'Starter', monthly: 49, annual: 39, color: 'slate', popular: false,
    features: ['1 propiedad', '20 habitaciones', '3 usuarios', 'PMS + Canal Manager', 'Booking engine directo', 'Soporte por email'],
  },
  {
    id: 'professional', name: 'Professional', monthly: 99, annual: 79, color: 'indigo', popular: true,
    features: ['3 propiedades', '100 habitaciones', '10 usuarios', 'Todo de Starter', 'Billeteras NFC', 'AI Concierge (Claude)', 'POS Terminal', 'WhatsApp automático', 'Reportes avanzados'],
  },
  {
    id: 'enterprise', name: 'Enterprise', monthly: 299, annual: 239, color: 'slate', popular: false,
    features: ['Propiedades ilimitadas', 'Habitaciones ilimitadas', 'Usuarios ilimitados', 'Todo de Professional', 'Facturación electrónica DIAN', 'Acceso completo a API', 'Onboarding dedicado', 'Soporte 24/7'],
  },
];

function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-emerald-400', 'bg-emerald-500'];
  const labels = ['', 'Débil', 'Regular', 'Buena', 'Excelente'];
  if (!password) return null;
  return (
    <div className="space-y-1 mt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < score ? colors[score] : 'bg-slate-600'}`} />
        ))}
      </div>
      {score > 0 && (
        <p className="text-xs" style={{ color: score <= 1 ? '#EF4444' : score <= 2 ? '#F59E0B' : '#10B981' }}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

function ProgressBar({ step }) {
  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-4">
      <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto">
        {STEPS.map((s, idx) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
                step > s.n ? 'bg-indigo-600 text-white' :
                step === s.n ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/30' :
                'bg-slate-700 text-slate-400'
              }`}>
                {step > s.n ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <span className={`hidden sm:block text-xs font-medium ${step === s.n ? 'text-white' : 'text-slate-500'}`}>
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 max-w-[40px] transition-colors ${step > s.n ? 'bg-indigo-600' : 'bg-slate-700'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [planSelected, setPlanSelected] = useState('professional');
  const [invites, setInvites] = useState([{ email: '', role: 'receptionist' }]);

  const [form, setForm] = useState({
    // Step 1
    name: '', email: '', password: '', phone: '',
    // Step 2
    propertyName: '', propertyType: '', city: '',
    checkInTime: '15:00', checkOutTime: '12:00',
    // Step 4 (optional)
    roomTypeName: '', roomType: 'double', roomCapacity: 2, roomPrice: '',
    skipRoom: false,
  });

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const STEP_TITLES = {
    1: { title: 'Crea tu cuenta gratuita', sub: '30 días gratis · Sin tarjeta de crédito' },
    2: { title: 'Cuéntanos sobre tu propiedad', sub: 'Configuraremos tu espacio según el tipo' },
    3: { title: 'Elige tu plan', sub: 'Todos incluyen 30 días de prueba gratis. Sin tarjeta.' },
    4: { title: 'Añade tu primera habitación', sub: 'Puedes configurar más habitaciones después' },
    5: { title: '¡Ya casi terminamos!', sub: 'Opcional: invita a tu primer colaborador' },
  };

  function validateStep() {
    setError('');
    if (step === 1) {
      if (!form.name.trim()) return setError('El nombre es requerido'), false;
      if (!form.email.trim()) return setError('El email es requerido'), false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Email inválido'), false;
      if (!form.password || form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres'), false;
      return true;
    }
    if (step === 2) {
      if (!form.propertyName.trim()) return setError('El nombre de la propiedad es requerido'), false;
      if (!form.propertyType) return setError('Selecciona el tipo de propiedad'), false;
      if (!form.city.trim()) return setError('La ciudad es requerida'), false;
      return true;
    }
    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep(s => s + 1);
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const body = {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        business_name: form.propertyName,
        property_name: form.propertyName,
        property_type: form.propertyType,
        city: form.city,
        plan: planSelected,
        check_in_time: form.checkInTime,
        check_out_time: form.checkOutTime,
        ...(!form.skipRoom && form.roomTypeName ? {
          initial_room_type: {
            name: form.roomTypeName,
            type: form.roomType,
            capacity: form.roomCapacity,
            base_price: parseFloat(form.roomPrice) || 0,
          }
        } : {}),
        invites: invites.filter(i => i.email.trim()),
      };

      const res = await fetch(`${API}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear la cuenta');

      sessionStorage.setItem('onboarding_token', data.token);
      if (data.tenant) sessionStorage.setItem('onboarding_tenant', JSON.stringify(data.tenant));
      navigate('/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const { title, sub } = STEP_TITLES[step];

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

      {/* Progress */}
      <ProgressBar step={step} />

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>{title}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{sub}</p>
          </div>

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <div className="rv-surface rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nombre completo *</label>
                <input type="text" value={form.name} onChange={e => up('name', e.target.value)}
                  className="rv-input" placeholder="Juan Pérez" required />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Email *</label>
                <input type="email" value={form.email} onChange={e => up('email', e.target.value)}
                  className="rv-input" placeholder="juan@mihostal.co" required />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Contraseña *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => up('password', e.target.value)}
                    className="rv-input pr-10" placeholder="Mínimo 8 caracteres" />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <StrengthBar password={form.password} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>WhatsApp (opcional)</label>
                <input type="tel" value={form.phone} onChange={e => up('phone', e.target.value)}
                  className="rv-input" placeholder="+57 300 000 0000" />
              </div>
            </div>
          )}

          {/* ── STEP 2: Property ── */}
          {step === 2 && (
            <div className="rv-surface rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                  <Building2 className="w-3.5 h-3.5 inline mr-1" />
                  Nombre de tu propiedad *
                </label>
                <input type="text" value={form.propertyName} onChange={e => up('propertyName', e.target.value)}
                  className="rv-input" placeholder="Hostal Los Andes" required />
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>Tipo de propiedad *</label>
                <div className="grid grid-cols-4 gap-2">
                  {PROPERTY_TYPES.map(pt => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => up('propertyType', pt.id)}
                      className={`border-2 py-3 rounded-xl text-center cursor-pointer transition-all ${
                        form.propertyType === pt.id
                          ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--text-1)]'
                          : 'border-[var(--border)] text-[var(--text-3)] hover:border-[var(--text-3)]'
                      }`}
                    >
                      <div className="text-xl mb-1">{pt.emoji}</div>
                      <p className="text-xs font-medium">{pt.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Ciudad *</label>
                <input type="text" value={form.city} onChange={e => up('city', e.target.value)}
                  className="rv-input" placeholder="Cartagena, Colombia" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Check-in</label>
                  <input type="time" value={form.checkInTime} onChange={e => up('checkInTime', e.target.value)} className="rv-input" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Check-out</label>
                  <input type="time" value={form.checkOutTime} onChange={e => up('checkOutTime', e.target.value)} className="rv-input" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Plan ── */}
          {step === 3 && (
            <div className="space-y-4">
              {PLANS.map(plan => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanSelected(plan.id)}
                  className={`w-full text-left rounded-2xl p-5 border-2 transition-all ${
                    planSelected === plan.id
                      ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] ring-2 ring-[var(--accent)]/20'
                      : 'border-[var(--border)] hover:border-[var(--text-3)]'
                  }`}
                  style={{ background: planSelected === plan.id ? undefined : 'var(--card)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold" style={{ color: 'var(--text-1)' }}>{plan.name}</span>
                        {plan.popular && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {plan.features.slice(0, 4).map((f, i) => (
                          <span key={i} className="text-xs" style={{ color: 'var(--text-3)' }}>{f}</span>
                        ))}
                        {plan.features.length > 4 && (
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>+{plan.features.length - 4} más</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-2xl font-black" style={{ color: 'var(--text-1)' }}>${plan.monthly}</div>
                      <div className="text-xs" style={{ color: 'var(--text-3)' }}>USD/mes</div>
                    </div>
                  </div>
                </button>
              ))}
              <p className="text-center text-sm font-medium" style={{ color: 'var(--success)' }}>
                ✅ 30 días gratis en todos los planes
              </p>
            </div>
          )}

          {/* ── STEP 4: Room type (optional) ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rv-surface rounded-2xl p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nombre del tipo de habitación</label>
                  <input type="text" value={form.roomTypeName} onChange={e => up('roomTypeName', e.target.value)}
                    className="rv-input" placeholder="Ej: Habitación Doble, Cabaña Deluxe" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Tipo</label>
                    <select value={form.roomType} onChange={e => up('roomType', e.target.value)} className="rv-input w-full">
                      <option value="single">Individual</option>
                      <option value="double">Doble</option>
                      <option value="twin">Dos camas</option>
                      <option value="triple">Triple</option>
                      <option value="suite">Suite</option>
                      <option value="dorm">Dormitorio</option>
                      <option value="cabin">Cabaña</option>
                      <option value="tent">Carpa / Glamping</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Capacidad (personas)</label>
                    <input type="number" min={1} max={20} value={form.roomCapacity}
                      onChange={e => up('roomCapacity', parseInt(e.target.value) || 1)} className="rv-input" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Precio base por noche (COP)</label>
                  <input type="number" min={0} step={1000} value={form.roomPrice}
                    onChange={e => up('roomPrice', e.target.value)}
                    className="rv-input" placeholder="150000" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => { up('skipRoom', true); setStep(5); }}
                className="w-full text-sm py-2 text-center" style={{ color: 'var(--text-3)' }}
              >
                Saltaré este paso →
              </button>
            </div>
          )}

          {/* ── STEP 5: Finalize ── */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="rv-surface rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Invitar colaboradores (opcional)</h3>
                  <button
                    type="button"
                    onClick={() => setInvites(i => [...i, { email: '', role: 'receptionist' }])}
                    className="text-xs" style={{ color: 'var(--accent)' }}
                  >
                    + Agregar otro
                  </button>
                </div>
                {invites.map((inv, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2">
                    <input
                      type="email"
                      className="rv-input col-span-3 text-sm"
                      placeholder="email@colaborador.com"
                      value={inv.email}
                      onChange={e => {
                        const next = [...invites];
                        next[idx].email = e.target.value;
                        setInvites(next);
                      }}
                    />
                    <select
                      className="rv-input col-span-2 text-sm"
                      value={inv.role}
                      onChange={e => {
                        const next = [...invites];
                        next[idx].role = e.target.value;
                        setInvites(next);
                      }}
                    >
                      <option value="manager">Gerente</option>
                      <option value="receptionist">Recepcionista</option>
                      <option value="housekeeping">Housekeeping</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setInvites([{ email: '', role: 'receptionist' }])}
                  className="text-xs" style={{ color: 'var(--text-3)' }}
                >
                  Saltaré por ahora
                </button>
              </div>

              {error && (
                <div className="px-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="rv-btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creando tu cuenta...
                  </>
                ) : (
                  <>
                    Crear mi cuenta y entrar <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error (steps 1-4) */}
          {error && step < 5 && (
            <div className="px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => { setError(''); setStep(s => s - 1); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm border transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
            ) : (
              <div />
            )}

            {step < 5 && (
              <button
                type="button"
                onClick={nextStep}
                className="rv-btn-primary flex items-center gap-2 px-6 py-2.5"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
            Al registrarte aceptas los{' '}
            <Link to="/legal/terminos" style={{ color: 'var(--accent)' }}>Términos de uso</Link> y la{' '}
            <Link to="/legal/privacidad" style={{ color: 'var(--accent)' }}>Política de privacidad</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
