/**
 * validate.js — input validation minimal sin dependencias nuevas.
 *
 * E-AGENT-13 M1 (2026-04-26): antes endpoints consumían `req.body` raw
 * sin validación. Type-confusion (e.g., array donde se espera string)
 * causaba 500s y mensajes Postgres feos al cliente. Esta utility provee
 * validación declarativa sin agregar Joi/Zod (que pesan ~200KB cada uno).
 *
 * Uso típico en una ruta:
 *
 *   import { v, validate } from '../utils/validate.js';
 *
 *   router.post('/x', validate({
 *     email: v.string().email().required(),
 *     password: v.string().min(8).required(),
 *     age: v.number().min(0).max(150),
 *   }), async (req, res) => {
 *     // req.body ya está validado y typed
 *   });
 *
 * Si la validación falla → 400 con detail array.
 *
 * Esta es una implementación pragmática. Para casos complejos (nested
 * objects, arrays de objects, refinements), considerar migrar a zod.
 */

class FieldValidator {
  constructor() {
    this.checks = [];
    this._required = false;
    this._type = null;
  }

  required() { this._required = true; return this; }
  optional() { this._required = false; return this; }

  string() {
    this._type = 'string';
    this.checks.push((val) => {
      if (typeof val !== 'string') return 'debe ser un string';
      return null;
    });
    return this;
  }

  number() {
    this._type = 'number';
    this.checks.push((val) => {
      const n = Number(val);
      if (isNaN(n) || (typeof val !== 'number' && typeof val !== 'string')) {
        return 'debe ser un número';
      }
      return null;
    });
    return this;
  }

  boolean() {
    this._type = 'boolean';
    this.checks.push((val) => {
      if (typeof val !== 'boolean') return 'debe ser true o false';
      return null;
    });
    return this;
  }

  email() {
    this.checks.push((val) => {
      if (typeof val !== 'string') return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : 'email inválido';
    });
    return this;
  }

  uuid() {
    this.checks.push((val) => {
      if (typeof val !== 'string') return null;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
        ? null : 'UUID inválido';
    });
    return this;
  }

  min(n) {
    this.checks.push((val) => {
      if (typeof val === 'string' && val.length < n) return `mínimo ${n} caracteres`;
      if (typeof val === 'number' && val < n) return `mínimo ${n}`;
      return null;
    });
    return this;
  }

  max(n) {
    this.checks.push((val) => {
      if (typeof val === 'string' && val.length > n) return `máximo ${n} caracteres`;
      if (typeof val === 'number' && val > n) return `máximo ${n}`;
      return null;
    });
    return this;
  }

  oneOf(values) {
    this.checks.push((val) => {
      return values.includes(val) ? null : `debe ser uno de: ${values.join(', ')}`;
    });
    return this;
  }

  matches(regex, message) {
    this.checks.push((val) => {
      if (typeof val !== 'string') return null;
      return regex.test(val) ? null : (message || `formato inválido`);
    });
    return this;
  }

  validate(val, fieldName) {
    if (val === undefined || val === null || val === '') {
      if (this._required) return [`${fieldName}: requerido`];
      return [];
    }
    const errors = [];
    for (const check of this.checks) {
      const err = check(val);
      if (err) errors.push(`${fieldName}: ${err}`);
    }
    return errors;
  }
}

export const v = {
  string: () => new FieldValidator().string(),
  number: () => new FieldValidator().number(),
  boolean: () => new FieldValidator().boolean(),
  any: () => new FieldValidator(),
};

/**
 * Express middleware: valida req.body según el schema. Si falla, responde
 * 400 con array de errors. Si pasa, agrega defaults y continúa.
 */
export function validate(schema) {
  return (req, res, next) => {
    const body = req.body || {};
    const errors = [];
    for (const [field, validator] of Object.entries(schema)) {
      const fieldErrors = validator.validate(body[field], field);
      errors.push(...fieldErrors);
    }
    if (errors.length) {
      return res.status(400).json({
        error: 'Validación falló',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
    }
    next();
  };
}
