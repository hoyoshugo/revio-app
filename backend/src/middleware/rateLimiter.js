import rateLimit from 'express-rate-limit';

// Límite general
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { error: 'Demasiadas solicitudes, intenta en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false
});

// Límite estricto para el chat (evitar abuso de la API de Claude)
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  message: { error: 'Límite de mensajes alcanzado, espera un momento' },
  keyGenerator: (req) => req.body?.session_id || req.ip
});

// Límite para webhooks de Wompi
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas solicitudes al webhook' }
});
