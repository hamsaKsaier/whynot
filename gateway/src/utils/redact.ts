const SENSITIVE_KEY = /pass(word)?|secret|token|api[_-]?key|authorization|cookie|credential|jwt|priv(ate)?[_-]?key/i;

/**
 * Return a deep copy of an object with the values of sensitive-looking keys
 * replaced by '[REDACTED]'. Used before logging request bodies so secrets
 * (passwords, API keys, tokens) never reach the logs.
 *
 * Matches keys by name, case-insensitive, including nested objects/arrays.
 */
export function redactSecrets(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) out[k] = '[REDACTED]';
    else if (v && typeof v === 'object') out[k] = redactSecrets(v);
    else out[k] = v;
  }
  return out;
}
