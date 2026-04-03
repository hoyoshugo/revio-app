import React, { useState, useEffect } from 'react';
import { CheckCircle, ChevronRight, ChevronLeft, Loader } from 'lucide-react';
import { useSuperAdmin } from '../../context/SuperAdminContext.jsx';

const STEPS = ['Empresa', 'Plan', 'Propiedad', 'Usuario', 'Confirmar'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < current ? 'bg-green-500 text-white'
                : i === current ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-500'
            }`}>
              {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === current ? 'text-cyan-400' : 'text-gray-600'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-2 ${i < current ? 'bg-green-500' : 'bg-gray-800'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function OnboardingWizard() {
  const { saFetch } = useSuperAdmin();
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const [tenant, setTenant] = useState({
    business_name: '', slug: '', contact_email: '', contact_phone: '',
    contact_name: '', plan_id: '', trial_days: 14, billing_cycle: 'monthly'
  });
  const [property, setProperty] = useState({
    name: '', slug: '', whatsapp_number: '', lobby_pms_id: ''
  });
  const [user, setUser] = useState({
    name: '', email: '', password: '', role: 'admin'
  });
  const [sendWelcome, setSendWelcome] = useState(true);

  useEffect(() => {
    saFetch('/plans').then(r => r.json()).then(d => setPlans(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function autoSlug(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
  }

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      // Flatten nested objects into the flat shape the API expects
      const payload = {
        business_name: tenant.business_name,
        slug: tenant.slug,
        contact_email: tenant.contact_email,
        contact_phone: tenant.contact_phone,
        contact_name: tenant.contact_name,
        plan_id: tenant.plan_id || null,
        trial_days: tenant.trial_days,
        billing_cycle: tenant.billing_cycle,
        property_name: property.name,
        property_slug: property.slug,
        property_location: '',
        whatsapp_number: property.whatsapp_number,
        lobby_pms_id: property.lobby_pms_id,
        dashboard_email: user.email,
        dashboard_password: user.password,
        user_name: user.name,
        user_role: user.role,
        send_welcome: sendWelcome
      };
      const r = await saFetch('/onboarding', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al crear cliente');
      setDone(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white">¡Cliente creado!</h2>
        <p className="text-gray-400 text-sm text-center max-w-sm">
          {done.tenant?.business_name} ha sido registrado exitosamente.
          {sendWelcome && ' Se envió un mensaje de bienvenida por WhatsApp.'}
        </p>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-xs text-gray-400 space-y-1 w-full max-w-sm">
          <div>Tenant ID: <span className="text-white">{done.tenant?.id}</span></div>
          <div>Dashboard: <span className="text-cyan-400">{done.tenant?.dashboard_email}</span></div>
          <div>Contraseña: <span className="text-white">{done.tenant?.dashboard_password}</span></div>
        </div>
        <button
          onClick={() => { setDone(null); setStep(0); setTenant({ business_name: '', slug: '', contact_email: '', contact_phone: '', contact_name: '', plan_id: '', trial_days: 14, billing_cycle: 'monthly' }); }}
          className="bg-cyan-600 text-white rounded-lg px-6 py-2 text-sm hover:bg-cyan-500"
        >
          Registrar otro cliente
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Nuevo Cliente</h1>
        <p className="text-gray-500 text-sm mt-0.5">Wizard de onboarding</p>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <StepIndicator current={step} />

        {error && <div className="mb-4 text-red-400 text-xs bg-red-400/10 rounded-lg px-3 py-2">{error}</div>}

        {/* Step 0: Empresa */}
        {step === 0 && (
          <div className="space-y-3">
            <h3 className="text-white font-medium mb-4">Datos de la empresa</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre de la empresa *</label>
              <input value={tenant.business_name}
                onChange={e => setTenant(f => ({ ...f, business_name: e.target.value, slug: autoSlug(e.target.value) }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
                placeholder="Mística Hostels" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Slug (identificador único) *</label>
              <input value={tenant.slug} onChange={e => setTenant(f => ({ ...f, slug: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
                placeholder="mystica-hostels" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email de contacto *</label>
              <input type="email" value={tenant.contact_email} onChange={e => setTenant(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre contacto</label>
                <input value={tenant.contact_name} onChange={e => setTenant(f => ({ ...f, contact_name: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">WhatsApp</label>
                <input value={tenant.contact_phone} onChange={e => setTenant(f => ({ ...f, contact_phone: e.target.value }))}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
                  placeholder="+573001234567" />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Plan */}
        {step === 1 && (
          <div className="space-y-3">
            <h3 className="text-white font-medium mb-4">Plan y facturación</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Plan *</label>
              <select value={tenant.plan_id} onChange={e => setTenant(f => ({ ...f, plan_id: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500">
                <option value="">— Seleccionar plan —</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price_monthly}/mes</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ciclo de facturación</label>
              <select value={tenant.billing_cycle} onChange={e => setTenant(f => ({ ...f, billing_cycle: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500">
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Días de trial</label>
              <input type="number" min="0" max="90" value={tenant.trial_days}
                onChange={e => setTenant(f => ({ ...f, trial_days: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
        )}

        {/* Step 2: Propiedad */}
        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-white font-medium mb-4">Primera propiedad</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre de la propiedad *</label>
              <input value={property.name}
                onChange={e => setProperty(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
                placeholder="Hostel Centro" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Slug *</label>
              <input value={property.slug} onChange={e => setProperty(f => ({ ...f, slug: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">WhatsApp Business</label>
              <input value={property.whatsapp_number} onChange={e => setProperty(f => ({ ...f, whatsapp_number: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
                placeholder="+573001234567" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">LobbyPMS ID (opcional)</label>
              <input value={property.lobby_pms_id} onChange={e => setProperty(f => ({ ...f, lobby_pms_id: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
        )}

        {/* Step 3: Usuario */}
        {step === 3 && (
          <div className="space-y-3">
            <h3 className="text-white font-medium mb-4">Usuario administrador</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre *</label>
              <input value={user.name} onChange={e => setUser(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email *</label>
              <input type="email" value={user.email} onChange={e => setUser(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Contraseña temporal *</label>
              <input type="text" value={user.password} onChange={e => setUser(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500"
                placeholder="Mínimo 8 caracteres" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rol</label>
              <select value={user.role} onChange={e => setUser(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-cyan-500">
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 4: Confirmar */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-white font-medium mb-4">Confirmar y crear</h3>
            <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Empresa:</span><span className="text-white">{tenant.business_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Email:</span><span className="text-white">{tenant.contact_email}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Plan:</span><span className="text-white">{plans.find(p => p.id === tenant.plan_id)?.name || 'No seleccionado'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Trial:</span><span className="text-white">{tenant.trial_days} días</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Propiedad:</span><span className="text-white">{property.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Usuario:</span><span className="text-white">{user.email}</span></div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer bg-gray-800 rounded-xl p-4">
              <input type="checkbox" checked={sendWelcome} onChange={e => setSendWelcome(e.target.checked)} className="rounded" />
              <div>
                <div className="text-white text-sm font-medium">Enviar mensaje de bienvenida</div>
                <div className="text-gray-500 text-xs">WhatsApp al número de contacto del cliente</div>
              </div>
            </label>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 bg-gray-800 text-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-700">
              <ChevronLeft className="w-4 h-4" /> Atrás
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1 bg-cyan-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-cyan-500">
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading}
              className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-5 py-2 text-sm hover:bg-green-500 disabled:opacity-50">
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              {loading ? 'Creando...' : 'Crear cliente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
