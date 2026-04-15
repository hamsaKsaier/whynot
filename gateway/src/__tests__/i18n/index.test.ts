import { describe, it, expect } from 'vitest';

// Import the module to test exports
import i18n, { SUPPORTED_LANGUAGES } from '../../i18n/index';

describe('i18n/index', () => {
  it('exports SUPPORTED_LANGUAGES array', () => {
    expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    expect(SUPPORTED_LANGUAGES).toContain('en');
    expect(SUPPORTED_LANGUAGES).toContain('ar');
    expect(SUPPORTED_LANGUAGES).toContain('fr');
    expect(SUPPORTED_LANGUAGES).toContain('de');
    expect(SUPPORTED_LANGUAGES).toContain('es');
  });

  it('exports exactly 5 supported languages', () => {
    expect(SUPPORTED_LANGUAGES.length).toBe(5);
  });

  it('exports a default i18next instance', () => {
    expect(i18n).toBeDefined();
    expect(typeof i18n.t).toBe('function');
  });

  it('has en as fallback language', () => {
    // i18next stores the options
    const options = (i18n as any).options;
    expect(options.fallbackLng).toContain('en');
  });

  it('has expected namespaces configured', () => {
    const options = (i18n as any).options;
    expect(options.ns).toContain('errors');
    expect(options.ns).toContain('emails');
    expect(options.ns).toContain('billing');
  });
});
