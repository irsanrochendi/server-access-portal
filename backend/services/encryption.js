/**
 * Encryption service — AES-256-GCM
 * encrypt(plaintext) → "iv:tag:ciphertext" (semua hex, dipisah :)
 * decrypt(payload)    → plaintext
 *
 * Key dari ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Kalau key tidak diset, throw error saat module load.
 */

import crypto from 'crypto';

const KEY_HEX = process.env.ENCRYPTION_KEY;

if (!KEY_HEX) {
  throw new Error('ENCRYPTION_KEY env var is not set. Generate with: node -e "console.log(require("crypto").randomBytes(32).toString("hex"))"');
}

if (KEY_HEX.length !== 64) {
  throw new Error(`ENCRYPTION_KEY must be 64 hex chars (32 bytes). Got ${KEY_HEX.length} chars.`);
}

const KEY = Buffer.from(KEY_HEX, 'hex');
const ALG = 'aes-256-gcm';

/**
 * Encrypt plaintext → return "iv:tag:ciphertext"
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/**
 * Decrypt "iv:tag:ciphertext" → plaintext
 * @param {string} payload
 * @returns {string}
 */
export function decrypt(payload) {
  if (!payload) return '';
  try {
    const parts = payload.split(':');
    if (parts.length !== 3) return '';
    const [ivHex, tagHex, encHex] = parts;
    if (!ivHex || !tagHex || !encHex) return '';

    const decipher = crypto.createDecipheriv(ALG, KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encHex, 'hex')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch (err) {
    console.error('Decrypt failed:', err.message);
    return ''; // fail-safe
  }
}
