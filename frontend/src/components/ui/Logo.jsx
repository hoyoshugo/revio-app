import React from 'react';

// Revio SVG isotipo
export function RevioIsotipo({ size = 32, className = '' }) {
  const s = size;
  return (
    <svg
      width={s} height={s}
      viewBox="0 0 44 44"
      fill="none"
      className={className}
      aria-label="Revio"
    >
      <rect width="44" height="44" rx="10" fill="#0ea5e9"/>
      <circle cx="22" cy="22" r="7" stroke="white" strokeWidth="2.5" fill="none"/>
      <path d="M22 15 L22 22 L27 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="22" cy="22" r="2" fill="white"/>
      <path d="M22 8 L22 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.2"/>
      <path d="M14 22 L30 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.2"/>
    </svg>
  );
}

// Wordmark: "rev" 400 + "io" 600 accent color
export function RevioWordmark({ size = 'md', className = '' }) {
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
        <span style={{ fontWeight: 400 }}>rev</span>
        <span style={{ fontWeight: 700, color: 'var(--accent)' }}>io</span>
      </span>
      <span
        className={`${sz.tagline} uppercase tracking-[0.12em] mt-0.5`}
        style={{ color: 'var(--text-3)' }}
      >
        Revenue intelligence · 3H Enterprise
      </span>
    </div>
  );
}

// Full logo: isotipo + wordmark
export function RevioLogo({ isoSize = 32, wordSize = 'md', className = '', gap = 'gap-3' }) {
  return (
    <div className={`flex items-center ${gap} ${className}`}>
      <RevioIsotipo size={isoSize} />
      <RevioWordmark size={wordSize} />
    </div>
  );
}
