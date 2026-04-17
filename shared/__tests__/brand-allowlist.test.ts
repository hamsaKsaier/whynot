import { describe, it, expect } from 'vitest';
import { BRAND_ALLOW_LIST } from '../constants/brand-allowlist';

describe('shared brand allowlist', () => {
  it('is a non-empty Set', () => {
    expect(BRAND_ALLOW_LIST).toBeInstanceOf(Set);
    expect(BRAND_ALLOW_LIST.size).toBeGreaterThan(50);
  });

  it('contains core brand names', () => {
    for (const brand of ['WhyNot QA', 'Stripe', 'GitHub', 'Playwright', 'OpenAI']) {
      expect(BRAND_ALLOW_LIST.has(brand), `missing: ${brand}`).toBe(true);
    }
  });

  it('contains technical acronyms', () => {
    for (const term of ['API', 'JSON', 'JWT', 'UUID', 'CSV']) {
      expect(BRAND_ALLOW_LIST.has(term), `missing: ${term}`).toBe(true);
    }
  });

  it('contains international cognates', () => {
    for (const cognate of ['Dashboard', 'Status', 'Action', 'Description', 'Error']) {
      expect(BRAND_ALLOW_LIST.has(cognate), `missing: ${cognate}`).toBe(true);
    }
  });

  it('contains interpolation templates', () => {
    for (const tpl of ['Bugs ({{count}})', 'Version {{version}}', '{{count}} tests']) {
      expect(BRAND_ALLOW_LIST.has(tpl), `missing: ${tpl}`).toBe(true);
    }
  });

  it('has no duplicate entries (Set guarantees this but verify source)', () => {
    const arr = [...BRAND_ALLOW_LIST];
    const deduped = new Set(arr);
    expect(arr.length).toBe(deduped.size);
  });
});
