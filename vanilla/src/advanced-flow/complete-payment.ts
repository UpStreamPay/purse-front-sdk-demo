import { loadSecureFields, type Securefields } from '@purse-eu/web-sdk';
import { getEnv, getEnvironment } from '../shared/env';
import { $, setStep, showNotice, showResult } from '../shared/ui';
import '../shared/debug-panel';

/**
 * Advanced flow — complete payment
 * https://docs.purse.tech/docs/integrate/purse-api/additional-features/advanced-flow/complete-payment-flow
 *
 * This recipe drives the raw Purse Payment API v2 directly, instead of the
 * turnkey Drop-in / Headless SDKs. Use it when you need full control over the
 * checkout UI and are willing to orchestrate the API yourself.
 *
 * The v2 endpoints require an OAuth bearer token and therefore MUST NOT be
 * called from the browser. In this demo they are proxied by a small merchant
 * backend (Alfred), reachable at VITE_PURSE_PROXY_URL. In production, replace
 * these calls with your own backend endpoints — the entity_id and credentials
 * stay server-side.
 *
 * Flow:
 *   1. Check eligible payment solutions  → POST {proxy}/eligible_solutions
 *   2. (optional) Display saved cards     → wallet tokens, see note below
 *   3. Display the card form              → Secure Fields (browser-side, PCI-safe)
 *   4. Create a payment                   → POST {proxy}/create_payment
 *   5. Register a token                   → `save_token: true` in step 4
 */

const payBtn = $('pay-btn') as HTMLButtonElement;
const saveTokenEl = $('save-token') as HTMLInputElement;

let selectedBrand: Securefields.Brand | null = null;

// Everything create_payment needs, gathered across steps 1–3.
type PaymentContext = {
  amount: number;
  currency: string;
  order: Record<string, unknown>;
  // The credit-card solution chosen from the eligible list (step 1).
  partner: string;
  method: string;
};
let paymentContext: PaymentContext | null = null;

const BRAND_PILL_BASE = 'px-2.5 py-0.5 bg-bg border border-border rounded-full text-xs cursor-pointer transition-all';
const BRAND_PILL_SELECTED = 'px-2.5 py-0.5 bg-accent text-white border-accent rounded-full text-xs cursor-pointer transition-all';

// Resolve the merchant-backend proxy endpoints from a single base URL.
function proxyBase(): string {
  return getEnv('VITE_PURSE_PROXY_URL').replace(/\/+$/, '');
}

// Collect the browser metadata required by the create-payment call (used for 3DS).
function browserData() {
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

/**
 * Build the v2 eligible-solutions request body from the merchant cart.
 * Here the cart is fetched from the proxy's `/order` sample; in production it
 * comes from your own cart/order state. `entity_id` is injected server-side by
 * the proxy, so it is intentionally absent from the browser payload.
 */
async function fetchOrderAndBuildEligibleBody() {
  const res = await fetch(`${proxyBase()}/order/`);
  if (!res.ok) throw new Error(`Order fetch failed: ${res.status} ${res.statusText}`);
  const { order } = await res.json();
  const o = order.order;
  const c = o.customer ?? {};
  const billing = c.billing_address ?? {};

  // v2 order object, reused by both eligible-solutions and create_payment so the
  // persisted order (matched on `reference`) stays consistent between calls.
  // net_amount is the full payable total (amount == net_amount), tax_amount is
  // the tax portion of it — NOT the legacy ex-tax net, which would trip:
  // "Amount must be less or equal to order net amount minus already paid net amount."
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

  // Remember what we charge so step 4 stays consistent with eligibility.
  paymentContext = {
    amount: o.amount,
    currency: o.currency_code,
    order: v2Order,
    partner: '',
    method: '',
  };

  return {
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
  };
}

// Step 1 — Check eligible payment solutions
async function checkEligibleSolutions() {
  setStep('step-eligible', 'active');
  const body = await fetchOrderAndBuildEligibleBody();

  const res = await fetch(`${proxyBase()}/eligible_solutions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Eligible solutions failed: ${res.status} ${res.statusText}`);

  const { eligible_solutions = [] } = await res.json();
  renderEligible(eligible_solutions);
  setStep('step-eligible', 'done');

  // Step 2 — Display saved cards (optional).
  // A returning customer's saved cards live in the wallet: GET
  // /wallet/v3/merchants/{merchant_id}/customers/{reference}/tokens. Selecting
  // one lets the shopper pay with a stored card (CVV re-entry only). Not wired
  // in this demo — the backend proxy does not expose the wallet endpoint yet.

  // This showcase implements the new-card path, which needs a credit-card
  // solution to be eligible. Capture the chosen partner+method — create_payment
  // requires both on the split item.
  const card = eligible_solutions.find(
    (s: { method: string }) => s.method === 'creditcard',
  );
  if (!card || !paymentContext) {
    showNotice('No credit-card solution eligible for this order — cannot render the card form.');
    return false;
  }
  paymentContext.partner = card.partner;
  paymentContext.method = card.method;
  return true;
}

function renderEligible(solutions: Array<{ partner: string; method: string }>) {
  const list = $('eligible-list');
  list.innerHTML = '';
  if (solutions.length === 0) {
    list.innerHTML = '<div class="text-xs text-muted">No eligible solutions returned.</div>';
    return;
  }
  solutions.forEach(({ partner, method }) => {
    const chip = document.createElement('span');
    const isCard = method === 'creditcard';
    chip.className = isCard
      ? 'px-2.5 py-1 bg-accent text-white rounded-full text-xs font-medium'
      : 'px-2.5 py-1 bg-bg border border-border rounded-full text-xs text-muted';
    chip.textContent = `${method} · ${partner}`;
    list.appendChild(chip);
  });
}

// Step 3 — Display the card form via Secure Fields (PCI-safe, browser-side)
async function initCardForm() {
  const tenantId = getEnv('VITE_PURSE_SECUREFIELDS_TENANT_ID');
  const apiKey = getEnv('VITE_PURSE_API_KEY');
  if (!tenantId || !apiKey) {
    showNotice('Set Tenant ID and API Key in .env.local or the debug panel');
    return;
  }

  setStep('step-form', 'active');
  const { initSecureFields } = await loadSecureFields(getEnvironment());

  const sf = await initSecureFields({
    tenantId,
    apiKey,
    config: {
      brands: ['CARTE_BANCAIRE', 'VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'MAESTRO'],
      brandSelector: false,
      fields: {
        cardNumber: { target: 'sf-pan', placeholder: '1234 5678 9012 3456' },
        holderName: { target: 'sf-name', placeholder: 'Card Holder Name' },
        expDate: { target: 'sf-exp', placeholder: 'MM/YY' },
        cvv: { target: 'sf-cvv', placeholder: '123' },
      },
      styles: { input: { placeholderColor: '#9ca3af' } },
    },
  });

  sf.on('ready', () => {
    setStep('step-form', 'done');
    setStep('step-pay', 'active');
    payBtn.disabled = false;
  });

  sf.on('brandDetected', ({ brands }) => {
    const indicator = $('brand-indicator') as HTMLElement;
    if (!brands || brands.length === 0) {
      indicator.style.display = 'none';
      selectedBrand = null;
      return;
    }
    indicator.style.display = 'flex';
    const pills = $('brand-pills');
    pills.innerHTML = '';
    brands.forEach(brand => {
      const pill = document.createElement('button');
      pill.className = BRAND_PILL_BASE;
      pill.textContent = brand;
      pill.addEventListener('click', () => {
        selectedBrand = brand;
        pills.querySelectorAll('button').forEach(p => (p.className = BRAND_PILL_BASE));
        pill.className = BRAND_PILL_SELECTED;
      });
      pills.appendChild(pill);
    });
    if (brands.length === 1) {
      selectedBrand = brands[0];
      const first = pills.querySelector('button');
      if (first) first.className = BRAND_PILL_SELECTED;
    }
  });

  sf.render();

  // Steps 4 & 5 — tokenise the card, then create the payment
  payBtn.addEventListener('click', async () => {
    if (!paymentContext) return;
    payBtn.disabled = true;
    payBtn.textContent = 'Processing…';
    payBtn.classList.add('loading');

    try {
      // Tokenise the card data → short-lived vault token (PAN never touches your server)
      const tokenResult = await sf.submit({
        ...(selectedBrand ? { selectedNetwork: selectedBrand } : {}),
      });
      if ('error' in tokenResult && tokenResult.error) {
        setStep('step-pay', 'error');
        showResult('error', tokenResult);
        payBtn.disabled = false;
        payBtn.textContent = 'Retry';
        payBtn.classList.remove('loading');
        return;
      }
      // submit() returns { vault_form_token, card? } — this token is what step 4 sends.
      const { vault_form_token: vaultFormToken } = tokenResult as { vault_form_token: string };

        // Step 4 — Create the payment. Step 5 (register a token) is opted into here
      // via `save_token`: when true, the card is stored to the customer wallet on
      // a successful authorisation. Always gate this behind explicit consent.
      //
      // The split item is a NewAuthorizationCandidate: amount + partner + method
      // are required, the vault token goes in `vault_form_token`, and both
      // `three_ds_authentication_options` and `save_token` live on the item
      // (there is no root-level save_token).
      const paymentBody = {
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        order: paymentContext.order,
        split: [
          {
            amount: paymentContext.amount,
            partner: paymentContext.partner,
            method: paymentContext.method,
            vault_form_token: vaultFormToken,
            three_ds_authentication_options: {
              challenge_indicator: 'NO_CHALLENGE_REQUESTED',
            },
            save_token: saveTokenEl.checked,
          },
        ],
        browser: browserData(),
      };

      const res = await fetch(`${proxyBase()}/create_payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentBody),
      });
      const data = await res.json();
      payBtn.classList.remove('loading');

      if (!res.ok) {
        setStep('step-pay', 'error');
        showResult('error', data);
        payBtn.disabled = false;
        payBtn.textContent = 'Retry';
        return;
      }

      setStep('step-pay', 'done');
      showResult('success', data, 'Payment created');
      payBtn.textContent = 'Done';
    } catch (e) {
      payBtn.classList.remove('loading');
      setStep('step-pay', 'error');
      showResult('error', { error: (e as Error).message });
      payBtn.disabled = false;
      payBtn.textContent = 'Retry';
    }
  });
}

async function main() {
  if (!proxyBase()) {
    showNotice('Set Proxy URL (VITE_PURSE_PROXY_URL) in .env.local or the debug panel');
    return;
  }
  try {
    const ok = await checkEligibleSolutions();
    if (ok) await initCardForm();
  } catch (e) {
    setStep('step-eligible', 'error');
    showResult('error', { error: (e as Error).message });
  }
}

main();
