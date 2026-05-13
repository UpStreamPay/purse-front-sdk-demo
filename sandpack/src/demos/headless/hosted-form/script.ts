// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  // 1 – Load the SDK
  const Purse = await loadHeadlessCheckout('sandbox');

  // 2 – Initialise the checkout
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  // 3 – hostedForm config: all four fields rendered inside a single iframe
  const paymentConfig = {
    hostedForm: {
      panInputLabel:        'Card number',
      panPlaceholder:       '1234 5678 9012 3456',
      cvvInputLabel:        'Security code',
      cvvPlaceholder:       '123',
      cvv4InputLabel:       'Security code',
      cvv4Placeholder:      '1234',
      expirationInputLabel: 'Expiry date',
      expirationPlaceholder:'MM / YY',
      holderInputLabel:     'Cardholder name',
      holderPlaceholder:    'Name as it appears on card',
    },
    theme: {
      global: { fontSize: '16px', fontFamily: 'sans-serif' },
    },
  };

  // 4 – Wait for payment methods, pick the first available card method
  const skeletonEl = document.getElementById('skeleton')!;
  const formEl     = document.getElementById('hosted-form')!;
  checkout.paymentMethods.subscribe((methods: any[]) => {
    const cardMethod = methods.find(m => !m.disabled?.value && m.method === 'creditcard');
    if (!cardMethod) return;

    // Mount the complete hosted form (single iframe: PAN + expiry + CVV + holder)
    const element = cardMethod.getPaymentElement(paymentConfig);
    element.appendTo(formEl);

    skeletonEl.classList.add('hidden');
    formEl.classList.remove('hidden');
  });

  // 5 – Enable pay once all fields are valid
  const payBtn = document.getElementById('pay-btn') as HTMLButtonElement;
  checkout.isPaymentFulfilled.subscribe((isReady: boolean) => {
    payBtn.disabled = !isReady;
  });

  // 6 – Submit
  const resultEl = document.getElementById('result')!;
  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    const BASE = 'mx-7 mb-6 text-sm rounded-lg flex items-center gap-2 p-3 border';
    try {
      await checkout.submitPayment();
      resultEl.className = `${BASE} bg-emerald-50 border-emerald-200 text-emerald-800`;
      resultEl.innerHTML = `<svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Payment submitted successfully!`;
    } catch (err) {
      resultEl.className = `${BASE} bg-red-50 border-red-200 text-red-800`;
      resultEl.innerHTML = `<svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg> ${(err as Error).message}`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
    }
  });
}

init();
