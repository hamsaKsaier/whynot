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

import { ReconScanStatusBadge } from '../ReconScanStatusBadge';
import type { ReconScanStatus } from '@/services/recon-api';

describe('ReconScanStatusBadge', () => {
  const statuses: ReconScanStatus[] = [
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled',
    'stuck',
  ];

  it.each(statuses)('renders status "%s"', (status) => {
    render(<ReconScanStatusBadge status={status} />);
    expect(screen.getByTestId(`scan-status-badge-${status}`)).toBeInTheDocument();
  });

  it('applies animate-spin only to the running status', () => {
    const { container: running } = render(<ReconScanStatusBadge status="running" />);
    expect(running.querySelector('.animate-spin')).toBeInTheDocument();

    const { container: completed } = render(<ReconScanStatusBadge status="completed" />);
    expect(completed.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('accepts a custom className', () => {
    render(<ReconScanStatusBadge status="failed" className="extra-1" />);
    expect(screen.getByTestId('scan-status-badge-failed').className).toMatch(/extra-1/);
  });

  it('matches en snapshot', () => {
    currentLang = 'en';
    const { container } = render(<ReconScanStatusBadge status="running" />);
    expect(container).toMatchSnapshot();
  });

  it('matches ar (RTL) snapshot', () => {
    currentLang = 'ar';
    document.documentElement.dir = 'rtl';
    const { container } = render(<ReconScanStatusBadge status="running" />);
    expect(container).toMatchSnapshot();
    document.documentElement.dir = 'ltr';
    currentLang = 'en';
  });
});
