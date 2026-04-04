/**
 * LandingPage — Revio · Revenue Intelligence
 * Diseño premium dark-first con Inter, gradientes y glassmorphism
 * 9 secciones: Hero · Problem · HowItWorks · Features · Integrations · Pricing · Testimonials · CTA · Footer
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';

// ─── Global CSS ───────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  .lp-root { font-family: 'Inter', system-ui, sans-serif; }

  .lp-grad { background: linear-gradient(135deg, #0ea5e9, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

  @keyframes lp-pulse { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.2);opacity:1} }
  .lp-pulse { animation: lp-pulse 2s ease-in-out infinite; }

  @keyframes lp-float { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-14px)} }
  .lp-float { animation: lp-float 4s ease-in-out infinite; }

  @keyframes lp-fade-up { from{transform:translateY(28px);opacity:0} to{transform:translateY(0);opacity:1} }
  .lp-fade-up { animation: lp-fade-up 0.65s ease forwards; }
  .lp-d1{animation-delay:.08s;opacity:0} .lp-d2{animation-delay:.18s;opacity:0}
  .lp-d3{animation-delay:.28s;opacity:0} .lp-d4{animation-delay:.38s;opacity:0}
  .lp-d5{animation-delay:.48s;opacity:0}

  @keyframes lp-pop { from{transform:scale(0.6) translateY(16px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
  .lp-pop { animation: lp-pop 0.5s cubic-bezier(.34,1.56,.64,1) forwards; }
  .lp-pop-d1{animation-delay:.5s;opacity:0} .lp-pop-d2{animation-delay:.75s;opacity:0} .lp-pop-d3{animation-delay:1s;opacity:0}

  .lp-card { transition: transform .25s ease, box-shadow .25s ease; }
  .lp-card:hover { transform: translateY(-5px); box-shadow: 0 24px 64px rgba(14,165,233,.12); }

  .lp-btn-grad { background: linear-gradient(135deg, #0ea5e9, #6366f1); color:#fff; border:none; transition: opacity .2s, transform .2s; }
  .lp-btn-grad:hover { opacity:.88; transform:translateY(-2px); }

  .lp-logo { transition: transform .2s, background .2s; }
  .lp-logo:hover { transform: scale(1.08); }

  .lp-nav-link { background:none; border:none; cursor:pointer; transition:color .2s; }
  .lp-nav-link:hover { color: #0ea5e9 !important; }
`;

// ─── Wave separators ─────────────────────────────────────────
const Wave = ({ dark, flip }) => (
  <div style={{ lineHeight: 0, overflow: 'hidden', transform: flip ? 'scaleY(-1)' : undefined }}>
    <svg viewBox="0 0 1440 72" style={{ display:'block', width:'100%' }} preserveAspectRatio="none">
      <path d="M0,36 C480,72 960,0 1440,36 L1440,72 L0,72 Z" fill={dark ? '#0a0f1e' : '#f8fafc'} />
    </svg>
  </div>
);

// ─── Navbar ───────────────────────────────────────────────────
function Navbar({ dark, toggleTheme, navigate }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  const scroll = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      height: 64, padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? (dark ? 'rgba(10,15,30,0.92)' : 'rgba(248,250,252,0.92)') : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
      transition: 'background .3s, border .3s',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={() => navigate('/')}>
        <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#0ea5e9,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>⚡</div>
        <span style={{ fontSize:18, fontWeight:900, color: dark ? '#f1f5f9' : '#0f172a' }}>rev<span className="lp-grad">io</span></span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:24 }}>
        {[['Funciones','lp-features'],['Precios','lp-pricing'],['Integraciones','lp-integrations']].map(([l,id]) => (
          <button key={id} className="lp-nav-link" onClick={() => scroll(id)}
            style={{ fontSize:14, fontWeight:500, color: dark ? '#94a3b8' : '#475569' }}>
            {l}
          </button>
        ))}
        <button onClick={toggleTheme} style={{
          width:34, height:34, borderRadius:8, border:'none', cursor:'pointer', fontSize:15,
          background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
        }}>{dark ? '☀️' : '🌙'}</button>
        <button className="lp-btn-grad" onClick={() => navigate('/panel')}
          style={{ padding:'8px 18px', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
          Ir al dashboard
        </button>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────
function Hero({ dark, navigate }) {
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '120px 32px 80px',
      background: dark
        ? 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(99,102,241,.18) 0%, transparent 65%), #0a0f1e'
        : 'radial-gradient(ellipse 90% 55% at 50% -5%, rgba(14,165,233,.09) 0%, transparent 65%), #f8fafc',
    }}>
      <div style={{ maxWidth:1180, margin:'0 auto', width:'100%', display:'grid', gridTemplateColumns:'1fr 1fr', gap:72, alignItems:'center' }}>

        {/* Copy */}
        <div>
          {/* Badge */}
          <div className="lp-fade-up lp-d1" style={{
            display:'inline-flex', alignItems:'center', gap:8, marginBottom:24,
            padding:'6px 16px', borderRadius:999,
            background: dark ? 'rgba(99,102,241,.14)' : 'rgba(14,165,233,.08)',
            border: `1px solid ${dark ? 'rgba(99,102,241,.35)' : 'rgba(14,165,233,.22)'}`,
          }}>
            <span className="lp-pulse" style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', display:'inline-block' }} />
            <span style={{ fontSize:13, fontWeight:700, color: dark ? '#a5b4fc' : '#0ea5e9' }}>Nuevo · Agente de IA para hoteles</span>
          </div>

          {/* H1 */}
          <h1 className="lp-fade-up lp-d2" style={{
            fontSize:'clamp(38px,5.5vw,68px)', fontWeight:900, lineHeight:1.08,
            color: dark ? '#f1f5f9' : '#0f172a', marginBottom:22, letterSpacing:'-0.02em',
          }}>
            Tu hotel lleno.<br /><span className="lp-grad">Tu agente nunca duerme.</span>
          </h1>

          <p className="lp-fade-up lp-d3" style={{
            fontSize:18, lineHeight:1.75, color: dark ? '#94a3b8' : '#64748b',
            marginBottom:36, maxWidth:490,
          }}>
            Revio cierra las ventas que tu marketing abre. IA entrenada para hoteles que responde, cotiza y confirma reservas — en WhatsApp, Booking, Instagram y más.
          </p>

          <div className="lp-fade-up lp-d4" style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:40 }}>
            <button className="lp-btn-grad" onClick={() => navigate('/register')}
              style={{ padding:'15px 30px', borderRadius:12, fontSize:16, fontWeight:800, cursor:'pointer' }}>
              Empieza gratis 14 días →
            </button>
            <button onClick={() => document.getElementById('lp-demo')?.scrollIntoView({ behavior:'smooth' })}
              style={{
                padding:'15px 28px', borderRadius:12, fontSize:16, fontWeight:600, cursor:'pointer',
                background:'transparent', color: dark ? '#94a3b8' : '#475569',
                border:`1.5px solid ${dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)'}`,
                transition:'all .2s',
              }}>
              Ver demo en vivo
            </button>
          </div>

          <div className="lp-fade-up lp-d5" style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
            {['✓ Sin tarjeta de crédito','✓ Cancela cuando quieras','✓ Setup en 15 min'].map(t => (
              <span key={t} style={{ fontSize:13, color: dark ? '#475569' : '#94a3b8', fontWeight:500 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="lp-float" style={{ position:'relative', display:'flex', justifyContent:'center' }}>
          <div style={{
            width:'100%', maxWidth:460, padding:22, borderRadius:20,
            background: dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.85)',
            backdropFilter:'blur(20px)',
            border:`1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`,
            boxShadow: dark ? '0 40px 120px rgba(99,102,241,.18)' : '0 40px 120px rgba(14,165,233,.1)',
          }}>
            {/* Window chrome */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:18 }}>
              {['#ff5f57','#ffbd2e','#28c840'].map(c => <div key={c} style={{ width:11,height:11,borderRadius:'50%',background:c }} />)}
              <div style={{ flex:1, height:22, borderRadius:6, background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:10, color: dark ? '#475569' : '#94a3b8' }}>revio.app/panel</span>
              </div>
            </div>
            {/* Metric grid */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
              {[
                { v:'24', l:'Conversaciones hoy', c:'#0ea5e9' },
                { v:'$4.2M', l:'Ingresos hoy', c:'#10b981' },
                { v:'38%', l:'Tasa conversión', c:'#6366f1' },
                { v:'11', l:'Reservas activas', c:'#f59e0b' },
              ].map(m => (
                <div key={m.l} style={{ padding:'10px 12px', borderRadius:10, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)', border:`1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'}` }}>
                  <div style={{ fontSize:20, fontWeight:900, color:m.c }}>{m.v}</div>
                  <div style={{ fontSize:10, color: dark ? '#64748b' : '#94a3b8', marginTop:1 }}>{m.l}</div>
                </div>
              ))}
            </div>
            {/* Chat preview */}
            <div style={{ padding:13, borderRadius:12, background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)', border:`1px solid ${dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)'}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#0ea5e9', marginBottom:8 }}>🤖 Revio AI · En vivo</div>
              {[
                { m:'¿Tienen habitación doble el 15 de mayo?', mine:true },
                { m:'¡Sí! Doble con baño $180K/noche. ¿Te la reservo? 🏡', mine:false },
                { m:'Perfecto, somos 2 personas.', mine:true },
              ].map((c,i) => (
                <div key={i} style={{ display:'flex', justifyContent:c.mine?'flex-end':'flex-start', marginBottom:5 }}>
                  <div style={{
                    padding:'5px 10px', borderRadius:10, fontSize:10, maxWidth:'75%',
                    background: c.mine ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : (dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'),
                    color: c.mine ? '#fff' : (dark ? '#cbd5e1' : '#475569'),
                  }}>{c.m}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating metric badges */}
          {[
            { l:'+34% reservas', c:'#10b981', cls:'lp-pop lp-pop-d1', style:{ top:-16, right:-24 } },
            { l:'24/7 activo', c:'#0ea5e9', cls:'lp-pop lp-pop-d2', style:{ top:'42%', left:-60 } },
            { l:'8 idiomas', c:'#6366f1', cls:'lp-pop lp-pop-d3', style:{ bottom:-14, right:-16 } },
          ].map(b => (
            <div key={b.l} className={b.cls} style={{
              position:'absolute', ...b.style,
              padding:'8px 15px', borderRadius:999, whiteSpace:'nowrap',
              background: dark ? 'rgba(10,15,30,.95)' : 'rgba(255,255,255,.97)',
              border:`1.5px solid ${b.c}45`,
              boxShadow:`0 8px 28px ${b.c}22`,
              fontSize:12, fontWeight:800, color:b.c,
            }}>{b.l}</div>
          ))}
        </div>
      </div>

      {/* Integration strip */}
      <div style={{ maxWidth:1180, margin:'64px auto 0', width:'100%', textAlign:'center' }}>
        <p style={{ fontSize:11, textTransform:'uppercase', letterSpacing:2, color: dark ? '#334155' : '#94a3b8', marginBottom:18 }}>Integrado con</p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          {['LobbyPMS','WhatsApp','Booking','Airbnb','Wompi'].map(n => (
            <div key={n} style={{
              padding:'7px 18px', borderRadius:8, fontSize:13, fontWeight:600,
              background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
              border:`1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'}`,
              color: dark ? '#64748b' : '#64748b',
            }}>{n}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problem ──────────────────────────────────────────────────
function Problem({ dark }) {
  const cards = [
    { problem:'2am. Un cliente pregunta. Nadie responde.', solution:'Revio responde en segundos, siempre.', icon:'🌙', c:'#6366f1' },
    { problem:'El cliente cotizó, dudó y reservó en otro lado.', solution:'Revio convence, negocia y cierra.', icon:'💡', c:'#0ea5e9' },
    { problem:'Integraste 5 canales. Cada uno es un mundo.', solution:'Revio centraliza todo en un dashboard.', icon:'🔗', c:'#10b981' },
  ];
  return (
    <section style={{ background: dark ? '#0a0f1e' : '#f8fafc', padding:'80px 32px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize:'clamp(26px,4vw,44px)', fontWeight:900, lineHeight:1.2, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:14, letterSpacing:'-0.01em' }}>
          El marketing llena la mente.<br /><span className="lp-grad">Revio llena las habitaciones.</span>
        </h2>
        <p style={{ textAlign:'center', fontSize:16, color: dark ? '#64748b' : '#94a3b8', marginBottom:56 }}>
          Cada reserva perdida costó dinero real. Nunca más.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:20 }}>
          {cards.map(c => (
            <div key={c.problem} className="lp-card" style={{
              padding:'28px 24px', borderRadius:16,
              background: dark ? 'rgba(255,255,255,.04)' : '#fff',
              border:`1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'}`,
            }}>
              <div style={{ fontSize:34, marginBottom:14 }}>{c.icon}</div>
              <p style={{ fontSize:15, fontWeight:500, color: dark ? '#94a3b8' : '#64748b', marginBottom:14, lineHeight:1.6, fontStyle:'italic' }}>
                "{c.problem}"
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:3, height:36, background:c.c, borderRadius:2, flexShrink:0 }} />
                <p style={{ fontSize:15, fontWeight:700, color:c.c, lineHeight:1.4 }}>{c.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────
function HowItWorks({ dark }) {
  const steps = [
    { icon:'📱', n:'1', title:'Cliente escribe', desc:'WhatsApp, Booking, Instagram, tu web', c:'#0ea5e9' },
    { icon:'🔍', n:'2', title:'Revio consulta', desc:'Disponibilidad real en tu PMS en tiempo real', c:'#6366f1' },
    { icon:'💬', n:'3', title:'Revio negocia', desc:'Cotiza, responde objeciones, ofrece upgrades', c:'#8b5cf6' },
    { icon:'✅', n:'4', title:'Reserva confirmada', desc:'Pago procesado. Tú solo ves el resultado.', c:'#10b981' },
  ];
  return (
    <section id="lp-demo" style={{ background: dark ? '#0d1424' : '#fff', padding:'80px 32px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:12, letterSpacing:'-0.01em' }}>
          De consulta a reserva en segundos
        </h2>
        <p style={{ textAlign:'center', fontSize:15, color: dark ? '#64748b' : '#94a3b8', marginBottom:60 }}>Sin intervención humana. Funciona de día, de noche y en 8 idiomas.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:20 }}>
          {steps.map(s => (
            <div key={s.n} style={{ textAlign:'center', padding:'24px 16px' }}>
              <div style={{ width:72, height:72, borderRadius:'50%', margin:'0 auto 16px', background:`${s.c}18`, border:`2px solid ${s.c}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>{s.icon}</div>
              <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1.5, color:s.c, marginBottom:6 }}>Paso {s.n}</div>
              <h3 style={{ fontSize:17, fontWeight:800, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:8 }}>{s.title}</h3>
              <p style={{ fontSize:13, color: dark ? '#64748b' : '#94a3b8', lineHeight:1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────
function Features({ dark }) {
  const items = [
    { icon:'🌍', t:'Agente IA multiidioma', d:'Español, inglés, francés, alemán, portugués y más' },
    { icon:'🏨', t:'Multi-PMS', d:'LobbyPMS, Cloudbeds, Mews y cualquier PMS custom' },
    { icon:'📡', t:'Omnicanal', d:'WhatsApp · Email · OTAs · Instagram · Facebook' },
    { icon:'💳', t:'Pagos automáticos', d:'Wompi, PayU, Stripe — cobra sin intervención' },
    { icon:'📊', t:'Dashboard real-time', d:'Métricas, conversiones y funnel en vivo' },
    { icon:'🛡️', t:'Anti no-shows', d:'Cancelaciones, depósitos y seguimiento auto' },
    { icon:'🧠', t:'Aprende solo', d:'Mejora con cada conversación y feedback' },
    { icon:'🎨', t:'White-label', d:'Tu marca, tu agente, tu identidad completa' },
  ];
  return (
    <section id="lp-features" style={{ background: dark ? '#0a0f1e' : '#f8fafc', padding:'80px 32px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:12, letterSpacing:'-0.01em' }}>
          Todo lo que necesitas,<br /><span className="lp-grad">ya incluido</span>
        </h2>
        <p style={{ textAlign:'center', fontSize:15, color: dark ? '#64748b' : '#94a3b8', marginBottom:52 }}>
          Sin add-ons. Sin sorpresas. Plan Pro incluye todo esto desde el día uno.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(230px,1fr))', gap:16 }}>
          {items.map(f => (
            <div key={f.t} className="lp-card" style={{
              padding:'22px 20px', borderRadius:14,
              background: dark ? 'rgba(255,255,255,.04)' : '#fff',
              border:`1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'}`,
            }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{f.icon}</div>
              <h3 style={{ fontSize:15, fontWeight:700, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:4 }}>{f.t}</h3>
              <p style={{ fontSize:13, color: dark ? '#64748b' : '#94a3b8', lineHeight:1.55 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Integrations ────────────────────────────────────────────
function Integrations({ dark }) {
  const logos = [
    { n:'LobbyPMS', e:'🏨' }, { n:'Cloudbeds', e:'☁️' }, { n:'Mews', e:'🌐' },
    { n:'WhatsApp', e:'💬' }, { n:'Booking.com', e:'🔵' }, { n:'Airbnb', e:'🏠' },
    { n:'Expedia', e:'✈️' }, { n:'Hostelworld', e:'🌎' }, { n:'Wompi', e:'💳' },
    { n:'PayU', e:'💰' }, { n:'Stripe', e:'⚡' }, { n:'Instagram', e:'📸' },
    { n:'Facebook', e:'👥' }, { n:'Google', e:'🔍' }, { n:'TripAdvisor', e:'🦉' },
    { n:'TikTok', e:'🎵' },
  ];
  return (
    <section id="lp-integrations" style={{ background: dark ? '#0d1424' : '#fff', padding:'80px 32px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize:'clamp(22px,3vw,36px)', fontWeight:900, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:10, letterSpacing:'-0.01em' }}>
          Se conecta con todo lo que ya usas
        </h2>
        <p style={{ textAlign:'center', fontSize:14, color: dark ? '#64748b' : '#94a3b8', marginBottom:48 }}>
          20+ integraciones nativas. Sin código adicional.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(125px,1fr))', gap:12 }}>
          {logos.map(l => (
            <div key={l.n} className="lp-logo" style={{
              padding:'14px 10px', borderRadius:12, textAlign:'center',
              background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)',
              border:`1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'}`,
              cursor:'default',
            }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{l.e}</div>
              <div style={{ fontSize:11, fontWeight:600, color: dark ? '#94a3b8' : '#64748b' }}>{l.n}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────
function Pricing({ dark, navigate }) {
  const [annual, setAnnual] = useState(false);
  const plans = [
    { k:'basico', n:'Básico', m:299000, c:'#64748b', feats:['1 propiedad','WhatsApp ilimitado','Agente IA multiidioma','Dashboard básico','Soporte email'] },
    { k:'pro', n:'Pro', m:599000, c:'#0ea5e9', popular:true, feats:['Propiedades ilimitadas','Multi-OTA + Multi-PMS','Analytics avanzado','Pagos automáticos','Escalaciones IA','Soporte prioritario'] },
    { k:'enterprise', n:'Enterprise', m:1199000, c:'#6366f1', feats:['Todo de Pro','SLA 99.9%','White-label completo','API directo','Onboarding dedicado','Manager de cuenta'] },
  ];
  return (
    <section id="lp-pricing" style={{ background: dark ? '#0a0f1e' : '#f8fafc', padding:'80px 32px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:14, letterSpacing:'-0.01em' }}>
          Planes y precios
        </h2>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, marginBottom:52 }}>
          <span style={{ fontSize:14, fontWeight: annual ? 400 : 700, color: annual ? (dark ? '#64748b' : '#94a3b8') : '#0ea5e9' }}>Mensual</span>
          <button onClick={() => setAnnual(!annual)} style={{
            width:48, height:26, borderRadius:999, border:'none', cursor:'pointer', position:'relative',
            background: annual ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : (dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'),
            transition:'background .25s',
          }}>
            <div style={{ position:'absolute', top:3, left: annual ? 25 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left .25s' }} />
          </button>
          <span style={{ fontSize:14, fontWeight: annual ? 700 : 400, color: annual ? '#0ea5e9' : (dark ? '#64748b' : '#94a3b8') }}>
            Anual <span style={{ color:'#10b981', fontWeight:800 }}>2 meses gratis</span>
          </span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px,1fr))', gap:20, alignItems:'start' }}>
          {plans.map(p => (
            <div key={p.k} className="lp-card" style={{
              padding:'28px 24px', borderRadius:20, position:'relative',
              background: p.popular
                ? (dark ? 'linear-gradient(160deg,rgba(14,165,233,.1),rgba(99,102,241,.1))' : 'linear-gradient(160deg,rgba(14,165,233,.05),rgba(99,102,241,.05))')
                : (dark ? 'rgba(255,255,255,.04)' : '#fff'),
              border: p.popular ? '2px solid rgba(14,165,233,.45)' : `1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'}`,
              transform: p.popular ? 'scale(1.03)' : undefined,
            }}>
              {p.popular && (
                <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', padding:'4px 18px', borderRadius:999, fontSize:12, fontWeight:800, background:'linear-gradient(135deg,#0ea5e9,#6366f1)', color:'#fff' }}>
                  ✨ Más popular
                </div>
              )}
              <h3 style={{ fontSize:20, fontWeight:900, color:p.c, marginBottom:6 }}>{p.n}</h3>
              <div style={{ marginBottom:22 }}>
                <span style={{ fontSize:38, fontWeight:900, color: dark ? '#f1f5f9' : '#0f172a', letterSpacing:'-0.02em' }}>
                  ${Math.round(p.m * (annual ? 10/12 : 1) / 1000).toLocaleString('es-CO')}K
                </span>
                <span style={{ fontSize:14, color: dark ? '#64748b' : '#94a3b8' }}>/mes</span>
                {annual && <div style={{ fontSize:12, color:'#10b981', fontWeight:700, marginTop:3 }}>Facturado anualmente</div>}
              </div>
              <ul style={{ listStyle:'none', padding:0, marginBottom:24, display:'flex', flexDirection:'column', gap:9 }}>
                {p.feats.map(f => (
                  <li key={f} style={{ fontSize:14, color: dark ? '#94a3b8' : '#475569', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ color:p.c, fontWeight:800 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button className={p.popular ? 'lp-btn-grad' : ''} onClick={() => navigate('/register')}
                style={{
                  width:'100%', padding:'12px', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer',
                  ...(p.popular ? {} : {
                    background:'transparent',
                    border:`1.5px solid ${dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)'}`,
                    color: dark ? '#94a3b8' : '#475569',
                  }),
                }}>
                Empezar gratis →
              </button>
            </div>
          ))}
        </div>

        <p style={{ textAlign:'center', marginTop:28, fontSize:13, color: dark ? '#475569' : '#94a3b8' }}>
          +$149.000/mes por propiedad adicional en Básico · +$249.000/mes en Pro
        </p>
        <div style={{
          marginTop:28, padding:'15px 24px', borderRadius:12, textAlign:'center',
          background: dark ? 'rgba(16,185,129,.08)' : 'rgba(16,185,129,.06)',
          border:'1px solid rgba(16,185,129,.22)',
          fontSize:14, fontWeight:700, color:'#10b981',
        }}>
          14 días gratis · Sin tarjeta · Cancela cuando quieras
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ────────────────────────────────────────────
function Testimonials({ dark }) {
  const ts = [
    { n:'Valentina R.', p:'Hostal Los Andes, Bogotá', t:'En el primer mes recuperamos 8 reservas que antes perdíamos por la noche. Revio se pagó solo en semana 2.', s:5 },
    { n:'Camilo M.', p:'El Nido Hostel, Medellín', t:'El agente habla mejor inglés que nosotros. Los huéspedes extranjeros se sienten en casa desde el primer mensaje.', s:5 },
    { n:'Sofía L.', p:'Tayrona Backpackers', t:'Configuración en 15 minutos. Al día siguiente ya teníamos 3 reservas confirmadas por WhatsApp. Increíble.', s:5 },
  ];
  return (
    <section style={{ background: dark ? '#0d1424' : '#fff', padding:'80px 32px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize:'clamp(22px,3vw,36px)', fontWeight:900, color: dark ? '#f1f5f9' : '#0f172a', marginBottom:8, letterSpacing:'-0.01em' }}>
          Lo que dicen nuestros primeros clientes
        </h2>
        <p style={{ textAlign:'center', fontSize:13, color:'#64748b', marginBottom:48 }}>
          Beta testers — Programa de acceso anticipado
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px,1fr))', gap:20 }}>
          {ts.map(t => (
            <div key={t.n} className="lp-card" style={{
              padding:'26px', borderRadius:16,
              background: dark ? 'rgba(255,255,255,.04)' : '#fff',
              border:`1px solid ${dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'}`,
            }}>
              <div style={{ color:'#f59e0b', fontSize:16, marginBottom:12 }}>{'★'.repeat(t.s)}</div>
              <p style={{ fontSize:15, lineHeight:1.7, color: dark ? '#cbd5e1' : '#475569', marginBottom:16 }}>"{t.t}"</p>
              <div>
                <div style={{ fontSize:14, fontWeight:800, color: dark ? '#f1f5f9' : '#0f172a' }}>{t.n}</div>
                <div style={{ fontSize:12, color: dark ? '#64748b' : '#94a3b8' }}>{t.p}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Final ───────────────────────────────────────────────
function CTAFinal({ navigate }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCount(c => { if (c >= 14) { clearInterval(t); return c; } return c + 1; }), 60);
    return () => clearInterval(t);
  }, []);
  return (
    <section style={{ background:'linear-gradient(135deg, #080f22 0%, #0f172a 60%, #080e20 100%)', padding:'100px 32px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:600, height:400, borderRadius:'50%', background:'radial-gradient(ellipse, rgba(99,102,241,.14) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ maxWidth:680, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
        <div style={{ fontSize:52, marginBottom:20 }}>🚀</div>
        <h2 style={{ fontSize:'clamp(28px,4.5vw,50px)', fontWeight:900, color:'#f1f5f9', marginBottom:16, lineHeight:1.15, letterSpacing:'-0.02em' }}>
          ¿Listo para llenar tu hotel con IA?
        </h2>
        <p style={{ fontSize:18, color:'#94a3b8', lineHeight:1.75, marginBottom:40 }}>
          Únete a los primeros hoteles en Latinoamérica con un agente de ventas que nunca duerme.
        </p>
        <button className="lp-btn-grad" onClick={() => navigate('/register')}
          style={{ padding:'18px 44px', borderRadius:14, fontSize:18, fontWeight:900, cursor:'pointer', marginBottom:24 }}>
          Empieza gratis ahora →
        </button>
        <br />
        <div style={{
          display:'inline-flex', alignItems:'center', gap:10, padding:'12px 26px', borderRadius:999,
          background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.25)',
          fontSize:15, fontWeight:800, color:'#10b981',
        }}>
          ⏱ {count} días de prueba gratis — sin tarjeta de crédito
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────
function Footer({ dark, toggleTheme }) {
  const navigate = useNavigate();
  return (
    <footer style={{ background: dark ? '#06090f' : '#0f172a', padding:'60px 32px 28px', color:'#64748b' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:40, marginBottom:48 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <div style={{ width:28, height:28, borderRadius:6, background:'linear-gradient(135deg,#0ea5e9,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
              <span style={{ fontSize:16, fontWeight:900, color:'#f1f5f9' }}>rev<span className="lp-grad">io</span></span>
            </div>
            <p style={{ fontSize:13, lineHeight:1.7, color:'#475569' }}>El agente de ventas IA para hoteles de Latinoamérica.</p>
            <div style={{ marginTop:14, display:'flex', gap:8 }}>
              {['𝕏','in','📸','📘'].map(s => (
                <div key={s} style={{ width:30, height:30, borderRadius:6, background:'rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, cursor:'pointer' }}>{s}</div>
              ))}
            </div>
          </div>
          {[
            { t:'Producto', l:['Funciones','Precios','Docs','Blog'] },
            { t:'Soporte', l:['Contacto','Status','Changelog'] },
            { t:'Legal', l:['Términos','Privacidad','Cookies'] },
          ].map(col => (
            <div key={col.t}>
              <h4 style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:1.5, color:'#94a3b8', marginBottom:14 }}>{col.t}</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {col.l.map(l => (
                  <span key={l} style={{ fontSize:13, cursor:'pointer', transition:'color .2s' }}
                    onMouseEnter={e => e.currentTarget.style.color='#94a3b8'}
                    onMouseLeave={e => e.currentTarget.style.color='#475569'}>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,.06)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div style={{ fontSize:12, color:'#334155' }}>
            © 2026 Revio · <strong style={{ color:'#475569' }}>TRES HACHE ENTERPRISE SAS</strong> · NIT 901696556-6 · info@treshache.co
          </div>
          <button onClick={toggleTheme} style={{
            padding:'6px 14px', borderRadius:6, border:'1px solid rgba(255,255,255,.08)', background:'rgba(255,255,255,.04)',
            cursor:'pointer', fontSize:12, color:'#64748b',
          }}>
            {dark ? 'Modo claro ☀️' : 'Modo oscuro 🌙'}
          </button>
        </div>
      </div>
    </footer>
  );
}

// ─── Root export ─────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { dark, toggle: toggleTheme } = useTheme();

  return (
    <div className="lp-root" style={{ background: dark ? '#0a0f1e' : '#f8fafc' }}>
      <style>{GLOBAL_STYLE}</style>
      <Navbar dark={dark} toggleTheme={toggleTheme} navigate={navigate} />
      <Hero dark={dark} navigate={navigate} />
      <Wave dark={!dark} flip />
      <Problem dark={dark} />
      <Wave dark={dark} />
      <HowItWorks dark={dark} />
      <Wave dark={!dark} flip />
      <Features dark={dark} />
      <Wave dark={dark} />
      <Integrations dark={dark} />
      <Wave dark={!dark} flip />
      <Pricing dark={dark} navigate={navigate} />
      <Wave dark={dark} />
      <Testimonials dark={dark} />
      <CTAFinal navigate={navigate} />
      <Footer dark={dark} toggleTheme={toggleTheme} />
    </div>
  );
}
