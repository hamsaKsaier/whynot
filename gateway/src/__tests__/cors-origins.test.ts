import { describe, it, expect } from 'vitest';
import { buildCorsOrigins } from '../utils/cors-origins';

describe('buildCorsOrigins', () => {
  it('returns default localhost origins when no env vars set', () => {
    const origins = buildCorsOrigins({});
    expect(origins).toEqual([
      'http://localhost:5183',
      'http://localhost:5184',
    ]);
  });

  it('includes superadmin origin when SUPERADMIN_FRONTEND_URL is set', () => {
    const origins = buildCorsOrigins({
      SUPERADMIN_FRONTEND_URL: 'https://superadmin.whynot.skrum.io',
    });
    expect(origins).toContain('https://superadmin.whynot.skrum.io');
  });

  it('uses custom FRONTEND_URL and ADMIN_FRONTEND_URL', () => {
    const origins = buildCorsOrigins({
      FRONTEND_URL: 'https://whynot.skrum.io',
      ADMIN_FRONTEND_URL: 'https://admin.whynot.skrum.io',
    });
    expect(origins).toContain('https://whynot.skrum.io');
    expect(origins).toContain('https://admin.whynot.skrum.io');
    expect(origins).not.toContain('http://localhost:5183');
    expect(origins).not.toContain('http://localhost:5184');
  });

  it('includes all three production origins', () => {
    const origins = buildCorsOrigins({
      FRONTEND_URL: 'https://whynot.skrum.io',
      ADMIN_FRONTEND_URL: 'https://admin.whynot.skrum.io',
      SUPERADMIN_FRONTEND_URL: 'https://superadmin.whynot.skrum.io',
    });
    expect(origins).toEqual([
      'https://whynot.skrum.io',
      'https://admin.whynot.skrum.io',
      'https://superadmin.whynot.skrum.io',
    ]);
  });

  it('parses CORS_ALLOWED_ORIGINS as comma-separated list', () => {
    const origins = buildCorsOrigins({
      CORS_ALLOWED_ORIGINS: 'https://staging.whynot.skrum.io, https://preview.whynot.skrum.io',
    });
    expect(origins).toContain('https://staging.whynot.skrum.io');
    expect(origins).toContain('https://preview.whynot.skrum.io');
  });

  it('filters out empty strings', () => {
    const origins = buildCorsOrigins({
      SUPERADMIN_FRONTEND_URL: '',
      CORS_ALLOWED_ORIGINS: 'https://a.com,,https://b.com',
    });
    expect(origins).not.toContain('');
    expect(origins).toContain('https://a.com');
    expect(origins).toContain('https://b.com');
  });

  it('filters out wildcard *', () => {
    const origins = buildCorsOrigins({
      CORS_ALLOWED_ORIGINS: '*',
    });
    expect(origins).not.toContain('*');
  });

  it('includes localhost dev origins alongside production', () => {
    const origins = buildCorsOrigins({
      FRONTEND_URL: 'https://whynot.skrum.io',
      ADMIN_FRONTEND_URL: 'https://admin.whynot.skrum.io',
      SUPERADMIN_FRONTEND_URL: 'https://superadmin.whynot.skrum.io',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5183,http://localhost:5184',
    });
    expect(origins).toContain('http://localhost:5183');
    expect(origins).toContain('http://localhost:5184');
    expect(origins).toContain('https://superadmin.whynot.skrum.io');
  });
});
