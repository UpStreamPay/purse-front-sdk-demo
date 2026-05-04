import { loadDropInCheckout } from '@purse-eu/web-sdk';
import { getEnvironment } from '../shared/env';
import { getSession } from '../shared/session';
import { $, setStep, showNotice, showResult } from '../shared/ui';
import '../shared/debug-panel';

// ─────────────────────────────────────────────────────────────────────────────
// Session setup — replace with your backend call in production.
// Example: const session = await fetch('/api/payment/session').then(r => r.json());
// ─────────────────────────────────────────────────────────────────────────────

const payBtn = $('pay-btn') as HTMLButtonElement;

async function main() {
  setStep('step-sdk', 'active');

  // Step 1 — Load SDK from CDN
  const { createDropinCheckout } = await loadDropInCheckout(
    getEnvironment(),
  );
  setStep('step-sdk', 'done');
  setStep('step-init', 'active');

  // Step 2 — Fetch session
  let session: string;
  try {
    session = getSession();
  } catch (err) {
    setStep('step-init', 'error');
    showNotice(String(err));
    return;
  }

  // Step 2 — Initialise the drop-in
  const dropin = await createDropinCheckout({session},
    // Optional: listen to drop-in lifecycle events
    // event => console.log('[dropin event]', event.code, event.payload),
  );
  setStep('step-init', 'done');
  setStep('step-mount', 'active');

  // Step 3 — Mount the widget into the page
  const container = $('dropin-container') as HTMLElement;
  await dropin.mount(container);
  setStep('step-mount', 'done');
  setStep('step-pay', 'active');

  // Subscribe to payment fulfillment — enables the external pay button
  // when the user has fully configured their payment (method selected + form valid).
  dropin.isPaymentFulfilled.subscribe(fulfilled => {
    payBtn.disabled = !fulfilled;
  });

  // Step 4 — External pay button (optional, drop-in has its own by default)
  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    payBtn.textContent = 'Processing…';
    payBtn.classList.add('loading');

    try {
      await dropin.submitPayment();
      setStep('step-pay', 'done');
      showResult('success', { status: 'submitted' });
    } catch (err) {
      setStep('step-pay', 'error');
      showResult('error', String(err));
      payBtn.disabled = false;
      payBtn.textContent = 'Retry';
      payBtn.classList.remove('loading');
    }
  });
}

main();
