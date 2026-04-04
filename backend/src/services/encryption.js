/**
 * encryption.js — AES-256-GCM para claves API de clientes
 * Usado para cifrar las claves de proveedor IA almacenadas en Supabase.
 */
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32; // 256 bits

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    // En desarrollo, usar clave derivada del JWT_SECRET
    const fallback = process.env.JWT_SECRET || 'dev-fallback-key-not-for-production';
    return crypto.createHash('sha256').update(fallback).digest();
  }
  // Aceptar hex (64 chars) o raw string (se hashea a 32 bytes)
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Cifra un string con AES-256-GCM.
 * @param {string} plaintext
 * @returns {string} base64-encoded "iv:authTag:ciphertext"
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96 bits para GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Descifra un string cifrado con encrypt().
 * @param {string} encoded  base64-encoded "iv:authTag:ciphertext"
 * @returns {string} plaintext, o null si el valor ya es plaintext (no cifrado)
 */
export function decrypt(encoded) {
  if (!encoded) return encoded;
  // Si no tiene el patrón iv:tag:data, asumir que es texto plano (legacy)
  if (!encoded.includes(':')) return encoded;
  try {
    const [ivB64, tagB64, dataB64] = encoded.split(':');
    const key = getKey();
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Si la descifrado falla, devolver el valor tal cual (puede ser legacy plain)
    return encoded;
  }
}

/**
 * Cifra todas las api_keys dentro de un objeto de configuración de proveedor IA.
 * Modifica el objeto in-place y lo retorna.
 */
export function encryptAiConfig(config) {
  if (!config || typeof config !== 'object') return config;
  if (config.api_keys && typeof config.api_keys === 'object') {
    const encrypted = {};
    for (const [provider, key] of Object.entries(config.api_keys)) {
      encrypted[provider] = key ? encrypt(key) : key;
    }
    return { ...config, api_keys: encrypted };
  }
  return config;
}

/**
 * Descifra todas las api_keys dentro de un objeto de configuración de proveedor IA.
 */
export function decryptAiConfig(config) {
  if (!config || typeof config !== 'object') return config;
  if (config.api_keys && typeof config.api_keys === 'object') {
    const decrypted = {};
    for (const [provider, key] of Object.entries(config.api_keys)) {
      decrypted[provider] = key ? decrypt(key) : key;
    }
    return { ...config, api_keys: decrypted };
  }
  return config;
}
