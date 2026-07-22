import '../components';
import { getEnv } from '../shared/env';
import { $, setStep, showNotice, showResult } from '../shared/ui';
import { proxyBase, browserData, fetchOrder, fetchCardSolution, type CardSolution } from '../shared/proxy';
import { bootSecureFields } from '../shared/secure-fields';
import type { DemoButton } from '../components/demo-button';
import type { DemoChips } from '../components/demo-chips';
import '../shared/debug-panel';

/**
 * Advanced flow — complete payment
 * https://docs.purse.tech/docs/integrate/purse-api/additional-features/advanced-flow/complete-payment-flow
 *
 * Drives the raw Purse Payment API v2 directly (instead of the turnkey Drop-in /
 * Headless SDKs) for full control over the checkout UI. The v2 endpoints require
 * a server-side OAuth bearer token, so they are proxied by a merchant backend
 * (Alfred) at VITE_PURSE_PROXY_URL — see shared/proxy.ts.
 *
 * Flow:
 *   1. Check eligible payment solutions  → POST {proxy}/eligible_solutions
 *   2. (optional) Display saved cards     → see token-payment.ts for that path
 *   3. Display the card form              → Secure Fields (browser-side, PCI-safe)
 *   4. Create a payment                   → POST {proxy}/create_payment
 *   5. Register a token                   → `save_token: true` in step 4
 */

const payBtn = document.querySelector<DemoButton>('demo-button')!;
const saveTokenEl = $('save-token') as HTMLInputElement;

// Everything create_payment needs, gathered across steps 1–3.
type PaymentContext = {
  amount: number;
  currency: string;
  order: Record<string, unknown>;
  partner: string;
  method: string;
};
let paymentContext: PaymentContext | null = null;

function renderEligible(solutions: CardSolution[]) {
  const chips = document.querySelector<DemoChips>('demo-chips')!;
  chips.emptyText = 'No eligible solutions returned.';
  chips.chips = solutions.map(({ partner, method }) => ({
    label: `${method} · ${partner}`,
    highlight: method === 'creditcard',
  }));
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
  const { sf, getSelectedBrand } = await bootSecureFields({
    tenantId,
    apiKey,
    fields: {
      cardNumber: { target: 'sf-pan', placeholder: '1234 5678 9012 3456' },
      holderName: { target: 'sf-name', placeholder: 'Card Holder Name' },
      expDate: { target: 'sf-exp', placeholder: 'MM/YY' },
      cvv: { target: 'sf-cvv', placeholder: '123' },
    },
    brandSelect: true,
    onReady: () => {
      setStep('step-form', 'done');
      setStep('step-pay', 'active');
      payBtn.disabled = false;
    },
  });

  // Steps 4 & 5 — tokenise the card, then create the payment
  payBtn.addEventListener('click', async () => {
    if (!paymentContext) return;
    payBtn.disabled = true;
    payBtn.label = 'Processing…';
    payBtn.loading = true;

    try {
      // Tokenise the card data → short-lived vault token (PAN never touches your server)
      const selectedBrand = getSelectedBrand();
      const tokenResult = await sf.submit({
        ...(selectedBrand ? { selectedNetwork: selectedBrand } : {}),
      });
      if ('error' in tokenResult && tokenResult.error) {
        setStep('step-pay', 'error');
        showResult('error', tokenResult);
        payBtn.disabled = false;
        payBtn.label = 'Retry';
        payBtn.loading = false;
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
    // Step 1 — fetch the order and check eligible solutions.
    setStep('step-eligible', 'active');
    const order = await fetchOrder();
    const { solutions, card } = await fetchCardSolution(order.eligibleBody);
    renderEligible(solutions);

    // Step 2 — a returning customer's saved cards would be listed here; this
    // showcase implements the new-card path (see token-payment.ts for saved cards).
    if (!card) {
      showNotice('No credit-card solution eligible for this order — cannot render the card form.');
      return;
    }
    paymentContext = {
      amount: order.amount,
      currency: order.currency,
      order: order.v2Order,
      partner: card.partner,
      method: card.method,
    };
    setStep('step-eligible', 'done');

    await initCardForm();
  } catch (e) {
    setStep('step-eligible', 'error');
    showResult('error', { error: (e as Error).message });
  }
}

main();
