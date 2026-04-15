/**
 * Build the list of allowed CORS origins from environment variables.
 *
 * Reads:
 *   FRONTEND_URL           – main SPA origin          (default http://localhost:5183)
 *   ADMIN_FRONTEND_URL     – admin SPA origin          (default http://localhost:5184)
 *   SUPERADMIN_FRONTEND_URL – superadmin alias origin  (no default)
 *   CORS_ALLOWED_ORIGINS   – comma-separated extras    (optional)
 *
 * Filters out empty strings and the wildcard '*'.
 */
export function buildCorsOrigins(env: Record<string, string | undefined> = process.env): string[] {
  return [
    env.FRONTEND_URL || 'http://localhost:5183',
    env.ADMIN_FRONTEND_URL || 'http://localhost:5184',
    env.SUPERADMIN_FRONTEND_URL || '',
    ...(env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
  ].filter(o => o && o !== '*');
}
