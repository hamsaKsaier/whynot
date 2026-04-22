import { describe, it, expect, beforeEach, vi } from 'vitest';
import { platformKeyCache } from '../../../utils/ai/platform-key-cache';

describe('PlatformKeyCache', () => {
  beforeEach(() => {
    platformKeyCache.invalidateAll();
  });

  it('returns null for unknown provider', () => {
    expect(platformKeyCache.get('openai')).toBeNull();
  });

  it('returns entry within TTL', () => {
    platformKeyCache.set('openai', {
      key: 'sk-test',
      fallbackKey: null,
      model: 'gpt-4o',
      models: ['gpt-4o', 'gpt-4o-mini'],
      provider: 'openai',
      isActive: true,
    });

    const entry = platformKeyCache.get('openai');
    expect(entry).not.toBeNull();
    expect(entry!.key).toBe('sk-test');
    expect(entry!.model).toBe('gpt-4o');
    expect(entry!.provider).toBe('openai');
    expect(entry!.fallbackKey).toBeNull();
    expect(entry!.isActive).toBe(true);
  });

  it('returns null after TTL expires', () => {
    platformKeyCache.set('openai', {
      key: 'sk-test',
      fallbackKey: null,
      model: 'gpt-4o',
      models: ['gpt-4o'],
      provider: 'openai',
      isActive: true,
    });

    // Advance time past the 60s TTL
    vi.useFakeTimers();
    vi.advanceTimersByTime(61_000);

    expect(platformKeyCache.get('openai')).toBeNull();

    vi.useRealTimers();
  });

  it('invalidate(provider) removes single entry', () => {
    platformKeyCache.set('openai', {
      key: 'sk-openai',
      fallbackKey: null,
      model: 'gpt-4o',
      models: ['gpt-4o'],
      provider: 'openai',
      isActive: true,
    });
    platformKeyCache.set('anthropic', {
      key: 'sk-ant',
      fallbackKey: null,
      model: 'claude-sonnet-4-6',
      models: ['claude-sonnet-4-6'],
      provider: 'anthropic',
      isActive: true,
    });

    platformKeyCache.invalidate('openai');

    expect(platformKeyCache.get('openai')).toBeNull();
    expect(platformKeyCache.get('anthropic')).not.toBeNull();
  });

  it('invalidateAll() clears entire cache', () => {
    platformKeyCache.set('openai', {
      key: 'sk-openai',
      fallbackKey: null,
      model: 'gpt-4o',
      models: ['gpt-4o'],
      provider: 'openai',
      isActive: true,
    });
    platformKeyCache.set('anthropic', {
      key: 'sk-ant',
      fallbackKey: null,
      model: 'claude-sonnet-4-6',
      models: ['claude-sonnet-4-6'],
      provider: 'anthropic',
      isActive: true,
    });

    platformKeyCache.invalidateAll();

    expect(platformKeyCache.get('openai')).toBeNull();
    expect(platformKeyCache.get('anthropic')).toBeNull();
  });

  it('set() overwrites existing entry', () => {
    platformKeyCache.set('openai', {
      key: 'sk-old',
      fallbackKey: null,
      model: 'gpt-4o',
      models: ['gpt-4o'],
      provider: 'openai',
      isActive: true,
    });

    platformKeyCache.set('openai', {
      key: 'sk-new',
      fallbackKey: 'sk-fallback',
      model: 'gpt-4o-mini',
      models: ['gpt-4o-mini'],
      provider: 'openai',
      isActive: true,
    });

    const entry = platformKeyCache.get('openai');
    expect(entry!.key).toBe('sk-new');
    expect(entry!.fallbackKey).toBe('sk-fallback');
    expect(entry!.model).toBe('gpt-4o-mini');
  });

  it('invalidate() without provider clears all entries', () => {
    platformKeyCache.set('openai', {
      key: 'sk-openai',
      fallbackKey: null,
      model: 'gpt-4o',
      models: ['gpt-4o'],
      provider: 'openai',
      isActive: true,
    });

    platformKeyCache.invalidate();

    expect(platformKeyCache.get('openai')).toBeNull();
  });
});
