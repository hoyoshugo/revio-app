export const formatCOP = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$ 0';
  return '$ ' + Number(amount).toLocaleString('es-CO');
};

export const formatDate = (dateStr, opts = {}) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', ...opts
  });
};

export const formatTime = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

export const elapsedMinutes = (dateStr) => {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
};

export const getInitials = (firstName, lastName) => {
  return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || '?';
};

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
];

export const avatarColor = (name = '') => {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const generateICS = (reservation) => {
  const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Revio PMS//EN',
    'BEGIN:VEVENT',
    `UID:${reservation.id || Date.now()}@revio.co`,
    `DTSTART:${fmt(reservation.check_in + 'T15:00:00')}`,
    `DTEND:${fmt(reservation.check_out + 'T12:00:00')}`,
    `SUMMARY:Reserva ${reservation.confirmation_number || ''} — ${reservation.property_name || ''}`,
    `DESCRIPTION:Número de confirmación: ${reservation.confirmation_number || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
};

export const downloadICS = (reservation) => {
  const blob = new Blob([generateICS(reservation)], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reserva-${reservation.confirmation_number || 'revio'}.ics`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadFile = (filename, content, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadCSV = (data, filename) => {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
