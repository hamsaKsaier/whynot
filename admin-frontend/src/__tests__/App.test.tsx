import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('App module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('exports a default component', async () => {
    // We just verify the module can be imported
    const mod = await import('../App');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});
