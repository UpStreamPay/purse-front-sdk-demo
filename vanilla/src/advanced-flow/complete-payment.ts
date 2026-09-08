import '../components';
import { getEnv, DEMO_ENV_KEYS } from '../shared/env';
import { $, setStep, showNotice, showResult } from '../shared/ui';
import {
  proxyBase,
  browserData,
  createPayment,
  fetchOrder,
  fetchEligibleSolutions,
  type CardSolution,
  type CustomerInfo,
} from '../shared/proxy';
import { bootSecureFields, type SecureFieldsHandle, type SubmitResult } from '../shared/secure-fields';
import {
  extractRedirection,
  followRedirection,
  onRedirectionReturn,
  openRedirectionIframe,
  type PaymentV2,
} from '../shared/redirection';
import type { DemoButton } from '../components/demo-button';
import type { DemoChips } from '../components/demo-chips';
import type { DemoRedirection } from '../components/demo-redirection';
import { mountDebugPanel } from '../shared/debug-panel';

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
 *      (several card partners can be eligible — pick one in the chips)
 *   2. (optional) Display saved cards     → see token-payment.ts for that path
 *   3. Display the card form              → Secure Fields (browser-side, PCI-safe)
 *   4. Authenticate the card              → 3DS versioning + fingerprint, inside sf.submit()
 *   5. Create a payment                   → POST {proxy}/create_payment
 *   6. Register a token                   → `save_token: true` in step 5
 *   7. Follow the redirection             → partner page, see shared/redirection.ts
 */

const payBtn = document.querySelector<DemoButton>('demo-button')!;
const saveTokenEl = $('save-token') as HTMLInputElement;
const threeDsEl = $('three-ds') as HTMLInputElement;
const redirectionEl = document.querySelector<DemoRedirection>('demo-redirection')!;

// The page the shopper (or the iframe) lands on when the partner is done. In a
// real integration this is the `shopper_redirection_url` configured on the
// payment/session — here the demo return page next to this one.
const RETURN_URL = new URL('redirect-return.html', window.location.href).href;

// Everything create_payment needs, gathered across steps 1–3.
type PaymentContext = {
  amount: number;
  currency: string;
  order: Record<string, unknown>;
  // Sent on the payment so the backend can complete it with the cardholder's
  // `ip_address` — the 3DS `browserIP` (see shared/proxy.ts / browserData).
  customer: CustomerInfo;
  partner: string;
  method: string;
};
let paymentContext: PaymentContext | null = null;

// The live Secure Fields instance. Held at module level because the 3DS flag is
// an init option: flipping the checkbox mounts a new instance, while the pay
// handler below is registered once.
let sfHandle: SecureFieldsHandle | null = null;

/**
 * Step 4 — surface what the 3DS sequence produced. The transaction id is what a
 * merchant backend posts alongside the form token and the browser information
 * when it creates the payment; only versioning and the frictionless outcome are
 * wired today, so nothing else happens with it here.
 */
function showThreeDS(threeDSServerTransID?: string) {
  if (!threeDSServerTransID) {
    // No versioning result — 3DS is off for this submit, not active for this
    // tenant, or the loaded Secure Fields build predates the 3DS chain.
    setStep('step-3ds', 'done');
    return;
  }
  $('threeds-box').hidden = false;
  $('threeds-trans-id').textContent = threeDSServerTransID;
  setStep('step-3ds', 'done');
}

// Clear what a previous submit left behind, so a re-boot or a retry never shows
// a stale transaction id.
function resetThreeDS() {
  $('threeds-box').hidden = true;
  $('threeds-trans-id').textContent = '—';
  setStep('step-3ds', 'pending');
}

// Identifies a solution in the chip list; partner+method is what create_payment
// takes on the split item, so the pair is the key.
const solutionId = ({ partner, method }: CardSolution) => `${partner}:${method}`;

/**
 * Step 1 — render the eligible solutions and let the shopper pick the one to
 * pay with. Only credit-card solutions are selectable: they are the ones the
 * Secure Fields card form below can drive (uspmock is one of them). The others
 * are listed for information — each would need its own partner flow.
 */
function renderEligible(solutions: CardSolution[], cards: CardSolution[]) {
  const cardIds = new Set(cards.map(solutionId));
  const chips = document.querySelector<DemoChips>('demo-chips')!;
  chips.emptyText = 'No eligible solutions returned.';
  chips.selectable = true;
  chips.chips = solutions.map(solution => ({
    id: solutionId(solution),
    label: `${solution.method} · ${solution.partner}`,
    disabled: !cardIds.has(solutionId(solution)),
  }));

  chips.addEventListener('chip-select', event => {
    const { id } = (event as CustomEvent<{ id: string }>).detail;
    const picked = cards.find(c => solutionId(c) === id);
    if (!picked || !paymentContext) return;
    // The card form is already booted at this point — partner/method are only
    // read when create_payment is called, so switching stays valid.
    paymentContext.partner = picked.partner;
    paymentContext.method = picked.method;
  });

  // Pre-select the first card solution so the demo is payable in one click.
  if (cards.length > 0) chips.select(solutionId(cards[0]));
}

/**
 * Step 3 — display the card form via Secure Fields (PCI-safe, browser-side).
 *
 * Re-bootable: `threeDS` is an init option (the flag arms a sequence that then
 * runs inside submit()), so toggling the 3DS checkbox tears the instance down
 * and mounts a fresh one rather than patching the live config.
 */
async function initCardForm() {
  const tenantId = getEnv('VITE_PURSE_SECUREFIELDS_TENANT_ID');
  const apiKey = getEnv('VITE_PURSE_API_KEY');
  if (!tenantId || !apiKey) {
    showNotice('Set Tenant ID and API Key in .env.local or the debug panel');
    return;
  }

  // destroy() also aborts an in-flight 3DS sequence, so nothing from the old
  // instance outlives the form.
  sfHandle?.sf.destroy();
  sfHandle = null;
  payBtn.disabled = true;
  resetThreeDS();

  setStep('step-form', 'active');
  sfHandle = await bootSecureFields({
    tenantId,
    apiKey,
    fields: {
      cardNumber: { target: 'sf-pan', placeholder: '1234 5678 9012 3456' },
      holderName: { target: 'sf-name', placeholder: 'Card Holder Name' },
      expDate: { target: 'sf-exp', placeholder: 'MM/YY' },
      cvv: { target: 'sf-cvv', placeholder: '123' },
    },
    brandSelect: true,
    // Step 4 — arm the 3DS sequence; submit() runs it after tokenisation.
    threeDS: threeDsEl.checked,
    onReady: () => {
      setStep('step-form', 'done');
      setStep('step-pay', 'active');
      payBtn.disabled = false;
      payBtn.label = 'Pay';
    },
  });
}

// Steps 4 & 5 — tokenise the card, then create the payment. Registered once:
// it reads whichever Secure Fields instance is currently mounted.
function registerPayHandler() {
  payBtn.addEventListener('click', async () => {
    // Snapshot the instance and the context: both can be swapped while the
    // submit is in flight (a 3DS toggle, a solution change).
    const handle = sfHandle;
    if (!paymentContext || !handle) return;
    payBtn.disabled = true;
    payBtn.label = 'Processing…';
    payBtn.loading = true;

    try {
      // Tokenise the card data → short-lived vault token (PAN never touches
      // your server). The 3DS sequence (step 4) runs inside this same call.
      if (threeDsEl.checked) setStep('step-3ds', 'active');
      const selectedBrand = handle.getSelectedBrand();
      const tokenResult = await handle.sf.submit({
        ...(selectedBrand ? { selectedNetwork: selectedBrand } : {}),
      });
      if ('error' in tokenResult && tokenResult.error) {
        // THREEDS_VERSIONING_FAILED lands here too: without versioning the
        // authentication cannot be attempted, so submit() fails and the token
        // is discarded rather than handed over unauthenticated.
        setStep('step-3ds', 'error');
        showResult('error', tokenResult);
        payBtn.disabled = false;
        payBtn.label = 'Retry';
        payBtn.loading = false;
        return;
      }
      // With 3DS enabled, submit() also ran 3DS versioning and — when the
      // card range advertises a 3DS Method URL — the device fingerprint in a
      // hidden iframe, and resolves with the `threeDSServerTransID` the payment
      // creation call needs. Fingerprinting is best-effort (the gateway pre-set
      // the method result), a failed versioning call fails the whole submit.
      const { vault_form_token: vaultFormToken, threeDSServerTransID } =
        tokenResult as SubmitResult;
      showThreeDS(threeDSServerTransID);

      // Step 5 — Create the payment. Step 6 (register a token) is opted into here
      // via `save_token`: when true, the card is stored to the customer wallet on
      // a successful authorisation. Always gate this behind explicit consent.
      //
      // The split item is a NewAuthorizationCandidate: amount + partner + method
      // are required, the vault token goes in `vault_form_token`, and
      // `three_ds_authentication_options`, `threeds_server_trans_id` and
      // `save_token` all live on the item (there is no root-level save_token).
      //
      // 3DS, per the v2 spec: the id minted by the versioning call goes in
      // `threeds_server_trans_id`, and its presence is what triggers the Purse
      // 3DS advanced flow — the payment is created upfront with an in-progress
      // authentication, then authenticated before any authorisation. At most one
      // split may carry it. Sent only when submit() actually produced one, so an
      // unauthenticated payment stays a plain payment.
      //
      // The `browser` node and `customer.ip_address` are what that
      // authentication reads its browser information from; Alfred fills the two
      // header fields and the IP it can see (shared/proxy.ts / browserData).
      const paymentBody = {
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        order: paymentContext.order,
        customer: paymentContext.customer,
        shopper_redirection_url : 'https://purse.eu?clement_bg=1',
        split: [
          {
            amount: paymentContext.amount,
            partner: paymentContext.partner,
            method: paymentContext.method,
            vault_form_token: vaultFormToken,
            ...(threeDSServerTransID
              ? { threeds_server_trans_id: threeDSServerTransID }
              : {}),
            // Frictionless only: versioning + the device fingerprint are wired,
            // a challenge is not, so no challenge is requested here.
            three_ds_authentication_options: {
              challenge_indicator: 'NO_CHALLENGE_REQUESTED',
            },
            save_token: saveTokenEl.checked,
          },
        ],
        browser: browserData(),
      };

      const { ok, data } = await createPayment(paymentBody);
      payBtn.loading = false;

      if (!ok) {
        setStep('step-pay', 'error');
        showResult('error', data);
        payBtn.disabled = false;
        payBtn.label = 'Retry';
        return;
      }

      setStep('step-pay', 'done');
      showResult('success', data, 'Payment created');
      payBtn.label = 'Done';

      // Step 7 — the payment is created, but not necessarily authorised yet.
      handleRedirection(data as PaymentV2);
    } catch (e) {
      payBtn.loading = false;
      setStep('step-pay', 'error');
      showResult('error', { error: (e as Error).message });
      payBtn.disabled = false;
      payBtn.label = 'Retry';
    }
  });
}

/**
 * Step 7 — follow the redirection.
 *
 * `create_payment` returning 200 does NOT mean the payment is authorised. When
 * the partner needs the shopper (3DS challenge, bank page, wallet approval),
 * `authorization.status` is `PENDING` and the payload carries the redirection to
 * perform — either as `redirection.href` (+ `method`) or, for 3DS1-style flows,
 * as `partner_additional_data.redirect_url_post_params` to POST to that href.
 * shared/redirection.ts resolves both into a single plan.
 *
 * Whatever the shopper does next, the authoritative outcome is the
 * `payment.updated` webhook — never the return URL alone.
 */
function handleRedirection(payment: PaymentV2) {
  const plan = extractRedirection(payment);
  if (!plan) {
    // Frictionless: authorization.status is already AUTHORIZED / REFUSED.
    setStep('step-redirect', 'done');
    return;
  }

  setStep('step-redirect', 'active');
  redirectionEl.returnUrl = RETURN_URL;
  redirectionEl.plan = plan;

  redirectionEl.addEventListener('redirect-follow', async (event) => {
    const { mode } = (event as CustomEvent<{ mode: 'top' | 'iframe' }>).detail;

    // Full page — the shopper leaves this page and comes back on RETURN_URL.
    if (mode === 'top') {
      followRedirection(plan);
      return;
    }

    // Embedded — the partner page renders in an iframe and the return page
    // posts back so we can close it. Only same-origin messages are accepted.
    const stop = onRedirectionReturn((result) => {
      stop();
      setStep('step-redirect', 'done');
      redirectionEl.setStatus('Redirection complete — frame closed.');
      $('redirect-frame').replaceChildren();
      showResult('success', result, 'Back from the redirection');
    });

    await redirectionEl.updateComplete;
    openRedirectionIframe($('redirect-frame'), plan);
  }, { once: true });
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
    const { solutions, cards } = await fetchEligibleSolutions(order.eligibleBody);

    // Step 2 — a returning customer's saved cards would be listed here; this
    // showcase implements the new-card path (see token-payment.ts for saved cards).
    if (cards.length === 0) {
      renderEligible(solutions, cards);
      showNotice('No credit-card solution eligible for this order — cannot render the card form.');
      return;
    }
    // The chip selection writes into paymentContext, so it exists before the
    // chips are rendered; renderEligible pre-selects the first card solution.
    paymentContext = {
      amount: order.amount,
      currency: order.currency,
      order: order.v2Order,
      customer: order.customer,
      partner: cards[0].partner,
      method: cards[0].method,
    };
    renderEligible(solutions, cards);
    setStep('step-eligible', 'done');

    registerPayHandler();
    // Re-mount the card form whenever 3DS is switched on or off — the flag is
    // read at init. Any card data already typed is inside the old iframes and
    // goes with them, which is why the checkbox sits above the form.
    threeDsEl.addEventListener('change', () => {
      initCardForm().catch(e => {
        setStep('step-form', 'error');
        showResult('error', { error: (e as Error).message });
      });
    });
    await initCardForm();
  } catch (e) {
    setStep('step-eligible', 'error');
    showResult('error', { error: (e as Error).message });
  }
}

main();

mountDebugPanel(DEMO_ENV_KEYS.advancedFlow);
