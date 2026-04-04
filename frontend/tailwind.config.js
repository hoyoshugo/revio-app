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
        // Revio design tokens (sync with CSS vars)
        rv: {
          bg:      '#0A0F1A',
          surface: '#131C2E',
          card:    '#1E2D4A',
          accent:  '#0ea5e9',
          cta:     '#0284c7',
          success: '#22c55e',
          danger:  '#ef4444',
          warning: '#f59e0b',
          text1:   '#E2E8F0',
          text2:   '#94A3B8',
          text3:   '#64748B',
          border:  '#1E293B',
        },
        // Legacy (keep for backward compat in existing components)
        mystica: {
          dark: '#131C2E',
          blue: '#0ea5e9',
          green: '#22c55e',
          light: '#7dd3fc',
        }
      },
      animation: {
        'fade-up':    'rv-fade-up 0.4s ease forwards',
        'fade-in':    'rv-fade-in 0.3s ease forwards',
        'float':      'rv-float 3s ease-in-out infinite',
        'pulse-ring': 'rv-pulse-ring 2s ease infinite',
        'shimmer':    'rv-shimmer 1.5s infinite',
        'spin-slow':  'spin 8s linear infinite',
      },
      backdropBlur: { xs: '4px' },
      boxShadow: {
        'rv':    '0 4px 24px rgba(14,165,233,0.12)',
        'rv-lg': '0 8px 48px rgba(14,165,233,0.18)',
        'rv-xl': '0 16px 64px rgba(14,165,233,0.24)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    }
  },
  plugins: []
};
