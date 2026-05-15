import { randomBytes, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'enc:v1:';
const KDF_SALT = 'vpn-saas-static-salt-v1';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not configured');
  }
  // Accept base64-encoded 32-byte keys directly; otherwise derive with scrypt.
  if (/^[A-Za-z0-9+/=]+$/.test(raw)) {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) {
      cachedKey = decoded;
      return cachedKey;
    }
  }
  cachedKey = scryptSync(raw, KDF_SALT, 32);
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function decrypt(payload: string): string {
  if (!isEncrypted(payload)) {
    // Legacy plaintext rows: return as-is so existing data still works.
    // New writes always go through encrypt(); reads tolerate either form
    // during the rollout window.
    return payload;
  }
  const blob = Buffer.from(payload.slice(PREFIX.length), 'base64');
  if (blob.length < IV_LEN + TAG_LEN) throw new Error('Ciphertext is malformed');
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Compares two secrets in constant time. Returns false on length mismatch
 * without revealing the prefix.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
