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

import { ReconPoCViewer } from '../ReconPoCViewer';
import type { ReconProofOfConcept } from '@/services/recon-api';

const codePoc: ReconProofOfConcept = {
  kind: 'code',
  language: 'sql',
  content: "' OR 1=1 --",
};

const httpPoc: ReconProofOfConcept = {
  kind: 'http',
  language: 'http',
  content: '',
  request: 'GET /users?id=1 HTTP/1.1\nHost: example.com',
  response: 'HTTP/1.1 200 OK\nContent-Type: application/json',
};

const scriptPoc: ReconProofOfConcept = {
  kind: 'script',
  language: 'bash',
  content: 'curl -X POST https://example.com/api/attack',
};

beforeEach(() => {
  currentLang = 'en';
  toastSuccess.mockReset();
});

describe('ReconPoCViewer', () => {
  it('renders code PoC with language hint', () => {
    render(<ReconPoCViewer poc={codePoc} />);
    expect(screen.getByTestId('recon-poc-viewer-code')).toBeInTheDocument();
    expect(screen.getByTestId('recon-poc-code-content')).toHaveTextContent(
      "' OR 1=1 --",
    );
  });

  it('renders http PoC request and response blocks', () => {
    render(<ReconPoCViewer poc={httpPoc} />);
    expect(screen.getByTestId('recon-poc-http-request')).toHaveTextContent(
      'GET /users?id=1',
    );
    expect(screen.getByTestId('recon-poc-http-response')).toHaveTextContent(
      '200 OK',
    );
  });

  it('renders script PoC in a terminal-style block', () => {
    render(<ReconPoCViewer poc={scriptPoc} />);
    expect(screen.getByTestId('recon-poc-script-content')).toHaveTextContent(
      'curl -X POST',
    );
  });

  it('copies PoC content to clipboard and fires analytics hook', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const onCopy = vi.fn();
    render(<ReconPoCViewer poc={codePoc} onCopy={onCopy} />);
    fireEvent.click(screen.getByTestId('recon-poc-copy-button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("' OR 1=1 --"));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Copied');
  });

  it('copies concatenated http request + response', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    render(<ReconPoCViewer poc={httpPoc} />);
    fireEvent.click(screen.getByTestId('recon-poc-copy-button'));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${httpPoc.request}\n\n${httpPoc.response}`,
      ),
    );
  });

  it('renders pre block with dir=ltr even in RTL', () => {
    currentLang = 'ar';
    render(<ReconPoCViewer poc={codePoc} />);
    expect(screen.getByTestId('recon-poc-code-content')).toHaveAttribute(
      'dir',
      'ltr',
    );
  });

  it('matches code snapshot (en)', () => {
    const { container } = render(<ReconPoCViewer poc={codePoc} />);
    expect(container).toMatchSnapshot();
  });

  it('matches http snapshot (en)', () => {
    const { container } = render(<ReconPoCViewer poc={httpPoc} />);
    expect(container).toMatchSnapshot();
  });

  it('matches script snapshot (en)', () => {
    const { container } = render(<ReconPoCViewer poc={scriptPoc} />);
    expect(container).toMatchSnapshot();
  });
});
