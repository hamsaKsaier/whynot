import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../../../../public/locales');

function loadJson(lang: string, ns: string): Record<string, string> {
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

let currentLang = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    const translations = loadJson(currentLang, 'common');
    return {
      t: (key: string) => translations[key] ?? key,
      i18n: { language: currentLang },
    };
  },
}));

let reconFlagValue = true;
vi.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => (key === 'recon_enabled' ? reconFlagValue : false),
}));

vi.mock('@/components/DirectionProvider', () => ({
  useDirectionContext: () => ({ direction: currentLang === 'ar' ? 'rtl' : 'ltr' }),
}));

vi.mock('@/components/ui/Logo', () => ({
  Logo: () => <span>Logo</span>,
}));

import { Sidebar } from '../Sidebar';

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar collapsed={false} onToggleCollapse={() => {}} />
    </MemoryRouter>
  );
}

describe('Sidebar Recon nav', () => {
  beforeEach(() => {
    currentLang = 'en';
    reconFlagValue = true;
  });

  it('renders Recon nav item when recon_enabled flag is true', () => {
    renderSidebar();
    const link = screen.getByTestId('sidebar-nav-recon');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/recon');
    expect(link).toHaveTextContent('Recon');
  });

  it('does NOT render Recon nav item when recon_enabled flag is false', () => {
    reconFlagValue = false;
    renderSidebar();
    expect(screen.queryByTestId('sidebar-nav-recon')).not.toBeInTheDocument();
  });

  it('renders the translated Recon label in Arabic (RTL)', () => {
    currentLang = 'ar';
    renderSidebar();
    const link = screen.getByTestId('sidebar-nav-recon');
    expect(link).toHaveTextContent('ريكون');
  });

  it('renders the translated Recon label in French', () => {
    currentLang = 'fr';
    renderSidebar();
    expect(screen.getByTestId('sidebar-nav-recon')).toHaveTextContent('Recon');
  });

  it('renders the translated Recon label in German', () => {
    currentLang = 'de';
    renderSidebar();
    expect(screen.getByTestId('sidebar-nav-recon')).toHaveTextContent('Recon');
  });

  it('renders the translated Recon label in Spanish', () => {
    currentLang = 'es';
    renderSidebar();
    expect(screen.getByTestId('sidebar-nav-recon')).toHaveTextContent('Recon');
  });

  it('still renders non-gated items (QA Loop) regardless of recon flag', () => {
    reconFlagValue = false;
    renderSidebar();
    expect(screen.getByText('QA Loop')).toBeInTheDocument();
  });

  it('matches sidebar snapshot in English with flag on', () => {
    const { container } = renderSidebar();
    expect(container).toMatchSnapshot();
  });

  it('matches sidebar snapshot in Arabic (RTL) with flag on', () => {
    currentLang = 'ar';
    const { container } = renderSidebar();
    expect(container).toMatchSnapshot();
  });
});
