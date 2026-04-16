import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'SECRETS_ENCRYPTION_KEY env var is required. Generate with: openssl rand -base64 32'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must be exactly 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`
    );
  }
  cachedKey = key;
  return key;
}

export function validateEncryptionKey(): void {
  getKey();
}

export function encrypt(plaintext: string): {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return { ciphertext: encrypted, iv, tag };
}

export function decrypt(params: {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, params.iv);
  decipher.setAuthTag(params.tag);
  return Buffer.concat([
    decipher.update(params.ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

export class DecryptionKeyMismatchError extends Error {
  readonly code = 'DECRYPTION_KEY_MISMATCH';
  constructor(cause?: unknown) {
    super('Stored ciphertext cannot be decrypted with the current SECRETS_ENCRYPTION_KEY');
    this.name = 'DecryptionKeyMismatchError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}
