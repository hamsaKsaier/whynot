import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('secret-cipher', () => {
  const VALID_KEY = Buffer.from('a'.repeat(32)).toString('base64');

  beforeEach(() => {
    vi.resetModules();
    process.env.SECRETS_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    delete process.env.SECRETS_ENCRYPTION_KEY;
  });

  async function loadModule() {
    return import('../../../utils/crypto/secret-cipher');
  }

  describe('validateEncryptionKey', () => {
    it('does not throw when key is valid 32-byte base64', async () => {
      const { validateEncryptionKey } = await loadModule();
      expect(() => validateEncryptionKey()).not.toThrow();
    });

    it('throws when SECRETS_ENCRYPTION_KEY is missing', async () => {
      delete process.env.SECRETS_ENCRYPTION_KEY;
      const { validateEncryptionKey } = await loadModule();
      expect(() => validateEncryptionKey()).toThrow('SECRETS_ENCRYPTION_KEY env var is required');
    });

    it('throws when key is wrong length', async () => {
      process.env.SECRETS_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
      const { validateEncryptionKey } = await loadModule();
      expect(() => validateEncryptionKey()).toThrow('must be exactly 32 bytes');
    });
  });

  describe('encrypt + decrypt round-trip', () => {
    it('round-trips a simple string', async () => {
      const { encrypt, decrypt } = await loadModule();
      const plaintext = 'sk-test-key-12345';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips unicode content', async () => {
      const { encrypt, decrypt } = await loadModule();
      const plaintext = 'مفتاح-سري-عربي-🔑';
      const encrypted = encrypt(plaintext);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it('round-trips an empty string', async () => {
      const { encrypt, decrypt } = await loadModule();
      const encrypted = encrypt('');
      expect(decrypt(encrypted)).toBe('');
    });

    it('produces different ciphertext each call (unique IV)', async () => {
      const { encrypt } = await loadModule();
      const a = encrypt('same-key');
      const b = encrypt('same-key');
      expect(a.ciphertext).not.toEqual(b.ciphertext);
      expect(a.iv).not.toEqual(b.iv);
    });

    it('ciphertext does not contain plaintext', async () => {
      const { encrypt } = await loadModule();
      const plaintext = 'sk-secret-api-key-ABCDEF';
      const { ciphertext } = encrypt(plaintext);
      expect(ciphertext.toString('utf8')).not.toContain(plaintext);
      expect(ciphertext.toString('base64')).not.toContain(Buffer.from(plaintext).toString('base64'));
    });
  });

  describe('tamper detection', () => {
    it('throws on tampered ciphertext', async () => {
      const { encrypt, decrypt } = await loadModule();
      const encrypted = encrypt('secret');
      encrypted.ciphertext[0] ^= 0xff;
      expect(() => decrypt(encrypted)).toThrow();
    });

    it('throws on tampered auth tag', async () => {
      const { encrypt, decrypt } = await loadModule();
      const encrypted = encrypt('secret');
      encrypted.tag[0] ^= 0xff;
      expect(() => decrypt(encrypted)).toThrow();
    });

    it('throws on tampered IV', async () => {
      const { encrypt, decrypt } = await loadModule();
      const encrypted = encrypt('secret');
      encrypted.iv[0] ^= 0xff;
      expect(() => decrypt(encrypted)).toThrow();
    });
  });
});
