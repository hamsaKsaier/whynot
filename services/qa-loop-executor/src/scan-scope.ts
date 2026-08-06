import { createLogger } from '../../shared/logger/logger';

const logger = createLogger('scan-scope');

/**
 * Keeps a scan on the app it was pointed at.
 *
 * Real apps link outward — a docs link, a "view on GitHub" badge, a social
 * icon — and an exploratory agent following those links will happily crawl
 * whatever it lands on. That is bad on its own (wasted budget, findings about
 * someone else's site) but the Security agent makes it serious: it submits SQL
 * injection and XSS payloads into forms it finds. Off-target, that is
 * unauthorised security testing of a third party, performed with the
 * self-hoster's own API key and IP address.
 *
 * So navigation is restricted to the target host. The check is deliberately
 * boring: same host, a subdomain of it, or the www/apex pair — anything else
 * is refused and the agent is told to go back.
 */

/** Lowercase, drop a leading "www." so www.example.com and example.com match. */
function normaliseHost(host: string): string {
  const lower = host.toLowerCase();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

/**
 * True when `candidateUrl` may be visited during a scan of `targetUrl`.
 *
 * `extraAllowedUrls` covers legitimate off-host destinations the operator
 * configured themselves — chiefly a login URL on a separate SSO domain, which
 * would otherwise be blocked before the scan could authenticate.
 */
export function isWithinScanScope(
  candidateUrl: string,
  targetUrl: string,
  extraAllowedUrls: Array<string | undefined> = [],
): boolean {
  let candidate: URL;
  let target: URL;

  try {
    candidate = new URL(candidateUrl);
  } catch {
    return false;
  }
  try {
    target = new URL(targetUrl);
  } catch {
    // Without a usable target there is nothing to scope against. Refusing
    // everything would break the scan outright, so allow and let the
    // gateway's own target validation remain the gate.
    return true;
  }

  // Only ever browse the web. Blocks mailto:, javascript:, file:, data: …
  if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
    return false;
  }

  const candidateHost = normaliseHost(candidate.hostname);
  const allowedHosts = [target, ...extraAllowedUrls
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .map(u => { try { return new URL(u); } catch { return null; } })
    .filter((u): u is URL => u !== null)
  ].map(u => normaliseHost(u.hostname));

  return allowedHosts.some(
    host => candidateHost === host || candidateHost.endsWith(`.${host}`),
  );
}

/**
 * Message handed back to the model when it tries to leave. Phrased as an
 * instruction rather than a bare failure so the agent redirects instead of
 * retrying the same URL.
 */
export function outOfScopeMessage(candidateUrl: string, targetUrl: string): string {
  let host = candidateUrl;
  try { host = new URL(candidateUrl).hostname; } catch { /* keep raw */ }

  let targetHost = targetUrl;
  try { targetHost = new URL(targetUrl).hostname; } catch { /* keep raw */ }

  return (
    `Blocked: ${host} is outside the scan target (${targetHost}). ` +
    `This scan may only visit ${targetHost} and its subdomains. ` +
    `Do not try this URL again — go back to ${targetHost} and continue there.`
  );
}

/** Single place to log a refusal, so the operator can see what was skipped. */
export function logOutOfScope(
  sessionId: string,
  toolName: string,
  candidateUrl: string,
  targetUrl: string,
): void {
  logger.warn('Blocked out-of-scope navigation', {
    sessionId,
    tool: toolName,
    candidateUrl,
    targetUrl,
  });
}
