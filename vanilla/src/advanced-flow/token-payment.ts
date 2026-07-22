import '../components';
import { getEnv } from '../shared/env';
import { setStep, showNotice, showResult } from '../shared/ui';
import { proxyBase, browserData, fetchOrder, fetchCardSolution } from '../shared/proxy';
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
 *   1. List the customer's saved cards  → GET  {proxy}/wallet_tokens/{reference}
 *   2. Check eligible solutions          → POST {proxy}/eligible_solutions  (partner/method)
 *   3. Re-enter CVV                       → Secure Fields (browser-side, PCI-safe)
 *   4. Create a payment with the token    → POST {proxy}/create_payment  (split[].wallet_token)
 */

const payBtn = document.querySelector<DemoButton>('demo-button')!;

// A saved card token, as returned by the wallet list endpoint.
type WalletToken = {
  id: string;
  description?: { display_token?: string; brand_name?: string };
};

type PaymentContext = {
  amount: number;
  currency: string;
  order: Record<string, unknown>;
  partner: string;
  method: string;
};
let paymentContext: PaymentContext | null = null;
let selectedToken: WalletToken | null = null;

// Step 1 — list the customer's saved cards and render the selector.
async function loadSavedCards(customerReference: string) {
  setStep('step-tokens', 'active');
  const res = await fetch(`${proxyBase()}/wallet_tokens/${encodeURIComponent(customerReference)}`);
  if (!res.ok) throw new Error(`Wallet tokens failed: ${res.status} ${res.statusText}`);

  const tokens: WalletToken[] = await res.json();
  if (tokens.length === 0) {
    showNotice('No saved cards for this customer — run the Complete Payment demo with "Save this card" first.');
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
  }));
  // Auto-select the first card so the demo is one click to pay.
  list.select(tokens[0].id);
  return true;
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

  // Step 4 — tokenise the CVV, then create the payment with the saved token.
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

    // partner/method are required on the create_payment split item.
    const { card } = await fetchCardSolution(order.eligibleBody);
    if (!card) {
      showNotice('No credit-card solution eligible for this order — cannot charge the saved card.');
      return;
    }
    paymentContext = {
      amount: order.amount,
      currency: order.currency,
      order: order.v2Order,
      partner: card.partner,
      method: card.method,
    };

    await initCvvForm();
  } catch (e) {
    setStep('step-tokens', 'error');
    showResult('error', { error: (e as Error).message });
  }
}

main();
