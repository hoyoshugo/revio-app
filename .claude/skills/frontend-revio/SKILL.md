---
name: frontend-revio
description: >
  Activar cuando se trabaja con el frontend de Revio en React/Vite/Tailwind:
  componentes del Dashboard, SuperAdmin panel, sistema de temas oscuro/claro,
  rutas protegidas, context providers, formularios o cuando se necesita
  modificar la UI.
triggers:
  - "frontend"
  - "react"
  - "componente"
  - "dashboard"
  - "ui"
  - "tailwind"
  - "tema"
  - "login page"
version: 1.0.0
project: revio
---

# Revio — Frontend

## Stack
- React 18 + Vite 5 + Tailwind CSS
- Puerto desarrollo: 5173
- Build output: `frontend/dist/` (servido por Express en producción)
- API URL: `VITE_API_URL` (build-time, via `.env.production`)

## Estructura de componentes

```
frontend/src/
├── components/
│   ├── Dashboard/               ← Panel del cliente (requireAuth)
│   │   ├── AiProviderSelector   ← Configurar Claude/GPT/Gemini
│   │   ├── BillingPanel         ← Facturación y planes
│   │   ├── ConfigPanel          ← Configuración general
│   │   ├── EscalationsPanel     ← Conversaciones escaladas
│   │   ├── HealthMonitor        ← Estado de integraciones
│   │   ├── KnowledgeBase        ← Gestión knowledge base (legacy)
│   │   ├── PropertyKnowledgePanel ← Knowledge base nueva
│   │   ├── RevenueIntelligence  ← Métricas de ingresos
│   │   └── SandboxPanel         ← Prueba del agente IA
│   └── SuperAdmin/              ← Panel Mística Tech
│       ├── GlobalDashboard      ← MRR, tenants, errores
│       ├── ClientsManager       ← CRUD de clientes
│       ├── PlansManager         ← CRUD de planes
│       └── ErrorsManager        ← Gestión de errores
├── context/
│   ├── AuthContext.jsx          ← Login/logout cliente, token JWT
│   └── SuperAdminContext.jsx    ← Login/logout superadmin
├── pages/
│   ├── Login/LoginPage.jsx
│   ├── Register/RegisterPage.jsx
│   ├── Onboarding/OnboardingWizard.jsx
│   └── Legal/LegalPage.jsx
└── App.jsx                      ← Router principal
```

## Rutas (React Router)

```jsx
// Públicas
/                    → LandingPage
/login               → LoginPage
/register            → RegisterPage
/legal               → LegalPage
/onboarding          → OnboardingWizard (post-registro)

// Protegidas (requireAuth)
/dashboard           → DashboardLayout + tabs

// SuperAdmin (requireSuperadminAuth)
/superadmin/login    → SuperAdminLogin
/superadmin          → SuperAdminLayout + tabs
```

## Context providers

### AuthContext.jsx
```jsx
const { user, token, login, logout, isLoading } = useAuth();

// login retorna { token, user: { id, email, role, property_id, tenant_id } }
// token se guarda en localStorage
```

### SuperAdminContext.jsx
```jsx
const { admin, token, login, logout } = useSuperAdmin();
// Usa /api/sa/login
```

## API URL pattern

Todos los componentes usan:
```jsx
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

En producción, `VITE_API_URL=https://revio-app-production.up.railway.app` se bake en el build via Dockerfile ARG.

## Sistema de temas

Tailwind dark mode via clase:
```jsx
// ThemeToggle.jsx
document.documentElement.classList.toggle('dark', isDark);
localStorage.setItem('theme', isDark ? 'dark' : 'light');
```

## Paleta de colores Revio

```css
/* Azul principal */
--revio-blue: #0EA5E9;   /* sky-500 */

/* Gradientes */
--gradient-hero: from-slate-900 via-blue-950 to-slate-900;

/* Tailwind clases frecuentes */
bg-sky-500, text-sky-400, border-sky-500/30
bg-slate-800, bg-slate-900, bg-slate-950
```

## Patrones de formularios

```jsx
// Fetch con manejo de estado
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  try {
    const res = await fetch(`${API}/api/endpoint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    // manejar éxito
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

## Comandos

```bash
# Desarrollo
cd frontend && npm run dev

# Build producción
cd frontend && npm run build

# Preview del build
cd frontend && npm run preview
```

## Errores frecuentes

| Error | Causa | Solución |
|-------|-------|---------|
| `VITE_API_URL undefined` en prod | No se bakeó en build | Verificar Dockerfile ARG antes de npm run build |
| Blank page en producción | SPA routing sin fallback | Express sirve index.html para rutas no-API |
| CORS en desarrollo | Backend en 3001, frontend en 5173 | Configurar origin en Express |
| `localStorage is not defined` | SSR intento | N/A — es CSR con Vite |
