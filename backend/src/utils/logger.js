/**
 * logger.js — structured logging helper (E-AGENT-13 M10).
 *
 * Wrapper minimal sobre console.* que emite JSON-line para que Railway/
 * Datadog/Loki puedan parsear y filtrar por tenant_id, request_id, etc.
 *
 * Uso:
 *   import { log } from '../utils/logger.js';
 *   log.info('agent_response', { tenant_id, property_id, latency_ms });
 *   log.error('lobbypms_failed', { tenant_id, status, error: err.message });
 *
 * Reemplazar gradualmente console.log/error/warn por log.info/error/warn
 * en el módulo. NO bloqueante: console.* sigue funcionando, los nuevos
 * call sites son los que se benefician.
 *
 * Si necesitas algo más sofisticado (winston, pino), reemplazá la
 * implementación abajo manteniendo la misma API.
 */

const LEVELS = ['debug', 'info', 'warn', 'error'];
const MIN_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const MIN_INDEX = LEVELS.indexOf(MIN_LEVEL) >= 0 ? LEVELS.indexOf(MIN_LEVEL) : 1;

function emit(level, event, fields = {}) {
  if (LEVELS.indexOf(level) < MIN_INDEX) return;
  const record = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  // Sanitizar fields que puedan tener PII
  if (record.password) record.password = '[REDACTED]';
  if (record.api_key) record.api_key = '[REDACTED]';
  if (record.token) record.token = '[REDACTED]';
  if (record.authorization) record.authorization = '[REDACTED]';

  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event, fields) => emit('debug', event, fields),
  info: (event, fields) => emit('info', event, fields),
  warn: (event, fields) => emit('warn', event, fields),
  error: (event, fields) => emit('error', event, fields),
};

export default log;
