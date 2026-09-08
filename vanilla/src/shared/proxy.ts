import { getEnv } from "./env";

// Helpers shared by the advanced-flow demos, which drive the raw Payment API v2
// through the merchant-backend proxy (Alfred) at VITE_PURSE_PROXY_URL.

// Resolve the proxy base URL (trailing slashes trimmed).
export function proxyBase(): string {
  return getEnv("VITE_PURSE_PROXY_URL").replace(/\/+$/, "");
}

/**
 * The entity the v2 calls are scoped to. Alfred's advanced-flow routes are
 * stateless (SDK-12229): they forward the `entity_id` the caller sends and only
 * fall back to their own configuration when it is absent — so leaving
 * VITE_PURSE_ENTITY_ID empty keeps the proxy's default entity.
 */
export function entityId(): string {
  return getEnv("VITE_PURSE_ENTITY_ID").trim();
}

// Spread into a proxy request body to scope it to the configured entity.
function entityScope(): { entity_id?: string } {
  const id = entityId();
  return id ? { entity_id: id } : {};
}

/**
 * The browser metadata create_payment carries into the 3DS AReq — the fields
 * that are reachable from JavaScript.
 *
 * `browser.accept_header` and `browser.accept_language` are deliberately
 * absent: they cannot be read from the page, and in a server-to-server payment
 * call Orchestration cannot harvest them either (the request comes from the
 * merchant's server, not the cardholder's browser). The merchant backend
 * captures them from the cardholder's own request — Alfred does it on
 * /create_payment. The third such field, the browser IP, is read back from the
 * proxy and sent on the customer node instead (see clientIp()).
 */
export function browserData() {
  return {
    user_agent: navigator.userAgent,
    color_depth: window.screen.colorDepth,
    java_enabled: navigator.javaEnabled?.() ?? false,
    javascript_enabled: true,
    screen_height: window.screen.height,
    screen_width: window.screen.width,
    locale: navigator.language,
    utc_time_zone: -new Date().getTimezoneOffset(),
  };
}

// The v2 customer node, shared by eligible-solutions and create_payment.
export type CustomerInfo = {
  reference: string;
  type: 'PERSON';
  email?: string;
  locale?: string;
  // The 3DS `browserIP` — read back from the proxy, which is the hop that sees
  // the cardholder's address, and replaced by a routable stand-in on a local
  // run (see clientIp()).
  ip_address?: string;
};

/**
 * Stand-in browser IP for local runs. In dev the proxy sees the loopback
 * (`::1` / `127.0.0.1`), and a 3DS AReq needs a publicly routable address —
 * so a real one is sent instead of the address of this machine's own stack.
 */
const FALLBACK_BROWSER_IP = '87.165.249.90';

// Loopback, RFC 1918, link-local and CGNAT — anything a 3DS Server cannot make
// sense of as a cardholder address.
function isRoutable(ip: string): boolean {
  if (/^(::1|::|0\.0\.0\.0)$/.test(ip)) return false;
  if (/^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  if (/^169\.254\./.test(ip) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return false;
  // Unique-local / link-local IPv6.
  if (/^f[cd]/i.test(ip) || /^fe80:/i.test(ip)) return false;
  return true;
}

/**
 * The browser IP to send as `customer.ip_address`.
 *
 * A page cannot read its own address, so it is read back from the proxy: Alfred
 * reports it on /env (`clientIp`) exactly as it would fill it in itself. When
 * that is a local address — or the proxy is unreachable or too old to report
 * one — FALLBACK_BROWSER_IP is used, so the payload always carries an address
 * 3DS can work with.
 */
export async function clientIp(): Promise<string> {
  try {
    const res = await fetch(`${proxyBase()}/env`);
    if (!res.ok) return FALLBACK_BROWSER_IP;
    const { clientIp } = (await res.json()) as { clientIp?: string };
    return clientIp && isRoutable(clientIp) ? clientIp : FALLBACK_BROWSER_IP;
  } catch {
    return FALLBACK_BROWSER_IP;
  }
}

export type OrderInfo = {
  amount: number;
  currency: string;
  // v2 order object, reused by eligible-solutions and create_payment so the
  // persisted order (matched on `reference`) stays consistent between calls.
  v2Order: Record<string, unknown>;
  customer: CustomerInfo;
  customerReference: string;
  // Ready-to-POST body for /eligible_solutions.
  eligibleBody: Record<string, unknown>;
};

/**
 * Fetch the sample order from the proxy and derive the v2 order object plus the
 * eligible-solutions request body. `entity_id` is sent when configured, and
 * otherwise left to the proxy's own default entity (see entityId()).
 *
 * net_amount is the full payable total (amount == net_amount); tax_amount is the
 * tax portion of it — NOT the legacy ex-tax net, which would trip
 * "Amount must be less or equal to order net amount minus already paid net amount."
 */
export async function fetchOrder(): Promise<OrderInfo> {
  const res = await fetch(`${proxyBase()}/order/`);
  if (!res.ok)
    throw new Error(`Order fetch failed: ${res.status} ${res.statusText}`);
  const { order } = await res.json();
  const o = order.order;
  const c = o.customer ?? {};
  const billing = c.billing_address ?? {};

  const v2Order = {
    reference: o.reference,
    net_amount: o.amount,
    tax_amount: o.tax_amount,
    billing_address: {
      first_name: billing.first_name,
      last_name: billing.last_name,
      address_lines: billing.address_lines,
      city: billing.city,
      postal_code: billing.postal_code,
      country_code: billing.country_code,
    },
  };

  const customer: CustomerInfo = {
    reference: c.reference,
    type: "PERSON",
    email: billing.email,
    locale: c.locale_code,
    ip_address: await clientIp(),
  };

  return {
    amount: o.amount,
    currency: o.currency_code,
    v2Order,
    customer,
    customerReference: c.reference,
    eligibleBody: {
      ...entityScope(),
      amount: o.amount,
      currency: o.currency_code,
      customer,
      order: v2Order,
    },
  };
}

export type CardSolution = { partner: string; method: string };

/**
 * POST /eligible_solutions. Returns the full solution list (for display) plus
 * every credit-card solution — create_payment needs a partner+method on the
 * split item, and several partners can be eligible for the same order (uspmock
 * alongside the real acquirers), so the demo lets the shopper pick.
 */
export async function fetchEligibleSolutions(
  eligibleBody: Record<string, unknown>,
): Promise<{ solutions: CardSolution[]; cards: CardSolution[] }> {
  const res = await fetch(`${proxyBase()}/eligible_solutions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eligibleBody),
  });
  if (!res.ok)
    throw new Error(
      `Eligible solutions failed: ${res.status} ${res.statusText}`,
    );

  const { eligible_solutions = [] } = await res.json();
  const cards = (eligible_solutions as CardSolution[]).filter(
    (s) =>
      s.method === "creditcard" ||
      (s.method === "primary" && s.partner === "uspmock"),
  );
  return { solutions: eligible_solutions, cards };
}

/**
 * POST /create_payment. The entity scope is added here so both advanced-flow
 * demos stay identical on that point, and the raw response is handed back so
 * each caller can render the API payload as-is.
 */
export async function createPayment(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: unknown }> {
  const res = await fetch(`${proxyBase()}/create_payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...entityScope(), ...body }),
  });
  return { ok: res.ok, data: await res.json() };
}

/**
 * GET the customer's saved card tokens. Alfred exposes the merchant as an
 * optional path segment, so a configured entity overrides the proxy's default
 * merchant instead of relying on its configuration.
 */
export async function fetchCustomerTokens(
  customerReference: string,
): Promise<unknown> {
  const id = entityId();
  const scope = id ? `entity/${encodeURIComponent(id)}/` : "";
  const ref = encodeURIComponent(customerReference);
  const res = await fetch(`${proxyBase()}/${scope}tokens/${ref}`);
  if (!res.ok)
    throw new Error(`Wallet tokens failed: ${res.status} ${res.statusText}`);
  return res.json();
}
