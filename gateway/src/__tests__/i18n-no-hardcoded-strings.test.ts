/**
 * i18n-no-hardcoded-strings.test.ts
 *
 * Lint test that fails if hardcoded English error/success strings are found
 * in API route handlers or middleware instead of using req.t().
 *
 * Scans gateway/src/api/**\/*.ts and gateway/src/middleware/**\/*.ts for patterns like:
 *   res.status(4xx).json({ error: "literal" })
 *   res.json({ error: "literal" })
 *   res.json({ message: "literal" })
 *   createError('literal', ...) without messageKey
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const API_DIR = path.resolve(__dirname, '../api');
const MIDDLEWARE_DIR = path.resolve(__dirname, '../middleware');

/**
 * Files/patterns to exclude from the check.
 * Stripe webhook responses go to Stripe (not users) and run before i18n middleware.
 */
const EXCLUDED_FILES = [
  'webhooks/stripe.ts',   // Runs before i18n middleware (system-to-system)
];

/**
 * Specific patterns that are allowed even though they look like hardcoded strings.
 * These are typically JSON field names, HTTP methods, or non-user-facing identifiers.
 */
const ALLOWED_PATTERNS = [
  /{ received: true/,               // Stripe webhook acknowledgement
  /{ success: true }/,              // Simple success without message
  /{ hasCredentials:/,              // Boolean response field
  /{ connected:/,                   // Status check response
  /{ preferences:/,                 // Preference object response
  /dedupe: 'duplicate'/,            // Idempotency marker
  /'Content-Type'/,                 // HTTP header
  /'application\/json'/,            // Content type
  /error\.response\?\.data/,        // Forwarded upstream error
];

/**
 * Lines inside standalone utility functions (without access to `req`)
 * that validate input before the route handler catches the error.
 * These throw errors caught by asyncHandler -> errorHandler, which has req.t().
 * These now use messageKey for i18n but still have English fallback in the message param.
 */
const UTILITY_FUNCTION_PATTERNS = [
  /targetUrl must be a valid URL/,
  /targetUrl must use http or https/,
  /Cannot scan localhost/,
  /Cannot scan private network/,
  /targetUrl may not point to/,
  /targetUrl may not use decimal/,
  /Invalid date range/,             // parseDateRange utility (no req)
  /GitHub repo not configured/,     // reportBugToGithub helper (no req)
  /GitHub repo access token/,       // reportBugToGithub helper (no req)
  /ClickUp API error:/,             // reportBugToClickUp helper (no req)
  /ClickUp not connected/,          // reportBugToClickUp helper (no req)
  /ClickUp list not configured/,    // reportBugToClickUp helper (no req)
  /Validation failed:/,             // Zod validation wrapper (uses messageKey)
  /Invalid URL format:/,            // sanitizeUrl utility (uses messageKey)
  /Text must be a non-empty/,       // sanitizeText utility (uses messageKey)
  /Text exceeds maximum/,           // sanitizeText utility (uses messageKey)
  /Invalid protocol/,               // sanitizeUrl utility (uses messageKey)
  /Rate limit exceeded/,            // checkScanRateLimit utility (uses messageKey)
  /No workspace found/,             // resolveWorkspace utility (uses messageKey)
];

function findTsFiles(dir: string, basePath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath, basePath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      const relativePath = path.relative(basePath, fullPath);
      if (!EXCLUDED_FILES.includes(relativePath)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

interface HardcodedMatch {
  file: string;
  line: number;
  text: string;
}

/**
 * Check a file for hardcoded English strings in API responses.
 * Detects patterns like:
 *   .json({ error: 'Some literal' })
 *   .json({ message: 'Some literal' })
 * But NOT:
 *   .json({ error: req.t('...') })
 *   .json({ error: (req as any).t('...') })
 */
function checkForHardcodedStrings(filePath: string): HardcodedMatch[] {
  const source = fs.readFileSync(filePath, 'utf-8');
  const lines = source.split('\n');
  const matches: HardcodedMatch[] = [];
  const relativePath = path.relative(path.resolve(__dirname, '../..'), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and imports
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('import')) continue;

    // Pattern: res.status(4xx or 5xx).json({ error: 'literal' })
    const errorPattern = /\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]/;
    const errorMatch = errorPattern.exec(line);
    if (errorMatch) {
      if (!line.includes('.t(') && !line.includes('error.response') && !line.includes('error.message')) {
        if (!ALLOWED_PATTERNS.some(p => p.test(line))) {
          matches.push({
            file: relativePath,
            line: lineNum,
            text: line.trim(),
          });
        }
      }
    }

    // Pattern: createError('literal string', ...) where first arg is a plain string
    const createErrorPattern = /createError\(\s*['"]([^'"]+)['"]/;
    const createErrorMatch = createErrorPattern.exec(line);
    if (createErrorMatch) {
      if (!line.includes('.t(')) {
        const msg = createErrorMatch[1];
        // Skip environment variable errors and encryption key errors (developer-facing)
        if (msg.includes('environment variable') || msg.includes('ENCRYPTION_KEY') || msg.includes('not set')) {
          continue;
        }
        // Skip utility function validation messages (they use messageKey for i18n)
        if (UTILITY_FUNCTION_PATTERNS.some(p => p.test(msg))) {
          continue;
        }
        // Skip createError calls that have messageKey parameter (5th arg or later)
        if (/createError\([^)]*,\s*'errors:/.test(line)) {
          continue;
        }
        matches.push({
          file: relativePath,
          line: lineNum,
          text: line.trim(),
        });
      }
    }

    // Pattern: res.json({ message: 'literal' }) where message is a user-facing string
    const messagePattern = /\.json\(\s*\{[^}]*message:\s*['"]([^'"]+)['"]/;
    const messageMatch = messagePattern.exec(line);
    if (messageMatch) {
      if (!line.includes('.t(')) {
        if (!ALLOWED_PATTERNS.some(p => p.test(line))) {
          matches.push({
            file: relativePath,
            line: lineNum,
            text: line.trim(),
          });
        }
      }
    }
  }

  return matches;
}

describe('i18n — no hardcoded English strings in API handlers and middleware', () => {
  it('no hardcoded error strings in res.json() or createError() calls', () => {
    const apiFiles = findTsFiles(API_DIR, API_DIR);
    const middlewareFiles = findTsFiles(MIDDLEWARE_DIR, MIDDLEWARE_DIR);
    const allFiles = [...apiFiles, ...middlewareFiles];

    expect(allFiles.length).toBeGreaterThan(0);

    const allMatches: HardcodedMatch[] = [];
    for (const file of allFiles) {
      allMatches.push(...checkForHardcodedStrings(file));
    }

    if (allMatches.length > 0) {
      const report = allMatches
        .map(m => `  ${m.file}:${m.line} — ${m.text}`)
        .join('\n');
      expect.fail(
        `Found ${allMatches.length} hardcoded English string(s) in API handlers/middleware.\n` +
        `These should use req.t() for i18n:\n${report}`
      );
    }
  });
});
