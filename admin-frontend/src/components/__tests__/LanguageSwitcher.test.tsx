import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageSwitcher } from '../LanguageSwitcher';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    i18n: {
      resolvedLanguage: 'en',
      changeLanguage: vi.fn(),
    },
  })),
}));

vi.mock('@/i18n', () => ({
  SUPPORTED_LANGUAGES: ['en', 'ar', 'fr', 'de', 'es'],
  LANGUAGE_META: {
    en: { nativeName: 'English', flag: 'US', dir: 'ltr' },
    ar: { nativeName: 'Arabic', flag: 'SA', dir: 'rtl' },
    fr: { nativeName: 'Francais', flag: 'FR', dir: 'ltr' },
    de: { nativeName: 'Deutsch', flag: 'DE', dir: 'ltr' },
    es: { nativeName: 'Espanol', flag: 'ES', dir: 'ltr' },
  },
}));

describe('LanguageSwitcher', () => {
  it('renders the language trigger button', () => {
    render(<LanguageSwitcher />);
    const button = screen.getByRole('button', { name: 'Change language' });
    expect(button).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    const { container } = render(<LanguageSwitcher />);
    expect(container).toBeTruthy();
  });
});
