const COLOR_MAPS = {
  reservation: {
    confirmed:   'bg-indigo-500/15 text-indigo-400',
    checked_in:  'bg-emerald-500/15 text-emerald-400',
    checked_out: 'bg-slate-500/15 text-slate-400',
    pending:     'bg-amber-500/15 text-amber-400',
    cancelled:   'bg-red-500/15 text-red-400',
    no_show:     'bg-rose-500/15 text-rose-400',
    draft:       'bg-slate-500/15 text-slate-400',
  },
  payment: {
    paid:      'bg-emerald-500/15 text-emerald-400',
    pending:   'bg-amber-500/15 text-amber-400',
    partial:   'bg-blue-500/15 text-blue-400',
    refunded:  'bg-purple-500/15 text-purple-400',
    failed:    'bg-red-500/15 text-red-400',
  },
  room: {
    available:   'bg-emerald-500/15 text-emerald-400',
    occupied:    'bg-indigo-500/15 text-indigo-400',
    dirty:       'bg-amber-500/15 text-amber-400',
    maintenance: 'bg-red-500/15 text-red-400',
    blocked:     'bg-slate-500/15 text-slate-400',
    cleaning:    'bg-blue-500/15 text-blue-400',
  },
  housekeeping: {
    pending:     'bg-amber-500/15 text-amber-400',
    in_progress: 'bg-indigo-500/15 text-indigo-400',
    done:        'bg-emerald-500/15 text-emerald-400',
    verified:    'bg-purple-500/15 text-purple-400',
    skipped:     'bg-slate-500/15 text-slate-400',
  },
  wallet: {
    active:   'bg-emerald-500/15 text-emerald-400',
    frozen:   'bg-amber-500/15 text-amber-400',
    expired:  'bg-slate-500/15 text-slate-400',
    refunded: 'bg-purple-500/15 text-purple-400',
  },
  event: {
    upcoming:  'bg-blue-500/15 text-blue-400',
    active:    'bg-emerald-500/15 text-emerald-400',
    completed: 'bg-slate-500/15 text-slate-400',
    cancelled: 'bg-red-500/15 text-red-400',
  },
};

const LABELS = {
  confirmed: 'Confirmada', checked_in: 'En casa', checked_out: 'Salió',
  pending: 'Pendiente', cancelled: 'Cancelada', no_show: 'No show',
  draft: 'Borrador', paid: 'Pagado', partial: 'Parcial',
  refunded: 'Reembolsado', failed: 'Fallido', available: 'Disponible',
  occupied: 'Ocupada', dirty: 'Sucia', maintenance: 'Mantenimiento',
  blocked: 'Bloqueada', cleaning: 'Limpieza', in_progress: 'En progreso',
  done: 'Listo', verified: 'Verificado', active: 'Activa',
  frozen: 'Congelada', expired: 'Expirada', upcoming: 'Próximo',
  skipped: 'Omitida',
};

export default function StatusBadge({ status, type = 'reservation' }) {
  const colorClass = COLOR_MAPS[type]?.[status] || 'bg-slate-500/15 text-slate-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {LABELS[status] || status}
    </span>
  );
}
