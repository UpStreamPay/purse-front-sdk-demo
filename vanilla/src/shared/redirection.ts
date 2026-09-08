/**
 * Redirection handling for the raw Payment API v2 (advanced flow).
 *
 * `create_payment` can come back with `authorization.status = "PENDING"` and a
 * `redirection` object: the shopper still has to be sent to a partner page
 * (3DS challenge, bank redirect, wallet approval…) before the authorisation is
 * settled. The turnkey SDKs do this for you — here you do it yourself.
 *
 * This module is the advanced-flow equivalent of the SDK's `manageRedirection()`
 * (usp-widget: packages/sdk/src/redirection/redirection-manager.ts). Same
 * precedence, different input shape: the SDK reads the plugin result logs, we
 * read the payment object returned by `POST /payment/v2/payments`.
 *
 * Precedence (first match wins):
 *   1. partner `redirection_url` + `redirection_json`  → POST form to that URL
 *   2. `redirection.href` + partner `redirect_url_post_params` → POST form to href
 *   3. `redirection.href` + `redirection.method = POST` + `redirection.body`  → POST form
 *   4. `redirection.href`                              → plain GET navigation
 *   5. `redirection.form` (raw HTML form string)       → inject + submit
 *
 * The POST params are a STRING in the payload — either JSON or a query string —
 * so they have to be parsed before being turned into hidden inputs (exactly what
 * the SDK's `getObjectFromString()` does).
 */

// ── Payment v2 subset ────────────────────────────────────────────────────────

type PartnerAdditionalData = {
  // 3DS1 / redirect POST params, as a JSON or query string (e.g. `{"MD":"…","PaReq":"…"}`)
  redirect_url_post_params?: string;
  // Informative: how the partner expects the redirection to be performed.
  redirection_method?: string;
  // Some partners return their own URL + body instead of the root `redirection`.
  redirection_url?: string;
  redirection_json?: string;
  result_code?: string;
};

type PartnerTransaction = {
  partner?: string;
  method?: string;
  status?: string;
  partner_additional_data?: PartnerAdditionalData;
};

export type PaymentV2 = {
  authorization?: {
    status?: string;
    partner_transactions?: PartnerTransaction[];
  };
  redirection?: {
    href?: string;
    method?: string;
    media_type?: string;
    body?: string;
    form?: string;
  };
};

// ── Plan ─────────────────────────────────────────────────────────────────────

/** What the browser has to do, resolved from the payment object. */
export type RedirectionPlan =
  | { kind: 'GET'; url: string; source: string }
  | { kind: 'POST'; url: string; params: Record<string, string>; source: string }
  | { kind: 'HTML_FORM'; html: string; source: string };

/**
 * Resolve the redirection to perform, or `null` when the payment needs none
 * (frictionless 3DS: `authorization.status` is already `AUTHORIZED`).
 */
export function extractRedirection(payment: PaymentV2): RedirectionPlan | null {
  const additional = pendingPartnerData(payment);
  const { redirection_url, redirection_json, redirect_url_post_params } = additional ?? {};
  const redirection = payment.redirection ?? {};

  // 1 — partner-provided URL + body (mirrors the SDK's plugin_result.logs case).
  if (redirection_url && redirection_json) {
    return {
      kind: 'POST',
      url: redirection_url,
      params: parseParams(redirection_json),
      source: 'partner_additional_data.redirection_url + redirection_json',
    };
  }

  if (redirection.href) {
    // 2 — 3DS1-style POST params alongside the root redirection URL.
    if (redirect_url_post_params) {
      return {
        kind: 'POST',
        url: redirection.href,
        params: parseParams(redirect_url_post_params),
        source: 'redirection.href + partner_additional_data.redirect_url_post_params',
      };
    }
    // 3 — the redirection itself asks for a POST and carries its own body.
    if (redirection.method?.toUpperCase() === 'POST' && redirection.body) {
      return {
        kind: 'POST',
        url: redirection.href,
        params: parseParams(redirection.body),
        source: 'redirection.href + redirection.body',
      };
    }
    // 4 — plain navigation.
    return { kind: 'GET', url: redirection.href, source: 'redirection.href' };
  }

  // 5 — a ready-made HTML form (media_type: text/html).
  if (redirection.form) {
    return { kind: 'HTML_FORM', html: redirection.form, source: 'redirection.form' };
  }

  return null;
}

/** The partner transaction that is waiting on the shopper, if any. */
function pendingPartnerData(payment: PaymentV2): PartnerAdditionalData | undefined {
  const transactions = payment.authorization?.partner_transactions ?? [];
  const pending = transactions.find(t => t.partner_additional_data);
  return pending?.partner_additional_data;
}

/**
 * POST params arrive as an opaque string: JSON (`{"MD":"…"}`) or a query string
 * (`MD=…&PaReq=…`). Nested objects are flattened to `key[subKey]`, like the SDK.
 */
export function parseParams(raw: string): Record<string, string> {
  const flat: Record<string, string> = {};
  const add = (key: string, value: unknown) => {
    if (value && typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        flat[`${key}[${subKey}]`] = String(subValue);
      }
      return;
    }
    flat[key] = String(value ?? '');
  };

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        add(key, value);
      }
      return flat;
    }
  } catch {
    // Not JSON — fall through to the query-string reading.
  }

  for (const [key, value] of new URLSearchParams(raw)) {
    flat[key] = value;
  }
  return flat;
}

// ── Performing the redirection ───────────────────────────────────────────────

/**
 * Build the hidden auto-submitted form used for every POST redirection.
 * `target` is a browsing context name: `_top` for a full-page redirect, or the
 * `name` of an iframe to keep the partner page embedded.
 */
export function buildRedirectionForm(url: string, params: Record<string, string>, target: string): HTMLFormElement {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.target = target;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(params)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  return form;
}

/**
 * Full-page redirection — the recommended default. The shopper leaves your page
 * and comes back on the `shopper_redirection_url` configured for the payment,
 * with a signed `purse-redirection-data` query parameter.
 */
export function followRedirection(plan: RedirectionPlan) {
  if (plan.kind === 'GET') {
    window.location.assign(plan.url);
    return;
  }
  if (plan.kind === 'POST') {
    buildRedirectionForm(plan.url, plan.params, '_top').submit();
    return;
  }
  submitHtmlForm(plan.html, '_top');
}

/**
 * Embedded redirection — the partner page is loaded inside an iframe so the
 * shopper never leaves the checkout.
 *
 * Caveats (see the page copy):
 *   • Many partner / ACS pages send `X-Frame-Options: DENY` or a restrictive
 *     `frame-ancestors` CSP and simply refuse to render framed. Always keep a
 *     full-page fallback.
 *   • Nothing tells you when the flow is over: the iframe ends up on the
 *     `shopper_redirection_url`, which is cross-origin until it lands back on
 *     your own domain. That return page must `postMessage` to its parent so you
 *     can close the frame — see advanced-flow/redirect-return.html.
 */
export function openRedirectionIframe(container: HTMLElement, plan: RedirectionPlan, name = 'purse-redirect-frame'): HTMLIFrameElement {
  container.replaceChildren();

  const frame = document.createElement('iframe');
  frame.name = name;
  frame.className = 'w-full h-[420px] bg-white border border-border rounded-lg';
  // 3DS challenge pages need scripts and their own form posts.
  frame.setAttribute('allow', 'payment');
  container.appendChild(frame);

  if (plan.kind === 'GET') {
    frame.src = plan.url;
    return frame;
  }
  if (plan.kind === 'POST') {
    buildRedirectionForm(plan.url, plan.params, name).submit();
    return frame;
  }
  submitHtmlForm(plan.html, name);
  return frame;
}

/** Inject a partner-provided HTML form string and submit it into `target`. */
function submitHtmlForm(formHtml: string, target: string) {
  const holder = document.createElement('div');
  holder.style.display = 'none';
  holder.innerHTML = formHtml;
  document.body.appendChild(holder);
  const form = holder.querySelector('form');
  if (!form) {
    throw new Error('redirection.form contains no <form> element');
  }
  form.target = target;
  form.submit();
}

// ── Coming back ──────────────────────────────────────────────────────────────

export type RedirectionReturn = {
  /** Signed JWS payload appended by Purse to the shopper redirection URL. */
  redirectionData: string | null;
  /** Every query parameter of the return URL, for debugging. */
  query: Record<string, string>;
};

export const RETURN_MESSAGE = 'purse-demo:redirection-complete';

/**
 * Listen for the return page's `postMessage` (iframe mode only). Returns the
 * unsubscribe function. Only same-origin messages are accepted — the return
 * page must be served from your own domain.
 */
export function onRedirectionReturn(callback: (result: RedirectionReturn) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== RETURN_MESSAGE) return;
    callback(event.data.payload as RedirectionReturn);
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
