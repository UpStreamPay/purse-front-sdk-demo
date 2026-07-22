import { getEnv } from './env';

// Helpers shared by the advanced-flow demos, which drive the raw Payment API v2
// through the merchant-backend proxy (Alfred) at VITE_PURSE_PROXY_URL.

// Resolve the proxy base URL (trailing slashes trimmed).
export function proxyBase(): string {
  return getEnv('VITE_PURSE_PROXY_URL').replace(/\/+$/, '');
}

// Browser metadata required by create_payment (used for 3DS).
export function browserData() {
  return {
    user_agent: navigator.userAgent,
    accept_header: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    color_depth: window.screen.colorDepth,
    screen_height: window.screen.height,
    screen_width: window.screen.width,
    locale: navigator.language,
    utc_time_zone: -new Date().getTimezoneOffset(),
  };
}

export type OrderInfo = {
  amount: number;
  currency: string;
  // v2 order object, reused by eligible-solutions and create_payment so the
  // persisted order (matched on `reference`) stays consistent between calls.
  v2Order: Record<string, unknown>;
  customerReference: string;
  // Ready-to-POST body for /eligible_solutions.
  eligibleBody: Record<string, unknown>;
};

/**
 * Fetch the sample order from the proxy and derive the v2 order object plus the
 * eligible-solutions request body. `entity_id` is injected server-side by the
 * proxy, so it is intentionally absent here.
 *
 * net_amount is the full payable total (amount == net_amount); tax_amount is the
 * tax portion of it — NOT the legacy ex-tax net, which would trip
 * "Amount must be less or equal to order net amount minus already paid net amount."
 */
export async function fetchOrder(): Promise<OrderInfo> {
  const res = await fetch(`${proxyBase()}/order/`);
  if (!res.ok) throw new Error(`Order fetch failed: ${res.status} ${res.statusText}`);
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

  return {
    amount: o.amount,
    currency: o.currency_code,
    v2Order,
    customerReference: c.reference,
    eligibleBody: {
      amount: o.amount,
      currency: o.currency_code,
      customer: {
        reference: c.reference,
        type: 'PERSON',
        email: billing.email,
        ip_address: c.ip,
        locale: c.locale_code,
      },
      order: v2Order,
    },
  };
}

export type CardSolution = { partner: string; method: string };

/**
 * POST /eligible_solutions. Returns the full solution list (for display) plus
 * the credit-card partner+method, which create_payment requires on the split
 * item (`card` is null if no card solution is eligible for the order).
 */
export async function fetchCardSolution(
  eligibleBody: Record<string, unknown>,
): Promise<{ solutions: CardSolution[]; card: CardSolution | null }> {
  const res = await fetch(`${proxyBase()}/eligible_solutions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eligibleBody),
  });
  if (!res.ok) throw new Error(`Eligible solutions failed: ${res.status} ${res.statusText}`);

  const { eligible_solutions = [] } = await res.json();
  const card = eligible_solutions.find(
    (s: { method: string }) => s.method === 'creditcard',
  );
  return { solutions: eligible_solutions, card: card ?? null };
}
