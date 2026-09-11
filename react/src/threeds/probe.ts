/**
 * Browser instrumentation for the 3DS fingerprint showcase.
 *
 * Why this exists: `@purse-eu/web-sdk` exposes no 3DS API at all. There is no
 * `threeDS` member on `SecureFieldsConfig`, no `threeDSServerTransID` on
 * `SubmitResult` and no 3DS entry in `SecureFieldsEvents` (see
 * node_modules/@purse-eu/web-sdk/dist/generated/types/securefields.d.ts). The
 * runtime that performs versioning and the device fingerprint is fetched from
 * cdn.purse-*.com at load time and is not part of this repo.
 *
 * So the only way to *show* the fingerprint happening is to watch the browser
 * do it: patch fetch/XHR, listen for postMessages, observe the DOM for the
 * hidden iframe, and read the resource timings. Everything here is observation
 * — nothing is inferred, and a step with no evidence is reported as
 * unobserved rather than assumed to have happened.
 *
 * Install before the SDK loads (see main.tsx), or the CDN bundle captures the
 * originals first and the patches see nothing.
 */

export type HttpEvent = {
  kind: 'http';
  id: number;
  at: number;
  ms?: number;
  via: 'fetch' | 'xhr';
  method: string;
  url: string;
  host: string;
  path: string;
  status?: number | 'error';
  reqBody?: unknown;
  resBody?: unknown;
};

export type MessageEvent_ = {
  kind: 'message';
  id: number;
  at: number;
  origin: string;
  keys: string[];
  preview: unknown;
};

export type IframeEvent = {
  kind: 'iframe';
  id: number;
  at: number;
  name: string;
  src: string;
  width: number;
  height: number;
  concealed: boolean;
};

export type FormEvent = {
  kind: 'form';
  id: number;
  at: number;
  action: string;
  target: string;
  inputs: string[];
};

export type ResourceEvent = {
  kind: 'resource';
  id: number;
  at: number;
  ms: number;
  url: string;
  host: string;
  initiatorType: string;
};

/** A milestone emitted by the demo itself, to anchor the observed events. */
export type MarkEvent = {
  kind: 'mark';
  id: number;
  at: number;
  label: string;
  detail?: unknown;
};

export type ProbeEvent =
  | HttpEvent
  | MessageEvent_
  | IframeEvent
  | FormEvent
  | ResourceEvent
  | MarkEvent;

// ─────────────────────────────────────────────────────────────────────────────
// Redaction — this is a trust boundary.
//
// The probe captures request bodies and renders them on a projector, so nothing
// reaches the log unfiltered. In practice the PAN and CVV live inside the
// cross-origin Secure Fields iframes and never touch a parent-page fetch, which
// makes this defence in depth rather than the only line — which is exactly why
// it stays in.
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_KEY =
  /pan|card_?number|cvv|cvc|security_?code|expiry|exp_?date|holder|api_?key|apikey|authorization|bearer|secret|password|credential/i;

const REDACTED = '‹redacted›';
const MAX_STRING = 2048;
const MAX_DEPTH = 8;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '‹too deep›';
  if (typeof value === 'string') {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}… (${value.length - MAX_STRING} more chars)`
      : value;
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

/**
 * Bodies are only captured for hosts this demo actually drives — the merchant
 * proxy and the Purse CDN/vault origins. Anything else (an ACS, an analytics
 * beacon) is logged as a bare line with no payload.
 */
function bodyAllowed(host: string): boolean {
  if (host === location.host) return true;
  if (/(^|\.)purse-(sandbox|test|secure)\.com$/.test(host)) return true;
  if (/(^|\.)usp-widget-merchant\./.test(host)) return true;
  return false;
}

function parseMaybeJson(text: string): unknown {
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

// ─────────────────────────────────────────────────────────────────────────────
// The log
// ─────────────────────────────────────────────────────────────────────────────

let events: ProbeEvent[] = [];
let listeners: Array<() => void> = [];
let nextId = 0;
let origin = performance.now();
let installed = false;

// Distributes over the union — a plain Omit<ProbeEvent, …> would collapse it to
// the shared keys and reject every variant's own fields.
type Draft<T> = T extends unknown ? Omit<T, 'id' | 'at'> & { at?: number } : never;

function emit(event: Draft<ProbeEvent>): ProbeEvent {
  const full = {
    ...event,
    id: nextId++,
    at: event.at ?? Math.round(performance.now() - origin),
  } as ProbeEvent;
  // New array reference on every push: useSyncExternalStore compares by identity.
  events = [...events, full];
  for (const l of listeners) l();
  return full;
}

export function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function getSnapshot(): ProbeEvent[] {
  return events;
}

/** A milestone from the demo's own code, so observed traffic has anchors. */
export function mark(label: string, detail?: unknown): void {
  emit({ kind: 'mark', label, detail: detail === undefined ? undefined : redact(detail) });
}

/** Clear the log so a second run on stage starts from nothing. */
export function reset(): void {
  events = [];
  nextId = 0;
  origin = performance.now();
  for (const l of listeners) l();
}

// ─────────────────────────────────────────────────────────────────────────────
// The four observers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Secrets travel in query strings too — the 3DS versioning endpoint is called as
 * `…/payment/v2/3ds/versioning?api-key=<key>`. This trace goes on a projector,
 * so the value never survives into the log.
 */
const SECRET_PARAM = /^(api[-_]?key|key|token|secret|signature|sig|password|auth)$/i;

function splitUrl(raw: string): { url: string; host: string; path: string } {
  try {
    const u = new URL(raw, location.href);
    for (const name of [...u.searchParams.keys()]) {
      if (SECRET_PARAM.test(name)) u.searchParams.set(name, REDACTED);
    }
    return { url: u.href, host: u.host, path: u.pathname + u.search };
  } catch {
    return { url: raw, host: '?', path: raw };
  }
}

function patchFetch(): void {
  const original = window.fetch;
  window.fetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
    const [input, init] = args;
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const { url, host, path } = splitUrl(raw);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const started = performance.now();

    const event = emit({
      kind: 'http',
      via: 'fetch',
      method,
      url,
      host,
      path,
      reqBody:
        bodyAllowed(host) && typeof init?.body === 'string'
          ? redact(parseMaybeJson(init.body))
          : undefined,
    }) as HttpEvent;

    try {
      const response = await original.apply(this as typeof globalThis, args);
      event.ms = Math.round(performance.now() - started);
      event.status = response.status;
      if (bodyAllowed(host)) {
        // Read from a clone so the caller still gets an unconsumed body.
        response
          .clone()
          .text()
          .then(text => {
            event.resBody = redact(parseMaybeJson(text));
            events = [...events];
            for (const l of listeners) l();
          })
          .catch(() => undefined);
      }
      events = [...events];
      for (const l of listeners) l();
      return response;
    } catch (error) {
      event.ms = Math.round(performance.now() - started);
      event.status = 'error';
      events = [...events];
      for (const l of listeners) l();
      throw error;
    }
  };
}

function patchXhr(): void {
  // The CDN bundle is not ours and may well use XHR rather than fetch.
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  const store = new WeakMap<XMLHttpRequest, { method: string; raw: string }>();

  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    store.set(this, { method: method.toUpperCase(), raw: String(url) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (open as any).call(this, method, url, ...rest);
  } as typeof open;

  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = store.get(this);
    if (meta) {
      const { url, host, path } = splitUrl(meta.raw);
      const started = performance.now();
      const event = emit({
        kind: 'http',
        via: 'xhr',
        method: meta.method,
        url,
        host,
        path,
        reqBody:
          bodyAllowed(host) && typeof body === 'string' ? redact(parseMaybeJson(body)) : undefined,
      }) as HttpEvent;

      this.addEventListener('loadend', () => {
        event.ms = Math.round(performance.now() - started);
        event.status = this.status || 'error';
        if (bodyAllowed(host) && typeof this.responseText === 'string') {
          event.resBody = redact(parseMaybeJson(this.responseText));
        }
        events = [...events];
        for (const l of listeners) l();
      });
    }
    return send.call(this, body ?? null);
  };
}

function watchMessages(): void {
  window.addEventListener(
    'message',
    e => {
      let keys: string[] = [];
      let preview: unknown = e.data;
      try {
        if (e.data && typeof e.data === 'object') {
          keys = Object.keys(e.data as object);
          preview = redact(e.data);
        } else {
          preview = redact(e.data);
        }
      } catch {
        preview = '‹unreadable›';
      }
      emit({ kind: 'message', origin: e.origin || '(same document)', keys, preview });
    },
    true,
  );
}

function watchDom(): void {
  const seen = new WeakSet<Element>();

  const record = (el: Element) => {
    if (seen.has(el)) return;
    seen.add(el);

    if (el instanceof HTMLIFrameElement) {
      emit({
        kind: 'iframe',
        name: el.name || '(unnamed)',
        src: el.src || '(about:blank)',
        width: el.offsetWidth,
        height: el.offsetHeight,
        concealed: isConcealed(el),
      });
      if (revealArmed) revealOne(el);
    }

    if (el instanceof HTMLFormElement) {
      emit({
        kind: 'form',
        action: el.action || '(none)',
        target: el.target || '(self)',
        inputs: [...el.querySelectorAll('input')].map(i => i.name || '(unnamed)'),
      });
    }
  };

  new MutationObserver(records => {
    for (const record_ of records) {
      for (const node of record_.addedNodes) {
        if (!(node instanceof Element)) continue;
        record(node);
        for (const nested of node.querySelectorAll('iframe, form')) record(nested);
      }
      // The 3DS Method frame is torn down once the ACS has called back. Worth
      // showing: it is the moment the invisible step finishes.
      for (const node of record_.removedNodes) {
        if (node instanceof HTMLIFrameElement && /3ds|threeds/i.test(node.name)) {
          emit({
            kind: 'iframe',
            name: `${node.name} (removed)`,
            src: node.src || '(about:blank)',
            width: 0,
            height: 0,
            concealed: true,
          });
          REVEALED.delete(node);
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

function watchResources(): void {
  // The cross-origin ACS Method URL leaves no DOM trace we can read, but it
  // does leave a resource timing entry — often the only proof it was hit.
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const { host } = splitUrl(entry.name);
        if (host === location.host) continue;
        emit({
          kind: 'resource',
          at: Math.round(entry.startTime - origin),
          ms: Math.round(entry.duration),
          url: entry.name,
          host,
          initiatorType: (entry as PerformanceResourceTiming).initiatorType,
        });
      }
    }).observe({ type: 'resource', buffered: true });
  } catch {
    // PerformanceObserver with `type` is unsupported — the rest still works.
  }
}

export function install(): void {
  if (installed) return;
  installed = true;
  origin = performance.now();
  patchFetch();
  patchXhr();
  watchMessages();
  watchDom();
  watchResources();
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-check
//
// There is no test runner in this repo, so the two pieces of non-trivial pure
// logic check themselves on every dev page load (see main.tsx). A broken
// redactor throws here rather than leaking a card number onto a projector.
// ─────────────────────────────────────────────────────────────────────────────

export function selfCheck(): void {
  const assert = (ok: boolean, what: string) => {
    if (!ok) throw new Error(`probe self-check failed: ${what}`);
  };

  const dirty = {
    amount: 1250,
    split: [{ card_number: '4111111111111111', cvv: '123', partner: 'uspmock' }],
    headers: { Authorization: 'Bearer abc', 'content-type': 'application/json' },
    apiKey: 'sk_live_nope',
  };
  const clean = redact(dirty) as typeof dirty & Record<string, unknown>;
  const json = JSON.stringify(clean);
  assert(!json.includes('4111111111111111'), 'card_number survived redaction');
  assert(!json.includes('123456') && !/"cvv":"123"/.test(json), 'cvv survived redaction');
  assert(!json.includes('sk_live_nope'), 'apiKey survived redaction');
  assert(!json.includes('Bearer abc'), 'Authorization survived redaction');
  assert(clean.amount === 1250, 'redaction ate a non-secret number');
  assert(clean.split[0].partner === 'uspmock', 'redaction ate a non-secret string');
  assert(
    (clean.headers as Record<string, string>)['content-type'] === 'application/json',
    'redaction ate a non-secret header',
  );

  // A structured node whose key collides with a secret name must survive — the
  // v2 payment response's `authorization` object is exactly this case.
  const structured = redact({
    authorization: { status: 'AUTHORIZED', partner_transactions: [{ amount: 480 }] },
    headers: { authorization: 'Bearer nope' },
  }) as { authorization: { status: string }; headers: { authorization: string } };
  assert(structured.authorization.status === 'AUTHORIZED', 'authorization object was redacted away');
  assert(structured.headers.authorization === REDACTED, 'authorization header was not redacted');

  const long = redact('x'.repeat(MAX_STRING + 500)) as string;
  assert(long.length < MAX_STRING + 100, 'long strings are not truncated');

  const sample = { threeDSServerTransID: 'abc-123', threeDSMethodNotificationURL: 'https://vault/n' };
  const encoded = btoa(JSON.stringify(sample));
  const decoded = decodeThreeDSMethodData(encoded);
  assert(decoded?.threeDSServerTransID === 'abc-123', 'threeDSMethodData did not round-trip');
  assert(
    decoded?.threeDSMethodNotificationURL === 'https://vault/n',
    'notification URL did not round-trip',
  );
  assert(decodeThreeDSMethodData('not base64 at all !!') === null, 'garbage did not return null');
  assert(decodeThreeDSMethodData(btoa('"a string"')) === null, 'non-object did not return null');

  assert(
    findThreeDSMethodData({ body: `threeDSMethodData=${encoded}` })?.threeDSServerTransID === 'abc-123',
    'threeDSMethodData not found inside a string',
  );
  assert(findThreeDSMethodData({ nothing: 'here' }) === null, 'false positive on a clean object');
}

/**
 * Presenter trick: make the hidden 3DS Method iframe visible.
 *
 * The fingerprint iframe is deliberately invisible — 1×1, or display:none. If
 * the SDK puts it in our document we can force it on screen, which is the most
 * literal way to show an audience the invisible step. Secure Fields' own field
 * iframes are left alone: they are inside `.sf-field` and are meant to be seen.
 */
const REVEALED = new Map<HTMLIFrameElement, string>();
let revealArmed = false;

const REVEAL_CSS =
  ';display:block!important;visibility:visible!important;opacity:1!important;' +
  'position:fixed!important;right:16px!important;bottom:16px!important;' +
  'width:320px!important;height:220px!important;z-index:50!important;' +
  'border:2px solid #6366f1!important;border-radius:10px!important;background:#fff!important;';

function isConcealed(frame: HTMLIFrameElement): boolean {
  const style = getComputedStyle(frame);
  return (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    frame.offsetWidth <= 1 ||
    frame.offsetHeight <= 1
  );
}

function revealOne(frame: HTMLIFrameElement): void {
  if (REVEALED.has(frame)) return;
  // Secure Fields' own field iframes live inside .sf-field and are meant to be
  // seen; leave them alone.
  if (frame.closest('.sf-field')) return;
  if (!isConcealed(frame)) return;
  REVEALED.set(frame, frame.style.cssText);
  frame.style.cssText += REVEAL_CSS;
}

/**
 * Arm or disarm the reveal. This is a *mode*, not a one-shot sweep: the SDK
 * removes the 3DS Method frame a few seconds after the fingerprint completes
 * (teardownDelayMs in the CDN bundle), so by the time anyone could click a
 * button the frame is long gone. Armed beforehand, the frame is forced visible
 * the instant it is inserted.
 */
export function setReveal(on: boolean): number {
  revealArmed = on;
  if (!on) {
    for (const [frame, cssText] of REVEALED) frame.style.cssText = cssText;
    REVEALED.clear();
    return 0;
  }
  for (const frame of document.querySelectorAll('iframe')) revealOne(frame);
  return REVEALED.size;
}
