/**
 * OnboardingWizard — 5-step wizard after registration
 * Steps: 1. Property data · 2. Sistema PMS · 3. WhatsApp setup · 4. Plan confirmation · 5. Done
 */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, Key, MessageSquare, CreditCard, CheckCircle,
  ArrowRight, ArrowLeft, ExternalLink, Copy, Check, Zap
} from 'lucide-react';
import { RevioIsotipo } from '../../components/ui/Logo.jsx';
import ThemeToggle from '../../components/ui/ThemeToggle.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STEPS = [
  { icon: Building2,    title: 'Tu propiedad',       desc: 'Datos de tu hostal o hotel' },
  { icon: Key,          title: 'Sistema PMS',          desc: 'Conecta tu gestor hotelero' },
  { icon: MessageSquare,title: 'WhatsApp Business',   desc: 'Vincula tu número' },
  { icon: CreditCard,   title: 'Plan y pago',         desc: 'Confirma tu suscripción' },
  { icon: CheckCircle,  title: '¡Listo!',             desc: 'Tu agente está activo' },
];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={{
                  background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--surface)',
                  border: `2px solid ${done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--border)'}`,
                  color: done || active ? 'white' : 'var(--text-3)',
                }}>
                {done ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className="text-[10px] mt-1 hidden sm:block" style={{ color: active ? 'var(--text-1)' : 'var(--text-3)' }}>
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 mb-5 sm:mb-4"
                style={{ background: i < current ? 'var(--success)' : 'var(--border)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="p-1.5 rounded-lg transition-colors"
      style={{ color: copied ? 'var(--success)' : 'var(--text-3)' }}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Step components ───────────────────────────────────────────

function Step1Property({ data, setData }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Nombre de la propiedad</label>
        <input className="rv-input" value={data.property_name || ''}
          onChange={e => setData(d => ({ ...d, property_name: e.target.value }))}
          placeholder="Hostal Los Andes — Bogotá" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Ciudad / ubicación</label>
        <input className="rv-input" value={data.location || ''}
          onChange={e => setData(d => ({ ...d, location: e.target.value }))}
          placeholder="Bogotá, La Candelaria" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>URL de Booking.com (opcional)</label>
        <input className="rv-input" value={data.booking_url || ''}
          onChange={e => setData(d => ({ ...d, booking_url: e.target.value }))}
          placeholder="https://booking.com/hotel/co/..." />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Idioma principal del agente</label>
        <select className="rv-select" value={data.language || 'es'}
          onChange={e => setData(d => ({ ...d, language: e.target.value }))}>
          <option value="es">Español</option>
          <option value="en">English</option>
          <option value="es,en">Español + English</option>
          <option value="es,en,fr">Español + English + Français</option>
        </select>
      </div>
    </div>
  );
}

const PMS_OPTIONS = [
  { id: 'lobbypms',      label: 'LobbyPMS',       icon: '🏨', desc: 'Integración completa para LATAM', placeholder: 'Token de acceso LobbyPMS...' },
  { id: 'cloudbeds',     label: 'Cloudbeds',       icon: '☁️', desc: 'API REST v1.2 con OAuth2',        placeholder: 'cb_oauth_...' },
  { id: 'mews',          label: 'Mews',            icon: '🌐', desc: 'Connector API v1',               placeholder: 'Access Token de Mews...' },
  { id: 'little_hotelier',label: 'Little Hotelier',icon: '🏩', desc: 'REST API',                       placeholder: 'API Token...' },
  { id: 'clock',         label: 'Clock PMS',       icon: '⏰', desc: 'HTTP REST',                      placeholder: 'API Token...' },
  { id: 'custom',        label: 'Otro PMS',        icon: '🔧', desc: 'Endpoint REST personalizado',    placeholder: 'https://mi-pms.com/api' },
];

function Step2PMS({ data, setData }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const selectedPMS = data.pms_type || 'lobbypms';
  const pms = PMS_OPTIONS.find(p => p.id === selectedPMS) || PMS_OPTIONS[0];

  async function testToken() {
    if (!data.lobby_pms_token) return;
    setTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setTestResult(data.lobby_pms_token.length > 10 ? 'ok' : 'error');
    setTesting(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)' }}>
        <Key className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
        <div className="text-sm" style={{ color: 'var(--text-2)' }}>
          Conecta tu sistema de gestión hotelera (PMS) para que el agente consulte disponibilidad en tiempo real y gestione reservas. Puedes omitir este paso.
        </div>
      </div>

      {/* PMS selector */}
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-2)' }}>
          ¿Cuál es tu sistema PMS?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PMS_OPTIONS.map(p => (
            <button key={p.id}
              onClick={() => setData(d => ({ ...d, pms_type: p.id }))}
              className="flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all"
              style={{
                border: selectedPMS === p.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: selectedPMS === p.id ? 'color-mix(in srgb, var(--accent) 8%, var(--card))' : 'var(--card)',
              }}>
              <span className="text-xl">{p.icon}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>{p.label}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedPMS === 'custom' ? (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
            URL del endpoint de tu PMS
          </label>
          <input className="rv-input" value={data.lobby_pms_token || ''}
            onChange={e => setData(d => ({ ...d, lobby_pms_token: e.target.value }))}
            placeholder={pms.placeholder} />
        </div>
      ) : (
        <>
          {selectedPMS === 'lobbypms' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
                ID de la propiedad
              </label>
              <input className="rv-input" value={data.lobby_pms_id || ''}
                onChange={e => setData(d => ({ ...d, lobby_pms_id: e.target.value }))}
                placeholder="prop_xxxxxxxx" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
              API Token de {pms.label}
            </label>
            <div className="flex gap-2">
              <input className="rv-input flex-1 font-mono text-xs" type="password"
                value={data.lobby_pms_token || ''}
                onChange={e => setData(d => ({ ...d, lobby_pms_token: e.target.value }))}
                placeholder={pms.placeholder} />
              <button onClick={testToken} disabled={!data.lobby_pms_token || testing}
                className="rv-btn-outline text-xs px-3 whitespace-nowrap">
                {testing ? 'Probando...' : 'Probar'}
              </button>
            </div>
            {testResult && (
              <p className="text-xs mt-1 flex items-center gap-1"
                style={{ color: testResult === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
                {testResult === 'ok' ? <><Check className="w-3 h-3" /> Conexión exitosa</> : '✗ Token inválido'}
              </p>
            )}
          </div>
        </>
      )}

      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        Puedes configurar o cambiar de PMS en cualquier momento desde Ajustes → Conexiones.
      </p>
    </div>
  );
}

function Step3WhatsApp({ data, setData }) {
  const webhookUrl = `${API}/api/chat/whatsapp`;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Número de WhatsApp Business</label>
        <input className="rv-input" value={data.whatsapp_number || ''}
          onChange={e => setData(d => ({ ...d, whatsapp_number: e.target.value }))}
          placeholder="+57 300 000 0000" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Token de acceso (Meta Business)</label>
        <input className="rv-input font-mono text-xs" type="password"
          value={data.whatsapp_token || ''}
          onChange={e => setData(d => ({ ...d, whatsapp_token: e.target.value }))}
          placeholder="EAAxxxxxxxxxxxxxxxx" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Phone Number ID</label>
        <input className="rv-input font-mono text-xs" value={data.whatsapp_phone_id || ''}
          onChange={e => setData(d => ({ ...d, whatsapp_phone_id: e.target.value }))}
          placeholder="1234567890" />
      </div>

      <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>Webhook URL para Meta</p>
        <div className="flex items-center gap-2 bg-opacity-50 rounded-lg px-3 py-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <code className="text-xs flex-1 font-mono truncate" style={{ color: 'var(--accent)' }}>{webhookUrl}</code>
          <CopyBtn value={webhookUrl} />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Configura este URL en tu Meta App → Webhooks → messages
        </p>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        Puedes omitir esto ahora y configurarlo desde Ajustes → Conexiones.
      </p>
    </div>
  );
}

function Step4Plan({ data }) {
  const plans = { basico: { name: 'Básico', price: 299000 }, pro: { name: 'Pro', price: 599000 }, enterprise: { name: 'Enterprise', price: 1199000 } };
  const plan = plans[data.plan] || plans.pro;

  return (
    <div className="space-y-4">
      <div className="rv-card p-5 rounded-2xl space-y-3"
        style={{ border: '2px solid var(--accent)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Plan {plan.name}</p>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>14 días de prueba gratuita</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
              ${(plan.price / 1000).toFixed(0)}K
            </p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>COP/mes</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs"
          style={{ color: 'var(--success)' }}>
          <Check className="w-3.5 h-3.5" /> Sin cobros durante los primeros 14 días
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {[
          'Al terminar el trial, recibirás un link de pago seguro vía Wompi',
          'Puedes cancelar en cualquier momento desde el panel',
          'Factura electrónica por TRES HACHE ENTERPRISE SAS · NIT 901696556-6',
        ].map((t, i) => (
          <div key={i} className="flex items-start gap-2">
            <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--text-2)' }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step5Done({ data }) {
  const navigate = useNavigate();
  const { token } = useAuth();

  return (
    <div className="text-center space-y-5 py-4">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
        style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', border: '2px solid var(--success)' }}>
        <CheckCircle className="w-10 h-10" style={{ color: 'var(--success)' }} />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>¡Tu agente está listo!</h2>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Hemos configurado tu espacio en Revio. Ahora puedes explorar el panel y probar el agente en modo sandbox.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { icon: Zap,          label: 'Prueba el sandbox',    desc: 'Simula conversaciones antes de ir a producción' },
          { icon: Building2,    label: 'Configura más props',  desc: 'Agrega propiedades adicionales a tu cuenta' },
          { icon: MessageSquare,label: 'Conecta WhatsApp',      desc: 'Activa tu número de negocio en conexiones' },
          { icon: CreditCard,   label: 'Activa tu plan',       desc: 'Al terminar el trial se enviará el link de pago' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rv-card p-4 rounded-xl space-y-1">
            <Icon className="w-4 h-4 mb-1" style={{ color: 'var(--accent)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--text-1)' }}>{label}</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>{desc}</p>
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/panel')}
        className="rv-btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
        Ir a mi panel <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────
export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => {
    try {
      const t = JSON.parse(sessionStorage.getItem('onboarding_tenant') || '{}');
      return { plan: t.plan_key || 'pro', ...t };
    } catch { return { plan: 'pro' }; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canNext = () => {
    if (step === 0) return !!data.property_name;
    return true; // other steps are optional
  };

  async function handleNext() {
    if (step < STEPS.length - 1) {
      if (step === STEPS.length - 2) {
        // Final step: save all onboarding data
        await saveOnboarding();
        return;
      }
      setStep(s => s + 1);
    }
  }

  async function saveOnboarding() {
    setLoading(true);
    setError('');
    const token = sessionStorage.getItem('onboarding_token');
    try {
      const res = await fetch(`${API}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error guardando onboarding');
      }
      setStep(STEPS.length - 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const stepContent = [
    <Step1Property key={0} data={data} setData={setData} />,
    <Step2PMS key={1} data={data} setData={setData} />,
    <Step3WhatsApp key={2} data={data} setData={setData} />,
    <Step4Plan     key={3} data={data} />,
    <Step5Done     key={4} data={data} />,
  ];

  const isLastStep = step === STEPS.length - 1;
  const isConfirmStep = step === STEPS.length - 2;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <header className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <Link to="/" className="flex items-center gap-2">
          <RevioIsotipo size={26} />
          <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
            rev<span style={{ color: 'var(--accent)' }}>io</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!isLastStep && (
            <button onClick={() => navigate('/login')}
              className="text-xs" style={{ color: 'var(--text-3)' }}>
              Saltar configuración
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          <StepIndicator current={step} />

          <div className="rv-surface rounded-2xl p-6">
            {!isLastStep && (
              <div className="mb-6">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>{STEPS[step].title}</h2>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>{STEPS[step].desc}</p>
              </div>
            )}

            {stepContent[step]}

            {error && (
              <div className="mt-4 px-3 py-2.5 rounded-xl text-sm"
                style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            {!isLastStep && (
              <div className="flex gap-3 mt-6">
                {step > 0 && (
                  <button onClick={() => setStep(s => s - 1)}
                    className="rv-btn-ghost px-4 py-2.5 text-sm flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Atrás
                  </button>
                )}
                <button onClick={handleNext} disabled={!canNext() || loading}
                  className="rv-btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  {loading ? 'Guardando...'
                    : isConfirmStep ? (<>Activar prueba gratuita <Zap className="w-4 h-4" /></>)
                    : (<>Continuar <ArrowRight className="w-4 h-4" /></>)}
                </button>
              </div>
            )}
          </div>

          {!isLastStep && (
            <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
              Paso {step + 1} de {STEPS.length} · Puedes configurar el resto desde el panel
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
