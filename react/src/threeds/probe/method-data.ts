// ─────────────────────────────────────────────────────────────────────────────
// threeDSMethodData
//
// The 3DS Method (the "fingerprint") is an ACS-hosted page loaded in a hidden
// iframe, POSTed a single base64url field. Decoding it is the money shot of the
// demo: it carries the transaction id the whole authentication hangs off, and
// the URL the ACS calls back when the fingerprint completes.
// ─────────────────────────────────────────────────────────────────────────────

export type ThreeDSMethodData = {
  threeDSServerTransID?: string;
  threeDSMethodNotificationURL?: string;
  [key: string]: unknown;
};

export function decodeThreeDSMethodData(raw: string): ThreeDSMethodData | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as ThreeDSMethodData;
  } catch {
    return null;
  }
}

/** Pull a threeDSMethodData out of anywhere it might turn up: a URL, a form, a message. */
export function findThreeDSMethodData(haystack: unknown): ThreeDSMethodData | null {
  if (typeof haystack === 'string') {
    const match = /threeDSMethodData[=:"\s]+([A-Za-z0-9_\-+/=]{16,})/.exec(haystack);
    return match ? decodeThreeDSMethodData(match[1]) : null;
  }
  if (Array.isArray(haystack)) {
    for (const item of haystack) {
      const found = findThreeDSMethodData(item);
      if (found) return found;
    }
    return null;
  }
  if (haystack && typeof haystack === 'object') {
    for (const [k, v] of Object.entries(haystack)) {
      if (/threeDSMethodData/i.test(k) && typeof v === 'string') {
        const decoded = decodeThreeDSMethodData(v);
        if (decoded) return decoded;
      }
      const found = findThreeDSMethodData(v);
      if (found) return found;
    }
  }
  return null;
}
