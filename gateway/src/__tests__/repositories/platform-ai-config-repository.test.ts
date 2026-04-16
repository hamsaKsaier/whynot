import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Standalone encrypt/decrypt that doesn't depend on env module
const TEST_KEY = randomBytes(32);

function testEncrypt(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', TEST_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

function testDecrypt(params: { ciphertext: Buffer; iv: Buffer; tag: Buffer }) {
  const decipher = createDecipheriv('aes-256-gcm', TEST_KEY, params.iv);
  decipher.setAuthTag(params.tag);
  return Buffer.concat([decipher.update(params.ciphertext), decipher.final()]).toString('utf8');
}

// Mock the crypto module before any repository import
vi.mock('../../utils/crypto/secret-cipher', () => ({
  encrypt: (plaintext: string) => testEncrypt(plaintext),
  decrypt: (params: { ciphertext: Buffer; iv: Buffer; tag: Buffer }) => testDecrypt(params),
  validateEncryptionKey: () => {},
}));

// In-memory store simulating the platform_ai_config table
let dbRows: any[] = [];

function seedProviders() {
  dbRows = [
    {
      id: 'id-openai', provider: 'openai', display_name: 'OpenAI',
      api_key_encrypted: null, api_key_iv: null, api_key_tag: null,
      fallback_key_encrypted: null, fallback_key_iv: null, fallback_key_tag: null,
      default_model: 'gpt-4o',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
      is_active: false, rate_limit: 0,
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'id-anthropic', provider: 'anthropic', display_name: 'Anthropic',
      api_key_encrypted: null, api_key_iv: null, api_key_tag: null,
      fallback_key_encrypted: null, fallback_key_iv: null, fallback_key_tag: null,
      default_model: 'claude-sonnet-4-6',
      models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022'],
      is_active: false, rate_limit: 0,
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'id-google', provider: 'google', display_name: 'Google AI',
      api_key_encrypted: null, api_key_iv: null, api_key_tag: null,
      fallback_key_encrypted: null, fallback_key_iv: null, fallback_key_tag: null,
      default_model: 'gemini-2.0-flash',
      models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      is_active: false, rate_limit: 0,
      created_at: new Date(), updated_at: new Date(),
    },
    {
      id: 'id-openrouter', provider: 'openrouter', display_name: 'OpenRouter',
      api_key_encrypted: null, api_key_iv: null, api_key_tag: null,
      fallback_key_encrypted: null, fallback_key_iv: null, fallback_key_tag: null,
      default_model: 'anthropic/claude-sonnet-4',
      models: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.1-405b-instruct'],
      is_active: false, rate_limit: 0,
      created_at: new Date(), updated_at: new Date(),
    },
  ];
}

// Mock the database connection layer
vi.mock('../../../shared/database/connection', () => ({
  query: vi.fn(async (sql: string, params?: any[]) => {
    const sqlLower = sql.toLowerCase().trim();

    // SELECT queries
    if (sqlLower.startsWith('select')) {
      if (sqlLower.includes('where provider =')) {
        const provider = params?.[0];
        return dbRows.filter((r) => r.provider === provider);
      }
      if (sqlLower.includes('where is_active = true')) {
        return dbRows.filter((r) => r.is_active === true);
      }
      // listAll
      return [...dbRows].sort((a, b) => a.provider.localeCompare(b.provider));
    }

    // UPDATE queries
    if (sqlLower.startsWith('update')) {
      const providerParam = params?.[params.length - 1];
      // Find by the last param which is always provider for our queries
      // But we need to figure out which param is provider
      let providerValue: string | undefined;

      if (sqlLower.includes('where provider =')) {
        // Find the $N for provider in WHERE clause
        const whereMatch = sql.match(/WHERE provider = \$(\d+)/i);
        if (whereMatch) {
          const idx = parseInt(whereMatch[1], 10) - 1;
          providerValue = params?.[idx];
        }
      }

      const row = dbRows.find((r) => r.provider === providerValue);
      if (!row) return [];

      // Parse what's being set
      if (sqlLower.includes('api_key_encrypted') && !sqlLower.includes('fallback_key_encrypted') && sqlLower.includes('set api_key_encrypted = null')) {
        // removeKey
        row.api_key_encrypted = null;
        row.api_key_iv = null;
        row.api_key_tag = null;
        row.is_active = false;
        row.updated_at = new Date();
      } else if (sqlLower.includes('set api_key_encrypted') && !sqlLower.includes('null')) {
        // upsertKey
        row.api_key_encrypted = params?.[0];
        row.api_key_iv = params?.[1];
        row.api_key_tag = params?.[2];
        row.is_active = true;
        row.updated_at = new Date();
      } else if (sqlLower.includes('fallback_key_encrypted') && sqlLower.includes('set fallback_key_encrypted = null')) {
        // removeFallbackKey
        row.fallback_key_encrypted = null;
        row.fallback_key_iv = null;
        row.fallback_key_tag = null;
        row.updated_at = new Date();
      } else if (sqlLower.includes('set fallback_key_encrypted') && !sqlLower.includes('null')) {
        // upsertFallbackKey
        row.fallback_key_encrypted = params?.[0];
        row.fallback_key_iv = params?.[1];
        row.fallback_key_tag = params?.[2];
        row.updated_at = new Date();
      } else if (sqlLower.includes('set models')) {
        row.models = JSON.parse(params?.[0]);
        row.updated_at = new Date();
      } else if (sqlLower.includes('set default_model')) {
        row.default_model = params?.[0];
        row.updated_at = new Date();
      } else if (sqlLower.includes('set is_active')) {
        row.is_active = params?.[0];
        row.updated_at = new Date();
      } else if (sqlLower.includes('set rate_limit')) {
        row.rate_limit = params?.[0];
        row.updated_at = new Date();
      }

      return [{ ...row }];
    }

    return [];
  }),
}));

import { PlatformAiConfigRepository } from '../../../shared/database/repositories/platform-ai-config-repository';

describe('PlatformAiConfigRepository', () => {
  let repo: PlatformAiConfigRepository;

  beforeEach(() => {
    seedProviders();
    repo = new PlatformAiConfigRepository();
  });

  describe('listAll()', () => {
    it('returns all 4 seeded providers', async () => {
      const result = await repo.listAll();
      expect(result).toHaveLength(4);
      const providers = result.map((r) => r.provider);
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
      expect(providers).toContain('openrouter');
    });

    it('never returns plaintext keys', async () => {
      const result = await repo.listAll();
      for (const item of result) {
        expect(item).not.toHaveProperty('api_key_encrypted');
        expect(item).not.toHaveProperty('api_key_iv');
        expect(item).not.toHaveProperty('api_key_tag');
        expect(item).not.toHaveProperty('fallback_key_encrypted');
        expect(item).toHaveProperty('hasKey');
        expect(item).toHaveProperty('hasFallbackKey');
        expect(item).toHaveProperty('maskedKey');
        expect(item).toHaveProperty('maskedFallbackKey');
      }
    });
  });

  describe('findByProvider()', () => {
    it('returns the openai row', async () => {
      const result = await repo.findByProvider('openai');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('openai');
      expect(result!.display_name).toBe('OpenAI');
      expect(result!.default_model).toBe('gpt-4o');
    });

    it('returns null for unknown provider', async () => {
      const result = await repo.findByProvider('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findActive()', () => {
    it('returns empty when no keys configured', async () => {
      const result = await repo.findActive();
      expect(result).toHaveLength(0);
    });

    it('returns only active providers after key upsert', async () => {
      await repo.upsertKey('openai', 'sk-test-openai-key-1234');
      const result = await repo.findActive();
      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('openai');
      expect(result[0].is_active).toBe(true);
    });
  });

  describe('upsertKey()', () => {
    it('stores encrypted key, sets is_active = true, and verifies round-trip via getDecryptedKey()', async () => {
      const testKey = 'sk-test-primary-key-ABCD';
      const safe = await repo.upsertKey('openai', testKey);

      expect(safe.is_active).toBe(true);
      expect(safe.hasKey).toBe(true);
      expect(safe.maskedKey).toBe('sk-•••••ABCD');

      const decrypted = await repo.getDecryptedKey('openai');
      expect(decrypted).toBe(testKey);
    });

    it('updates rather than duplicates when called twice for same provider', async () => {
      await repo.upsertKey('anthropic', 'sk-first-key-1111');
      await repo.upsertKey('anthropic', 'sk-second-key-2222');

      const all = await repo.listAll();
      const anthropicEntries = all.filter((r) => r.provider === 'anthropic');
      expect(anthropicEntries).toHaveLength(1);

      const decrypted = await repo.getDecryptedKey('anthropic');
      expect(decrypted).toBe('sk-second-key-2222');
    });

    it('throws for unknown provider', async () => {
      await expect(repo.upsertKey('nonexistent', 'sk-test')).rejects.toThrow('ai.providerNotFound');
    });
  });

  describe('upsertFallbackKey()', () => {
    it('stores fallback and verifies round-trip', async () => {
      const fallbackKey = 'sk-fallback-test-WXYZ';
      const safe = await repo.upsertFallbackKey('google', fallbackKey);

      expect(safe.hasFallbackKey).toBe(true);
      expect(safe.maskedFallbackKey).toBe('sk-•••••WXYZ');

      const decrypted = await repo.getDecryptedFallbackKey('google');
      expect(decrypted).toBe(fallbackKey);
    });
  });

  describe('removeKey()', () => {
    it('clears primary key and sets is_active = false', async () => {
      await repo.upsertKey('openai', 'sk-to-remove-1234');
      const safe = await repo.removeKey('openai');

      expect(safe.hasKey).toBe(false);
      expect(safe.maskedKey).toBeNull();
      expect(safe.is_active).toBe(false);

      const decrypted = await repo.getDecryptedKey('openai');
      expect(decrypted).toBeNull();
    });

    it('with fallback present: still marks inactive (primary required for active)', async () => {
      await repo.upsertKey('openai', 'sk-primary-1234');
      await repo.upsertFallbackKey('openai', 'sk-fallback-5678');

      const safe = await repo.removeKey('openai');
      expect(safe.is_active).toBe(false);
      expect(safe.hasKey).toBe(false);
      expect(safe.hasFallbackKey).toBe(true);
    });
  });

  describe('removeFallbackKey()', () => {
    it('clears fallback key only', async () => {
      await repo.upsertKey('anthropic', 'sk-primary-AAAA');
      await repo.upsertFallbackKey('anthropic', 'sk-fallback-BBBB');

      const safe = await repo.removeFallbackKey('anthropic');
      expect(safe.hasFallbackKey).toBe(false);
      expect(safe.maskedFallbackKey).toBeNull();
      expect(safe.hasKey).toBe(true);
      expect(safe.is_active).toBe(true);
    });
  });

  describe('updateModels()', () => {
    it('stores and retrieves JSONB array', async () => {
      const models = ['gpt-4o', 'gpt-4o-mini', 'o3-mini'];
      const safe = await repo.updateModels('openai', models);
      expect(safe.models).toEqual(models);
    });
  });

  describe('updateDefaultModel()', () => {
    it('stores and retrieves model string', async () => {
      const safe = await repo.updateDefaultModel('anthropic', 'claude-opus-4-6');
      expect(safe.default_model).toBe('claude-opus-4-6');
    });
  });

  describe('setActive()', () => {
    it('with no key configured should throw', async () => {
      await expect(repo.setActive('openai', true)).rejects.toThrow('ai.cannotActivateWithoutKey');
    });

    it('deactivates provider successfully', async () => {
      await repo.upsertKey('openai', 'sk-test-key-1234');
      const safe = await repo.setActive('openai', false);
      expect(safe.is_active).toBe(false);
    });

    it('activates provider with key successfully', async () => {
      await repo.upsertKey('openai', 'sk-test-key-1234');
      await repo.setActive('openai', false);
      const safe = await repo.setActive('openai', true);
      expect(safe.is_active).toBe(true);
    });
  });

  describe('updateRateLimit()', () => {
    it('updates rate limit to positive number', async () => {
      const safe = await repo.updateRateLimit('openai', 100);
      expect(safe.rate_limit).toBe(100);
    });

    it('updates rate limit to zero (unlimited)', async () => {
      const safe = await repo.updateRateLimit('openai', 0);
      expect(safe.rate_limit).toBe(0);
    });

    it('throws for negative number', async () => {
      await expect(repo.updateRateLimit('openai', -1)).rejects.toThrow('ai.invalidRateLimit');
    });

    it('throws for non-integer', async () => {
      await expect(repo.updateRateLimit('openai', 1.5)).rejects.toThrow('ai.invalidRateLimit');
    });
  });

  describe('Encryption round-trip', () => {
    it('plaintext -> encrypt -> store -> retrieve -> decrypt -> plaintext matches', async () => {
      const originalKey = 'sk-live-superSecretKeyValue12345678';
      await repo.upsertKey('anthropic', originalKey);
      const decrypted = await repo.getDecryptedKey('anthropic');
      expect(decrypted).toBe(originalKey);
    });

    it('fallback key encryption round-trip', async () => {
      const originalKey = 'sk-fallback-anotherSecretKeyXYZ';
      await repo.upsertFallbackKey('google', originalKey);
      const decrypted = await repo.getDecryptedFallbackKey('google');
      expect(decrypted).toBe(originalKey);
    });
  });

  describe('Key masking format', () => {
    it('masks key as sk-•••••XXXX for keys > 4 chars', async () => {
      await repo.upsertKey('openai', 'sk-test-very-long-key-ZZZZ');
      const safe = await repo.findByProvider('openai');
      expect(safe!.maskedKey).toBe('sk-•••••ZZZZ');
    });

    it('masks short key (<=4 chars) as ••••', async () => {
      await repo.upsertKey('openai', 'abcd');
      const safe = await repo.findByProvider('openai');
      expect(safe!.maskedKey).toBe('••••');
    });
  });

  describe('getDecryptedKey()', () => {
    it('returns null when no key configured', async () => {
      const decrypted = await repo.getDecryptedKey('openai');
      expect(decrypted).toBeNull();
    });

    it('throws for unknown provider', async () => {
      await expect(repo.getDecryptedKey('nonexistent')).rejects.toThrow('ai.providerNotFound');
    });
  });

  describe('getDecryptedFallbackKey()', () => {
    it('returns null when no fallback key configured', async () => {
      const decrypted = await repo.getDecryptedFallbackKey('openai');
      expect(decrypted).toBeNull();
    });

    it('throws for unknown provider', async () => {
      await expect(repo.getDecryptedFallbackKey('nonexistent')).rejects.toThrow('ai.providerNotFound');
    });
  });
});
