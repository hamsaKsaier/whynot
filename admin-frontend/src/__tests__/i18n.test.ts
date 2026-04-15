import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  RTL_LANGUAGES,
  LANGUAGE_META,
  type SupportedLanguage,
} from '../i18n';

describe('i18n configuration', () => {
  it('exports SUPPORTED_LANGUAGES as a non-empty array', () => {
    expect(Array.isArray(SUPPORTED_LANGUAGES)).toBe(true);
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(0);
  });

  it('includes English as a supported language', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en');
  });

  it('includes Arabic as a supported language', () => {
    expect(SUPPORTED_LANGUAGES).toContain('ar');
  });

  it('has 5 supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'ar', 'fr', 'de', 'es']);
  });

  it('exports RTL_LANGUAGES with Arabic', () => {
    expect(RTL_LANGUAGES).toContain('ar');
  });

  it('RTL_LANGUAGES only contains Arabic', () => {
    expect(RTL_LANGUAGES).toEqual(['ar']);
  });

  it('exports LANGUAGE_META for all supported languages', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_META[lang]).toBeDefined();
      expect(LANGUAGE_META[lang].nativeName).toBeTruthy();
      expect(LANGUAGE_META[lang].flag).toBeTruthy();
      expect(['ltr', 'rtl']).toContain(LANGUAGE_META[lang].dir);
    }
  });

  it('Arabic has rtl direction in meta', () => {
    expect(LANGUAGE_META.ar.dir).toBe('rtl');
  });

  it('English has ltr direction in meta', () => {
    expect(LANGUAGE_META.en.dir).toBe('ltr');
  });

  it('French has ltr direction in meta', () => {
    expect(LANGUAGE_META.fr.dir).toBe('ltr');
  });

  it('each language has a native name', () => {
    expect(LANGUAGE_META.en.nativeName).toBe('English');
    expect(LANGUAGE_META.fr.nativeName).toBe('Fran\u00e7ais');
    expect(LANGUAGE_META.de.nativeName).toBe('Deutsch');
    expect(LANGUAGE_META.es.nativeName).toBe('Espa\u00f1ol');
  });
});
