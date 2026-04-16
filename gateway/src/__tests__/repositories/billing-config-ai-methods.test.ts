import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory key-value store simulating billing_config table
let store: Record<string, string> = {};

vi.mock('../../../shared/database/connection', () => ({
  query: vi.fn(async (sql: string, params?: any[]) => {
    const sqlLower = sql.toLowerCase().trim();

    if (sqlLower.startsWith('select')) {
      const key = params?.[0];
      if (key && store[key] !== undefined) {
        return [{ key, value: store[key], updated_at: new Date() }];
      }
      if (sqlLower.includes('where key =')) return [];
      // getAll
      return Object.entries(store)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ key: k, value: v, updated_at: new Date() }));
    }

    if (sqlLower.startsWith('insert') || sqlLower.includes('on conflict')) {
      const key = params?.[0];
      const value = params?.[1];
      store[key] = value;
      return [];
    }

    if (sqlLower.startsWith('delete')) {
      const key = params?.[0];
      delete store[key];
      return [];
    }

    return [];
  }),
}));

import { BillingConfigRepository } from '../../../shared/database/repositories/billing-config-repository';

describe('BillingConfigRepository — AI convenience methods', () => {
  let repo: BillingConfigRepository;

  beforeEach(() => {
    store = {
      'default_ai_provider': '{"provider": "anthropic", "model": "claude-sonnet-4-6"}',
      'ai_fallback_order': '["anthropic", "openai", "google", "openrouter"]',
    };
    repo = new BillingConfigRepository();
  });

  describe('getDefaultAiProvider()', () => {
    it('returns seeded default', async () => {
      const result = await repo.getDefaultAiProvider();
      expect(result).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
    });

    it('returns null when key missing', async () => {
      delete store['default_ai_provider'];
      const result = await repo.getDefaultAiProvider();
      expect(result).toBeNull();
    });

    it('returns null for malformed JSON', async () => {
      store['default_ai_provider'] = 'not-json';
      const result = await repo.getDefaultAiProvider();
      expect(result).toBeNull();
    });
  });

  describe('setDefaultAiProvider()', () => {
    it('updates, re-read matches', async () => {
      await repo.setDefaultAiProvider('openai', 'gpt-4o');
      const result = await repo.getDefaultAiProvider();
      expect(result).toEqual({ provider: 'openai', model: 'gpt-4o' });
    });
  });

  describe('getAiFallbackOrder()', () => {
    it('returns seeded order', async () => {
      const result = await repo.getAiFallbackOrder();
      expect(result).toEqual(['anthropic', 'openai', 'google', 'openrouter']);
    });

    it('returns empty array when key missing', async () => {
      delete store['ai_fallback_order'];
      const result = await repo.getAiFallbackOrder();
      expect(result).toEqual([]);
    });

    it('returns empty array for malformed JSON', async () => {
      store['ai_fallback_order'] = 'not-json';
      const result = await repo.getAiFallbackOrder();
      expect(result).toEqual([]);
    });
  });

  describe('setAiFallbackOrder()', () => {
    it('updates, re-read matches', async () => {
      const newOrder = ['openai', 'anthropic', 'google'];
      await repo.setAiFallbackOrder(newOrder);
      const result = await repo.getAiFallbackOrder();
      expect(result).toEqual(newOrder);
    });
  });
});
