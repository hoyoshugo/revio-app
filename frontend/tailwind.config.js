/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Alzio design tokens (canon — indigo). Mantengo `rv:` namespace
        // por backward compat con componentes existentes; las CSS vars
        // viven en index.css y son la source of truth.
        rv: {
          bg: '#0A0F1A',
          surface: '#131C2E',
          card: '#1E2D4A',
          accent: '#6366F1', // indigo Alzio (era #0ea5e9 cyan Mística)
          cta: '#4F46E5',    // indigo darker
          success: '#22c55e',
          danger: '#ef4444',
          warning: '#f59e0b',
          text1: '#E2E8F0',
          text2: '#94A3B8',
          text3: '#64748B',
          border: '#1E293B',
        },
        // E-AGENT-11 H-FE-3 (2026-04-26): legacy `mystica-*` repuntado al
        // canon indigo Alzio. Antes apuntaba a #0ea5e9 cyan que no
        // resolvía contra el theme actual y dejaba texto invisible en
        // ConfigPanel, KnowledgeBase, ConversationList, etc. (~50 usos).
        // Mantenemos los nombres como aliases para no tener que reescribir
        // cada componente; el rebrand es solo de paleta.
        mystica: {
          dark: '#131C2E',
          blue: '#6366F1',  // indigo Alzio (antes #0ea5e9)
          green: '#22c55e',
          light: '#A5B4FC', // indigo-300 (antes sky-300)
        },
      },
      animation: {
        'fade-up': 'rv-fade-up 0.4s ease forwards',
        'fade-in': 'rv-fade-in 0.3s ease forwards',
        float: 'rv-float 3s ease-in-out infinite',
        'pulse-ring': 'rv-pulse-ring 2s ease infinite',
        shimmer: 'rv-shimmer 1.5s infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      backdropBlur: { xs: '4px' },
      boxShadow: {
        rv: '0 4px 24px rgba(14,165,233,0.12)',
        'rv-lg': '0 8px 48px rgba(14,165,233,0.18)',
        'rv-xl': '0 16px 64px rgba(14,165,233,0.24)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
