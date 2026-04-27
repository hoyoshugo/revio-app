import React from 'react';

/**
 * AlzioIsotipo — símbolo de marca.
 *
 * Concepto: chevron stack ascendente sobre fondo gradient indigo→purple.
 * "Alzio" viene del italiano "alzare" (alzar/elevar). Los 3 chevrons
 * apilados representan ascenso/crecimiento — un visual signature único
 * y escalable. Render-perfect a 16px y a 256px.
 */
export function AlzioIsotipo({ size = 32, className = '' }) {
  const s = size;
  const id = React.useId().replace(/:/g, '');
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Alzio"
    >
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="0.55" stopColor="#6366F1" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id={`shine-${id}`} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#bg-${id})`} />
      <rect width="64" height="64" rx="16" fill={`url(#shine-${id})`} />
      {/* 3 chevrons ascendentes formando una pirámide visual */}
      <path
        d="M16 42 L32 30 L48 42"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
      <path
        d="M16 34 L32 22 L48 34"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      <path
        d="M16 26 L32 14 L48 26"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * AlzioWordmark — "Alz" semibold + "io" bold con accent color.
 * "io" en negrita y color accent (indigo) como anchor visual.
 * Tagline opcional debajo en uppercase tracking wide.
 */
export function AlzioWordmark({ size = 'md', className = '', showTagline = true }) {
  const sizes = {
    sm: { text: 'text-base', tagline: 'text-[9px]' },
    md: { text: 'text-xl', tagline: 'text-[10px]' },
    lg: { text: 'text-3xl', tagline: 'text-xs' },
    xl: { text: 'text-5xl', tagline: 'text-sm' },
  };
  const sz = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col ${className}`}>
      <span className={`${sz.text} leading-none tracking-tight`} style={{ color: 'var(--text-1)' }}>
        <span style={{ fontWeight: 600 }}>Alz</span>
        <span style={{ fontWeight: 800, color: 'var(--accent)' }}>io</span>
      </span>
      {showTagline && (
        <span
          className={`${sz.tagline} uppercase tracking-[0.14em] mt-1`}
          style={{ color: 'var(--text-3)' }}
        >
          Agente de ventas IA
        </span>
      )}
    </div>
  );
}

/**
 * AlzioLogo — composite isotipo + wordmark, alineados horizontalmente.
 */
export function AlzioLogo({ isoSize = 32, wordSize = 'md', className = '', gap = 'gap-3', showTagline = true }) {
  return (
    <div className={`flex items-center ${gap} ${className}`}>
      <AlzioIsotipo size={isoSize} />
      <AlzioWordmark size={wordSize} showTagline={showTagline} />
    </div>
  );
}
