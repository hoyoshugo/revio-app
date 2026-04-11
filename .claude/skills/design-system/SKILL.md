---
name: design-system
description: Sistema de diseño profesional para Revio. Usa cuando diseñes cualquier componente UI, landing page, dashboard o elemento visual. Tokens exactos (dark mode obligatorio).
triggers:
  - diseño
  - componente
  - UI
  - dashboard
  - landing
  - responsive
version: 2.0.0
---

# Revio Design System

## Paleta (dark mode default)
```css
--bg-primary: #0A0F1A       /* Fondo principal */
--bg-surface: #131C2E       /* Cards y panels */
--bg-elevated: #1E293B      /* Hover / elevated */
--border: #1E293B
--accent: #0ea5e9           /* Azul marca */
--accent-hover: #0284c7
--success: #22c55e
--warning: #f59e0b
--error: #ef4444
--text-primary: #f1f5f9
--text-secondary: #94a3b8
--text-muted: #64748b
```

## Tipografía
- Font: Inter / system-ui
- Títulos: font-weight 600, letter-spacing -0.02em
- Body: font-weight 400, line-height 1.6
- Mono: JetBrains Mono (tokens, keys, code)

## Espaciado (8px grid)
xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48

## Border radius
sm 8 · md 12 · lg 16 · xl 20 · full 9999

## Componentes base

### Card
```jsx
<div className="bg-[#131C2E] border border-[#1E293B] rounded-2xl p-5 hover:border-[#0ea5e9]/30 transition-colors">
```

### Botón primario
```jsx
<button className="px-4 py-2.5 bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-medium rounded-xl transition-colors">
```

### Input
```jsx
<input className="w-full bg-[#0A0F1A] border border-[#1E293B] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#64748b] focus:border-[#0ea5e9] focus:outline-none" />
```

### Badges de estado
- production: `bg-green-900/40 border-green-700 text-green-300`
- beta: `bg-blue-900/40 border-blue-700 text-blue-300`
- development: `bg-yellow-900/40 border-yellow-700 text-yellow-300`
- planned: `bg-gray-800 border-gray-700 text-gray-400`

## Reglas
1. NUNCA fondo blanco
2. Dark mode default, light mode opcional
3. `transition-all duration-200` en interacciones
4. Loading: skeleton `animate-pulse`
5. Empty state: ilustración SVG + mensaje
6. Mobile-first (375px) luego escalar
7. Touch targets ≥ 44×44 en móvil
