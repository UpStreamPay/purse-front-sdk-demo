import { proxyBase } from '@shared/proxy';

// ─────────────────────────────────────────────────────────────────────────────
// Redaction — this is a trust boundary.
//
// The probe captures request bodies and renders them on a projector, so nothing
// reaches the log unfiltered. In practice the PAN and CVV live inside the
// cross-origin Secure Fields iframes and never touch a parent-page fetch, which
// makes this defence in depth rather than the only line — which is exactly why
// it stays in.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Secrets travel in query strings — the 3DS versioning call and the
 * threeDSMethodNotificationURL inside the method blob both carry `?api-key=`.
 * Anything URL-shaped gets scrubbed before it can reach the screen.
 */
const SECRET_PARAM = /^(api[-_]?key|key|token|secret|signature|sig|password|auth)$/i;

export function scrubUrlSecrets(value: string): string {
  if (!/^https?:\/\//i.test(value) || !value.includes('?')) return value;
  try {
    const u = new URL(value);
    let touched = false;
    for (const name of [...u.searchParams.keys()]) {
      if (SECRET_PARAM.test(name)) {
        u.searchParams.set(name, 'REDACTED');
        touched = true;
      }
    }
    return touched ? u.href : value;
  } catch {
    return value;
  }
}

const SECRET_KEY =
  /pan|card_?number|cvv|cvc|security_?code|expiry|exp_?date|holder|api_?key|apikey|authorization|bearer|secret|password|credential/i;

export const REDACTED = '‹redacted›';
export const MAX_STRING = 2048;
export const MAX_DEPTH = 8;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '‹too deep›';
  if (typeof value === 'string') {
    const scrubbed = scrubUrlSecrets(value);
    return scrubbed.length > MAX_STRING
      ? `${scrubbed.slice(0, MAX_STRING)}… (${scrubbed.length - MAX_STRING} more chars)`
      : scrubbed;
  }
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Match on the key, but only redact a *scalar*. Secrets are scalars — a
      // bearer token, a PAN, an API key. Structured nodes that merely share a
      // name are not: the Payment API v2 response has an `authorization` object
      // carrying the whole outcome of the payment, and blanking it would gut
      // the demo. Recurse into those instead, so anything secret nested inside
      // is still caught.
      const scalar = v === null || typeof v !== 'object';
      out[k] = SECRET_KEY.test(k) && scalar ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

const proxyHost = (): string => {
  try {
    return new URL(proxyBase()).host;
  } catch {
    return '';
  }
};

/**
 * Bodies are only captured for hosts this demo actually drives — the merchant
 * proxy and the Purse CDN/vault origins. Anything else (an ACS, an analytics
 * beacon) is logged as a bare line with no payload.
 */
export function bodyAllowed(host: string): boolean {
  if (host === location.host) return true;
  // The configured proxy — a local Alfred is neither our host nor a Purse one.
  if (host === proxyHost()) return true;
  if (/(^|\.)purse-(sandbox|test|secure)\.com$/.test(host)) return true;
  if (/(^|\.)usp-widget-merchant\./.test(host)) return true;
  return false;
}

export function parseMaybeJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through — render it as text */
    }
  }
  return trimmed;
}
