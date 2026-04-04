import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      className={`
        relative w-9 h-9 rounded-xl flex items-center justify-center
        transition-all duration-200 hover:scale-105 active:scale-95
        ${className}
      `}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        color: 'var(--text-2)',
      }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: dark ? 1 : 0, transform: dark ? 'rotate(0deg)' : 'rotate(-90deg)' }}
      >
        <Moon className="w-4 h-4" style={{ color: 'var(--accent)' }} />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: dark ? 0 : 1, transform: dark ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        <Sun className="w-4 h-4" style={{ color: 'var(--warning)' }} />
      </span>
    </button>
  );
}
