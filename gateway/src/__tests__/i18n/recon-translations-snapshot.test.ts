/**
 * Locks in Recon-related translation strings across all supported locales.
 *
 * Tests cover at least one key per required namespace (errors, success,
 * validation, billing) per locale. Snapshotting guards against silent string
 * drift — any change to a customer-facing translation must be explicit.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES = ['en', 'ar', 'de', 'es', 'fr'] as const;
type Locale = (typeof LOCALES)[number];

const KEYS = {
  errors: [
    'recon.payment.required',
    'recon.authorization.required',
    'recon.authorization.justification.tooShort',
    'recon.rateLimit.exceeded',
    'recon.resume.urlMismatch',
    'recon.scan.notFound',
    'recon.scan.invalidStatus',
    'recon.project.repoRequired',
    'recon.environment.urlRequired',
    'recon.warnings.environmentProduction',
  ],
  success: ['recon.scan.created', 'recon.scan.cancelled', 'recon.scan.resumed'],
  validation: ['recon.authorization.acknowledged', 'recon.targetUrl.invalid'],
  billing: ['recon.scan.includedQuota', 'recon.scan.paygCost'],
} as const;

function loadNamespace(locale: Locale, namespace: string): Record<string, string> {
  const path = join(
    __dirname,
    '..',
    '..',
    'i18n',
    'translations',
    locale,
    `${namespace}.json`,
  );
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('Recon translations — completeness', () => {
  for (const locale of LOCALES) {
    for (const [namespace, keys] of Object.entries(KEYS)) {
      it(`${locale}/${namespace} contains all Recon keys`, () => {
        const ns = loadNamespace(locale, namespace);
        for (const key of keys) {
          expect(ns[key], `missing ${namespace}:${key} in ${locale}`).toBeTruthy();
          expect(typeof ns[key]).toBe('string');
          expect(ns[key].length).toBeGreaterThan(0);
        }
      });
    }
  }
});

describe('Recon translations — snapshot', () => {
  for (const locale of LOCALES) {
    it(`${locale} errors:recon.payment.required is stable`, () => {
      const ns = loadNamespace(locale, 'errors');
      expect(ns['recon.payment.required']).toMatchSnapshot();
    });

    it(`${locale} success:recon.scan.created is stable`, () => {
      const ns = loadNamespace(locale, 'success');
      expect(ns['recon.scan.created']).toMatchSnapshot();
    });

    it(`${locale} validation:recon.authorization.acknowledged is stable`, () => {
      const ns = loadNamespace(locale, 'validation');
      expect(ns['recon.authorization.acknowledged']).toMatchSnapshot();
    });

    it(`${locale} billing:recon.scan.includedQuota is stable`, () => {
      const ns = loadNamespace(locale, 'billing');
      expect(ns['recon.scan.includedQuota']).toMatchSnapshot();
    });
  }
});

describe('Recon translations — banned vocabulary (recon-safety #6)', () => {
  const BANNED = [
    'Shannon',
    'KeygraphHQ',
    'nmap',
    'subfinder',
    'whatweb',
    'schemathesis',
    'Playwright',
    'Anthropic',
    'Claude',
  ];

  for (const locale of LOCALES) {
    for (const namespace of Object.keys(KEYS)) {
      it(`${locale}/${namespace} has no banned vendor/tool names in Recon strings`, () => {
        const ns = loadNamespace(locale, namespace);
        const reconStrings = Object.entries(ns)
          .filter(([k]) => k.startsWith('recon.'))
          .map(([, v]) => v);
        for (const value of reconStrings) {
          for (const banned of BANNED) {
            expect(
              value.toLowerCase().includes(banned.toLowerCase()),
              `banned vocab "${banned}" in ${locale}/${namespace}: ${value}`,
            ).toBe(false);
          }
        }
      });
    }
  }
});
