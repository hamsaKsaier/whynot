/**
 * Centralized admin-frontend configuration.
 *
 * All import.meta.env reads MUST go through this module.
 */

export const config = {
  /** Backend API base URL. */
  apiUrl: import.meta.env.VITE_API_URL || '/api',
} as const;
