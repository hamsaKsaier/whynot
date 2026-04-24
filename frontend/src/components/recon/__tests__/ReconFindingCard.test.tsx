import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import { ReconFindingCard } from '../ReconFindingCard';
import type { ReconFinding, ReconSeverity } from '@/services/recon-api';

const longDescription =
  'This endpoint is vulnerable to SQL injection via the user id parameter. ' +
  'An attacker can bypass authentication and extract database contents. ' +
  'Confirmed with a boolean-based blind payload.';

function makeFinding(overrides: Partial<ReconFinding> = {}): ReconFinding {
  return {
    id: 'finding-1',
    scan_id: 'scan-1',
    severity: 'high',
    vuln_class: 'injection',
    normalized_endpoint: '/api/users/{id}',
    description: longDescription,
    proof_of_concept: {
      kind: 'code',
      language: 'sql',
      content: "' OR 1=1 --",
    },
    remediation_summary: 'Use parameterized queries and validate all input server-side.',
    confirmed_at: '2026-04-20T12:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  currentLang = 'en';
  toastSuccess.mockReset();
});

describe('ReconFindingCard', () => {
  const severities: ReconSeverity[] = ['low', 'medium', 'high', 'critical'];

  it.each(severities)('renders severity "%s" with correct badge', (severity) => {
    render(<ReconFindingCard finding={makeFinding({ severity })} />);
    expect(screen.getByTestId(`severity-badge-${severity}`)).toBeInTheDocument();
  });

  it('renders vulnerability class chip', () => {
    render(<ReconFindingCard finding={makeFinding({ vuln_class: 'xss' })} />);
    expect(screen.getByTestId('recon-finding-vuln-class')).toHaveTextContent(
      'Cross-Site Scripting (XSS)',
    );
  });

  it('renders endpoint with title attribute for truncation', () => {
    render(<ReconFindingCard finding={makeFinding()} />);
    const code = screen.getByTestId('recon-finding-endpoint');
    expect(code).toHaveAttribute('title', '/api/users/{id}');
    expect(code).toHaveAttribute('dir', 'ltr');
  });

  it('copies the endpoint to clipboard when the copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<ReconFindingCard finding={makeFinding()} />);
    fireEvent.click(screen.getByTestId('recon-finding-copy-endpoint'));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('/api/users/{id}'),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('toggles description expansion with Show more / Show less', () => {
    render(<ReconFindingCard finding={makeFinding()} />);
    const toggle = screen.getByTestId('recon-finding-desc-toggle');
    expect(toggle).toHaveTextContent('Show more');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Show less');
    const desc = screen.getByTestId('recon-finding-description');
    expect(desc.className).not.toMatch(/line-clamp-2/);
  });

  it('does not show the description toggle for short descriptions', () => {
    render(
      <ReconFindingCard finding={makeFinding({ description: 'Short desc.' })} />,
    );
    expect(
      screen.queryByTestId('recon-finding-desc-toggle'),
    ).not.toBeInTheDocument();
  });

  it('expands PoC viewer when toggle is clicked and fires onCopyPoC on copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const onCopyPoC = vi.fn();
    render(
      <ReconFindingCard finding={makeFinding()} onCopyPoC={onCopyPoC} />,
    );
    const pocToggle = screen.getByTestId('recon-finding-poc-toggle');
    expect(pocToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(pocToggle);
    expect(pocToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('recon-finding-poc-region')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('recon-poc-copy-button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("' OR 1=1 --"));
    expect(onCopyPoC).toHaveBeenCalledTimes(1);
  });

  it('respects defaultExpanded=true', () => {
    render(<ReconFindingCard finding={makeFinding()} defaultExpanded />);
    expect(
      screen.getByTestId('recon-finding-poc-toggle'),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('recon-finding-poc-region')).toBeInTheDocument();
  });

  it('omits the PoC section when proof_of_concept is null', () => {
    render(
      <ReconFindingCard finding={makeFinding({ proof_of_concept: null })} />,
    );
    expect(
      screen.queryByTestId('recon-finding-poc-toggle'),
    ).not.toBeInTheDocument();
  });

  it('renders remediation and View details link', () => {
    const onViewDetails = vi.fn();
    render(
      <ReconFindingCard
        finding={makeFinding()}
        onViewDetails={onViewDetails}
      />,
    );
    expect(screen.getByTestId('recon-finding-remediation')).toHaveTextContent(
      /parameterized queries/i,
    );
    fireEvent.click(screen.getByTestId('recon-finding-view-details'));
    expect(onViewDetails).toHaveBeenCalledWith('finding-1');
  });

  it('exposes an aria-labelledby region', () => {
    const { container } = render(<ReconFindingCard finding={makeFinding()} />);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    const labelledBy = section?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const label = document.getElementById(labelledBy!);
    expect(label).not.toBeNull();
    expect(label?.className).toMatch(/sr-only/);
  });

  it('has no banned Uncodixify classNames on the card root', () => {
    const { container } = render(<ReconFindingCard finding={makeFinding()} />);
    const section = container.querySelector('section') as HTMLElement;
    const html = section.outerHTML;
    const banned = [
      /hover:-translate-y/,
      /hover:shadow-md/,
      /hover:shadow-lg/,
      /transition-all/,
      /rounded-2xl/,
      /rounded-3xl/,
      /bg-gradient-to-/,
      /backdrop-blur/,
      /hover:scale-/,
      /animate-bounce/,
    ];
    for (const rx of banned) {
      expect(html).not.toMatch(rx);
    }
    // The card root must not be rounded-full
    expect(section.className).not.toMatch(/rounded-full/);
    // No animate-pulse on the card root
    expect(section.className).not.toMatch(/animate-pulse/);
  });

  it('has no min-h-[44px] / min-w-[44px] applied to any Switch (none rendered, but verify absence)', () => {
    const { container } = render(<ReconFindingCard finding={makeFinding()} />);
    // No Switch component should be in this card at all
    expect(container.querySelector('[role="switch"]')).toBeNull();
    // And no banned sizing classes anywhere in the DOM tree
    expect(container.innerHTML).not.toMatch(/min-h-\[44px\]/);
    expect(container.innerHTML).not.toMatch(/min-w-\[44px\]/);
  });

  it('matches en snapshot', () => {
    const { container } = render(<ReconFindingCard finding={makeFinding()} />);
    expect(container).toMatchSnapshot();
  });

  it('matches ar (RTL) snapshot', () => {
    currentLang = 'ar';
    document.documentElement.dir = 'rtl';
    const { container } = render(<ReconFindingCard finding={makeFinding()} />);
    expect(container).toMatchSnapshot();
    document.documentElement.dir = 'ltr';
    currentLang = 'en';
  });
});
