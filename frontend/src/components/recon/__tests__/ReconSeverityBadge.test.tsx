import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    const translations = loadJson(currentLang, 'recon');
    return {
      t: (key: string) =>
        typeof translations[key] === 'string' ? (translations[key] as string) : key,
      i18n: { language: currentLang },
    };
  },
}));

import { ReconSeverityBadge } from '../ReconSeverityBadge';
import type { ReconSeverity } from '@/services/recon-api';

describe('ReconSeverityBadge', () => {
  const severities: ReconSeverity[] = ['low', 'medium', 'high', 'critical'];

  it.each(severities)('renders severity "%s" with translated label', (severity) => {
    render(<ReconSeverityBadge severity={severity} />);
    expect(screen.getByTestId(`severity-badge-${severity}`)).toBeInTheDocument();
  });

  it('hides the label when showLabel=false', () => {
    render(<ReconSeverityBadge severity="critical" showLabel={false} />);
    expect(screen.queryByText(/critical/i)).not.toBeInTheDocument();
  });

  it('renders the count when provided', () => {
    render(<ReconSeverityBadge severity="high" count={5} />);
    expect(screen.getByTestId('severity-badge-high')).toHaveTextContent('5');
  });

  it('does not render count when zero is not passed', () => {
    render(<ReconSeverityBadge severity="low" />);
    const badge = screen.getByTestId('severity-badge-low');
    expect(badge.textContent?.trim()).toBe('Low');
  });

  it('renders count 0 when explicitly passed', () => {
    render(<ReconSeverityBadge severity="low" count={0} />);
    expect(screen.getByTestId('severity-badge-low')).toHaveTextContent('0');
  });

  it('has no banned animation classes', () => {
    const { container } = render(<ReconSeverityBadge severity="high" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).not.toMatch(/animate-pulse/);
    expect(badge.className).not.toMatch(/animate-bounce/);
    expect(badge.className).not.toMatch(/(^| )ring-2 /);
    expect(badge.className).not.toMatch(/(^| )ring-offset-2 /);
  });

  it('accepts a custom className', () => {
    render(<ReconSeverityBadge severity="medium" className="extra-class" />);
    expect(screen.getByTestId('severity-badge-medium').className).toMatch(/extra-class/);
  });

  it('matches en snapshot', () => {
    currentLang = 'en';
    const { container } = render(<ReconSeverityBadge severity="critical" count={3} />);
    expect(container).toMatchSnapshot();
  });

  it('matches ar (RTL) snapshot', () => {
    currentLang = 'ar';
    document.documentElement.dir = 'rtl';
    const { container } = render(<ReconSeverityBadge severity="critical" count={3} />);
    expect(container).toMatchSnapshot();
    document.documentElement.dir = 'ltr';
    currentLang = 'en';
  });
});
