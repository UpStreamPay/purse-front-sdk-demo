import '../components';
import { getEnv } from '../shared/env';
import { setStep, showNotice, showResult } from '../shared/ui';
import { proxyBase, browserData, fetchOrder } from '../shared/proxy';
import { bootSecureFields } from '../shared/secure-fields';
import type { DemoButton } from '../components/demo-button';
import type { DemoOptionList } from '../components/demo-option-list';
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
 * bearer token, so both are proxied by the merchant backend (Alfred) — see
 * shared/proxy.ts. The wallet list uses Alfred's GET /wallet_tokens route.
 *
 * Flow:
 *   1. List the customer's saved cards  → GET  {proxy}/[entity/{entityId}/]tokens/{reference}
 *   2. Re-enter CVV                      → Secure Fields (browser-side, PCI-safe)
 *   3. Create a payment with the token   → POST {proxy}/create_payment  (split[].wallet_token)
 *
 * Each saved token carries its own `scope` (partner + method), so — unlike the
 * new-card flow — there is no eligible-solutions call: the split reuses the
 * token's partner/method.
 */

const payBtn = document.querySelector<DemoButton>('demo-button')!;

// A saved token as returned by the wallet list endpoint (subset of fields used).
type WalletToken = {
  id: string;
  status: string;
  expiration_date?: string;
  created_at?: string;
  updated_at?: string;
  description?: { display_token?: string; brand_name?: string; holder_name?: string };
  scope: { partner: string; method: string };
};

// ISO timestamp → YYYY-MM-DD (drop the time); '—' when absent.
const day = (iso?: string) => (iso ? iso.slice(0, 10) : '—');
// ISO date → MM/YYYY.
const monthYear = (iso?: string) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

// The wallet endpoint wraps the tokens in an envelope.
type WalletTokensResponse = { tokens?: WalletToken[] };

type PaymentContext = {
  amount: number;
  currency: string;
  order: Record<string, unknown>;
  // Required by create_payment so the wallet_token resolves to its owner.
  customerReference: string;
};
let paymentContext: PaymentContext | null = null;
let selectedToken: WalletToken | null = null;

// Step 1 — list the customer's saved cards and render the selector.
async function loadSavedCards(customerReference: string) {
  setStep('step-tokens', 'active');
  // Alfred proxies the wallet list; it injects the merchant id (vault client_name)
  // server-side, so the browser only sends the customer reference.
  const ref = encodeURIComponent(customerReference);
  const res = await fetch(`${proxyBase()}/tokens/${ref}`);
  if (!res.ok) throw new Error(`Wallet tokens failed: ${res.status} ${res.statusText}`);

  const body: WalletTokensResponse = await res.json();
  // Only active credit-card tokens can be charged via this CVV + create_payment
  // flow (skip inactive tokens and non-card methods like PayPal / gift cards).
  const tokens = (body.tokens ?? [])
    .filter(t => t.status === 'ACTIVE' && t.scope?.method === 'creditcard')
    // Newest first (created_at is ISO, so lexical compare is chronological).
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  if (tokens.length === 0) {
    showNotice('No active saved cards for this customer — run the Complete Payment demo with "Save this card" first.');
    return false;
  }

  const list = document.querySelector<DemoOptionList>('demo-option-list')!;
  list.addEventListener('option-select', e => {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    selectedToken = tokens.find(t => t.id === id) ?? null;
    setStep('step-tokens', 'done');
  });
  list.options = tokens.map(t => ({
    id: t.id,
    title: t.description?.display_token ?? t.id,
    secondary: t.description?.brand_name,
    meta: [
      [t.description?.holder_name, t.scope.partner].filter(Boolean).join(' · '),
      `Exp ${monthYear(t.expiration_date)}`,
      `Added ${day(t.created_at)} · Updated ${day(t.updated_at)}`,
    ],
  }));
  // Auto-select the first card so the demo is one click to pay.
  list.select(tokens[0].id);
  return true;
}

// Step 2 — Secure Fields CVV-only form.
async function initCvvForm() {
  const tenantId = getEnv('VITE_PURSE_SECUREFIELDS_TENANT_ID');
  const apiKey = getEnv('VITE_PURSE_API_KEY');
  if (!tenantId || !apiKey) {
    showNotice('Set Tenant ID and API Key in .env.local or the debug panel');
    return;
  }

  setStep('step-cvv', 'active');
  // Only the cvv field is rendered — the saved card supplies the PAN.
  const { sf } = await bootSecureFields({
    tenantId,
    apiKey,
    fields: {
      cvv: { target: 'sf-cvv', placeholder: '123' },
    },
    onReady: () => {
      setStep('step-cvv', 'done');
      setStep('step-pay', 'active');
      payBtn.disabled = false;
    },
  });

  // Step 3 — tokenise the CVV, then create the payment with the saved token.
  payBtn.addEventListener('click', async () => {
    if (!paymentContext || !selectedToken) return;
    payBtn.disabled = true;
    payBtn.label = 'Processing…';
    payBtn.loading = true;

    try {
      const tokenResult = await sf.submit({});
      if ('error' in tokenResult && tokenResult.error) {
        setStep('step-pay', 'error');
        showResult('error', tokenResult);
        payBtn.disabled = false;
        payBtn.label = 'Retry';
        payBtn.loading = false;
        return;
      }
      const { vault_form_token: vaultFormToken } = tokenResult as { vault_form_token: string };

      // The split item carries both the saved-card `wallet_token` and the freshly
      // tokenised `vault_form_token` (the CVV). partner/method come from the
      // chosen token's own scope.
      const paymentBody = {
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        order: paymentContext.order,
        // Mandatory so the server can resolve the wallet_token to its owner.
        customer: { reference: paymentContext.customerReference },
        split: [
          {
            amount: paymentContext.amount,
            partner: selectedToken.scope.partner,
            method: selectedToken.scope.method,
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
      payBtn.loading = false;

      if (!res.ok) {
        setStep('step-pay', 'error');
        showResult('error', data);
        payBtn.disabled = false;
        payBtn.label = 'Retry';
        return;
      }

      setStep('step-pay', 'done');
      showResult('success', data, 'Payment created');
      payBtn.label = 'Done';
    } catch (e) {
      payBtn.loading = false;
      setStep('step-pay', 'error');
      showResult('error', { error: (e as Error).message });
      payBtn.disabled = false;
      payBtn.label = 'Retry';
    }
  });
}

async function main() {
  if (!proxyBase()) {
    showNotice('Set Proxy URL (VITE_PURSE_PROXY_URL) in .env.local or the debug panel');
    return;
  }
  try {
    const order = await fetchOrder();
    const hasCards = await loadSavedCards(order.customerReference);
    if (!hasCards) return;

    paymentContext = {
      amount: order.amount,
      currency: order.currency,
      order: order.v2Order,
      customerReference: order.customerReference,
    };

    await initCvvForm();
  } catch (e) {
    setStep('step-tokens', 'error');
    showResult('error', { error: (e as Error).message });
  }
}

main();
