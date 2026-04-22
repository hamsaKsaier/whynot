import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderAtLocale, resetLocale, testI18n, LANGUAGES } from './renderAtLocale';

afterEach(async () => {
  cleanup();
  await resetLocale();
});

describe('renderAtLocale helper', () => {
  it('switches i18n language correctly', async () => {
    await renderAtLocale(<div>test</div>, 'fr');
    expect(testI18n.language).toBe('fr');
  });

  it.each(LANGUAGES)('sets document lang attribute for %s', async (lang) => {
    await renderAtLocale(<div>test</div>, lang);
    expect(document.documentElement.lang).toBe(lang);
  });

  it('sets dir=rtl for Arabic', async () => {
    await renderAtLocale(<div>test</div>, 'ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it.each(['en', 'fr', 'de', 'es'] as const)('sets dir=ltr for %s', async (lang) => {
    await renderAtLocale(<div>test</div>, lang);
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('resets to en on teardown', async () => {
    await renderAtLocale(<div>test</div>, 'de');
    expect(testI18n.language).toBe('de');

    await resetLocale();
    expect(testI18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('renders content inside MemoryRouter', async () => {
    const { getByText } = await renderAtLocale(
      <span>hello world</span>,
      'en',
    );
    expect(getByText('hello world')).toBeTruthy();
  });

  it('supports custom route patterns with params', async () => {
    const ParamPage = () => {
      const { useParams } = require('react-router-dom');
      const { id } = useParams();
      return <span>id={id}</span>;
    };
    const { getByText } = await renderAtLocale(
      <ParamPage />,
      'en',
      { initialEntries: ['/items/42'], routePattern: '/items/:id' },
    );
    expect(getByText('id=42')).toBeTruthy();
  });
});
