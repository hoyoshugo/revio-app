import { useState, useEffect, createContext, useContext } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ModulesContext = createContext({ modules: [], hasModule: () => true, loaded: false });

export function ModulesProvider({ children }) {
  const [modules, setModules] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('revio_token') || localStorage.getItem('mystica_token');
    if (!token) { setLoaded(true); return; }

    fetch(API_BASE + '/api/modules/active', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then(r => (r.ok ? r.json() : { modules: [] }))
      .then(d => { setModules(d.modules || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  function hasModule(moduleId) {
    // Revenue Agent siempre activo — es el core del producto
    if (moduleId === 'revenue_agent') return true;
    // Si la tabla no existe todavía (módulos no configurados), permitir todo
    if (modules.length === 0) return true;
    return modules.some(m => m.id === moduleId);
  }

  return (
    <ModulesContext.Provider value={{ modules, hasModule, loaded }}>
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  return useContext(ModulesContext);
}

// Componente guard para rutas por módulo
export function RequireModule({ moduleId, children, fallback }) {
  const { hasModule, loaded } = useModules();
  if (!loaded) return null;
  if (!hasModule(moduleId)) {
    return fallback || (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h3 className="text-lg font-semibold mb-2">Módulo no disponible</h3>
          <p className="text-gray-400 text-sm">Este módulo no está incluido en tu plan.</p>
          <p className="text-gray-500 text-xs mt-2">Contacta a soporte para activarlo.</p>
        </div>
      </div>
    );
  }
  return children;
}
