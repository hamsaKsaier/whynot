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

  describe('getReconModel() / setReconModel() — Recon tier overrides', () => {
    it('returns null when the row does not exist', async () => {
      const small = await repo.getReconModel('small');
      expect(small).toBeNull();
    });

    it('returns null when the stored value is the empty-string sentinel', async () => {
      store['recon_small_model'] = '';
      expect(await repo.getReconModel('small')).toBeNull();
    });

    it('round-trips a set override', async () => {
      await repo.setReconModel('medium', 'claude-opus-4-6');
      expect(await repo.getReconModel('medium')).toBe('claude-opus-4-6');
    });

    it('setting null clears the override (persisted as empty string)', async () => {
      await repo.setReconModel('large', 'claude-opus-4-6');
      await repo.setReconModel('large', null);
      expect(store['recon_large_model']).toBe('');
      expect(await repo.getReconModel('large')).toBeNull();
    });

    it('trims whitespace on set', async () => {
      await repo.setReconModel('small', '  claude-sonnet-4-6  ');
      expect(store['recon_small_model']).toBe('claude-sonnet-4-6');
    });

    it('each tier is stored under its own key', async () => {
      await repo.setReconModel('small', 'model-s');
      await repo.setReconModel('medium', 'model-m');
      await repo.setReconModel('large', 'model-l');

      expect(store['recon_small_model']).toBe('model-s');
      expect(store['recon_medium_model']).toBe('model-m');
      expect(store['recon_large_model']).toBe('model-l');
    });
  });

  describe('getAllReconModels()', () => {
    it('returns { small: null, medium: null, large: null } when none set', async () => {
      const result = await repo.getAllReconModels();
      expect(result).toEqual({ small: null, medium: null, large: null });
    });

    it('returns the resolved set of overrides, including partial configuration', async () => {
      await repo.setReconModel('small', 'sonnet-small');
      await repo.setReconModel('large', 'opus-large');
      // medium left unset

      const result = await repo.getAllReconModels();
      expect(result).toEqual({
        small: 'sonnet-small',
        medium: null,
        large: 'opus-large',
      });
    });

    it('NULL / empty-string round-trip: setReconModel(null) -> getAllReconModels reads as null', async () => {
      await repo.setReconModel('small', 'temporary');
      await repo.setReconModel('small', null);
      const result = await repo.getAllReconModels();
      expect(result.small).toBeNull();
    });
  });
});
