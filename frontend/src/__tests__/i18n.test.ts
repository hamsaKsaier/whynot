import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_LANGUAGES,
  RTL_LANGUAGES,
  LANGUAGE_META,
  type SupportedLanguage,
} from '../i18n';

describe('i18n configuration', () => {
  it('defines supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en');
    expect(SUPPORTED_LANGUAGES).toContain('ar');
    expect(SUPPORTED_LANGUAGES).toContain('fr');
    expect(SUPPORTED_LANGUAGES).toContain('de');
    expect(SUPPORTED_LANGUAGES).toContain('es');
    expect(SUPPORTED_LANGUAGES).toHaveLength(5);
  });

  it('defines RTL languages', () => {
    expect(RTL_LANGUAGES).toContain('ar');
    expect(RTL_LANGUAGES).toHaveLength(1);
  });

  it('has metadata for every supported language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const meta = LANGUAGE_META[lang];
      expect(meta).toBeDefined();
      expect(meta.nativeName).toBeTruthy();
      expect(meta.flag).toBeTruthy();
      expect(['ltr', 'rtl']).toContain(meta.dir);
    }
  });

  it('marks Arabic as RTL', () => {
    expect(LANGUAGE_META.ar.dir).toBe('rtl');
  });

  it('marks English as LTR', () => {
    expect(LANGUAGE_META.en.dir).toBe('ltr');
  });

  it('marks French as LTR', () => {
    expect(LANGUAGE_META.fr.dir).toBe('ltr');
  });

  it('has correct native names', () => {
    expect(LANGUAGE_META.en.nativeName).toBe('English');
    expect(LANGUAGE_META.ar.nativeName).toBe('العربية');
    expect(LANGUAGE_META.fr.nativeName).toBe('Français');
    expect(LANGUAGE_META.de.nativeName).toBe('Deutsch');
    expect(LANGUAGE_META.es.nativeName).toBe('Español');
  });
});
