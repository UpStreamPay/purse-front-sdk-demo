import { decodeThreeDSMethodData, type ThreeDSMethodData } from './method-data';
import { bodyAllowed, parseMaybeJson, redact, scrubUrlSecrets } from './redact';
import { isConcealed, isRevealArmed, REVEALED, revealOne } from './reveal';
import { emit, getOrigin, resetOrigin, touch } from './store';
import type { HttpEvent } from './types';

let installed = false;

// ─────────────────────────────────────────────────────────────────────────────
// The four observers
// ─────────────────────────────────────────────────────────────────────────────

function splitUrl(raw: string): { url: string; host: string; path: string } {
  try {
    const u = new URL(scrubUrlSecrets(new URL(raw, location.href).href));
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
            touch();
          })
          .catch(() => undefined);
      }
      touch();
      return response;
    } catch (error) {
      event.ms = Math.round(performance.now() - started);
      event.status = 'error';
      touch();
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
        touch();
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
      if (isRevealArmed()) revealOne(el);
    }

    if (el instanceof HTMLFormElement) {
      // The 3DS Method form is built, appended and submitted in one go, so its
      // inputs are already in place when the observer sees it. Grab the blob
      // here — it is the whole point of the demo, and it is gone moments later.
      const methodInput = el.querySelector<HTMLInputElement>('input[name="threeDSMethodData"]');
      const raw = methodInput?.value;
      emit({
        kind: 'form',
        action: el.action || '(none)',
        target: el.target || '(self)',
        inputs: [...el.querySelectorAll('input')].map(i => i.name || '(unnamed)'),
        ...(raw
          ? { methodData: (redact(decodeThreeDSMethodData(raw)) as ThreeDSMethodData) ?? undefined }
          : {}),
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
          at: Math.round(entry.startTime - getOrigin()),
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
  resetOrigin();
  patchFetch();
  patchXhr();
  watchMessages();
  watchDom();
  watchResources();
}
