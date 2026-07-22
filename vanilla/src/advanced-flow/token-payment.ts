import { loadSecureFields } from '@purse-eu/web-sdk';
import { getEnv, getSecureFieldsEnvironment } from '../shared/env';
import { $, setStep, showNotice, showResult } from '../shared/ui';
import '../shared/debug-panel';

/**
 * Advanced flow — token payment (pay with a saved card)
 * https://docs.purse.tech/docs/integrate/purse-api/additional-features/advanced-flow/token-payment
 *
 * Companion to complete-payment.ts. Instead of entering a new card, a returning
 * customer pays with a previously saved card (a "wallet token"). The PAN stays
 * in the vault — only the CVV is re-collected via Secure Fields.
 *
 * The v2 payment endpoints and the wallet token list require a server-side
 * bearer token, so both are proxied by the merchant backend (Alfred) at
 * VITE_PURSE_PROXY_URL. In production, replace these calls with your own backend.
 *
 * Flow:
 *   1. List the customer's saved cards  → GET  {proxy}/wallet_tokens/{reference}
 *   2. Check eligible solutions          → POST {proxy}/eligible_solutions  (partner/method)
 *   3. Re-enter CVV                       → Secure Fields (browser-side, PCI-safe)
 *   4. Create a payment with the token    → POST {proxy}/create_payment  (split[].wallet_token)
 */

const payBtn = $('pay-btn') as HTMLButtonElement;

// A saved card token, as returned by the wallet list endpoint.
type WalletToken = {
  id: string;
  description?: { display_token?: string; brand_name?: string };
};

// Everything create_payment needs, gathered across steps 1–2.
type PaymentContext = {
  amount: number;
  currency: string;
  order: Record<string, unknown>;
  // The credit-card solution chosen from the eligible list (step 2).
  partner: string;
  method: string;
};
let paymentContext: PaymentContext | null = null;
let selectedToken: WalletToken | null = null;

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
 * Fetch the sample order from the proxy and build the eligible-solutions body.
 * Returns the customer reference used to look up saved cards. Mirrors
 * complete-payment.ts so both advanced-flow demos stay consistent.
 */
async function fetchOrder() {
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

  paymentContext = {
    amount: o.amount,
    currency: o.currency_code,
    order: v2Order,
    partner: '',
    method: '',
  };

  return {
    customerReference: c.reference as string,
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

// Step 2 — the credit-card partner/method are required on the split item.
async function resolveCardSolution(eligibleBody: Record<string, unknown>) {
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
  if (!card || !paymentContext) return false;
  paymentContext.partner = card.partner;
  paymentContext.method = card.method;
  return true;
}

// Step 1 — list the customer's saved cards and render the selector.
async function loadSavedCards(customerReference: string) {
  setStep('step-tokens', 'active');
  const res = await fetch(`${proxyBase()}/wallet_tokens/${encodeURIComponent(customerReference)}`);
  if (!res.ok) throw new Error(`Wallet tokens failed: ${res.status} ${res.statusText}`);

  const tokens: WalletToken[] = await res.json();
  renderTokens(tokens);

  if (tokens.length === 0) {
    showNotice('No saved cards for this customer — run the Complete Payment demo with "Save this card" first.');
    return false;
  }
  return true;
}

function renderTokens(tokens: WalletToken[]) {
  const list = $('token-list');
  list.innerHTML = '';
  if (tokens.length === 0) {
    list.innerHTML = '<div class="text-xs text-muted">No saved cards returned.</div>';
    return;
  }

  tokens.forEach(token => {
    const btn = document.createElement('button');
    btn.className =
      'flex items-center justify-between w-full px-3.5 py-3 bg-bg border border-border rounded-lg text-left cursor-pointer transition-all hover:border-accent';
    btn.dataset.tokenId = token.id;

    const label = document.createElement('span');
    label.className = 'text-sm font-mono';
    label.textContent = token.description?.display_token ?? token.id;

    const brand = document.createElement('span');
    brand.className = 'text-xs text-muted uppercase';
    brand.textContent = token.description?.brand_name ?? '';

    btn.append(label, brand);
    btn.addEventListener('click', () => selectToken(token));
    list.appendChild(btn);
  });

  // Auto-select the first card so the demo is one click to pay.
  selectToken(tokens[0]);
}

function selectToken(token: WalletToken) {
  selectedToken = token;
  $('token-list')
    .querySelectorAll<HTMLButtonElement>('[data-token-id]')
    .forEach(btn => {
      const active = btn.dataset.tokenId === token.id;
      btn.className = active
        ? 'flex items-center justify-between w-full px-3.5 py-3 bg-accent/10 border border-accent rounded-lg text-left cursor-pointer transition-all'
        : 'flex items-center justify-between w-full px-3.5 py-3 bg-bg border border-border rounded-lg text-left cursor-pointer transition-all hover:border-accent';
    });
  setStep('step-tokens', 'done');
}

// Step 3 — Secure Fields CVV-only form.
async function initCvvForm() {
  const tenantId = getEnv('VITE_PURSE_SECUREFIELDS_TENANT_ID');
  const apiKey = getEnv('VITE_PURSE_API_KEY');
  if (!tenantId || !apiKey) {
    showNotice('Set Tenant ID and API Key in .env.local or the debug panel');
    return;
  }

  setStep('step-cvv', 'active');
  // 'test' is accepted at runtime but absent from loadSecureFields' public types.
  const { initSecureFields } = await loadSecureFields(
    getSecureFieldsEnvironment() as Parameters<typeof loadSecureFields>[0],
  );

  // Only the cvv field is rendered — the saved card supplies the PAN.
  const sf = await initSecureFields({
    tenantId,
    apiKey,
    config: {
      brands: ['CARTE_BANCAIRE', 'VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'MAESTRO'],
      brandSelector: false,
      fields: {
        cvv: { target: 'sf-cvv', placeholder: '123' },
      },
      styles: { input: { placeholderColor: '#9ca3af' } },
    },
  });

  sf.on('ready', () => {
    setStep('step-cvv', 'done');
    setStep('step-pay', 'active');
    payBtn.disabled = false;
  });

  sf.render();

  // Step 4 — tokenise the CVV, then create the payment with the saved token.
  payBtn.addEventListener('click', async () => {
    if (!paymentContext || !selectedToken) return;
    payBtn.disabled = true;
    payBtn.textContent = 'Processing…';
    payBtn.classList.add('loading');

    try {
      const tokenResult = await sf.submit({});
      if ('error' in tokenResult && tokenResult.error) {
        setStep('step-pay', 'error');
        showResult('error', tokenResult);
        payBtn.disabled = false;
        payBtn.textContent = 'Retry';
        payBtn.classList.remove('loading');
        return;
      }
      const { vault_form_token: vaultFormToken } = tokenResult as { vault_form_token: string };

      // The split item carries both the saved-card `wallet_token` and the
      // freshly tokenised `vault_form_token` (the CVV). partner/method come from
      // the eligible-solutions step, as in the complete-payment flow.
      const paymentBody = {
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        order: paymentContext.order,
        split: [
          {
            amount: paymentContext.amount,
            partner: paymentContext.partner,
            method: paymentContext.method,
            wallet_token: selectedToken.id,
            vault_form_token: vaultFormToken,
            three_ds_authentication_options: {
              challenge_indicator: 'NO_CHALLENGE_REQUESTED',
            },
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
    const { customerReference, eligibleBody } = await fetchOrder();
    const hasCards = await loadSavedCards(customerReference);
    if (!hasCards) return;

    const hasCardSolution = await resolveCardSolution(eligibleBody);
    if (!hasCardSolution) {
      showNotice('No credit-card solution eligible for this order — cannot charge the saved card.');
      return;
    }

    await initCvvForm();
  } catch (e) {
    setStep('step-tokens', 'error');
    showResult('error', { error: (e as Error).message });
  }
}

main();
