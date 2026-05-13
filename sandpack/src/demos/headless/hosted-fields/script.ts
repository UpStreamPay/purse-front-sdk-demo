import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  // 1 – Load the SDK
  const Purse = await loadHeadlessCheckout('sandbox');

  // 2 – Initialise the checkout
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  // 3 – hostedFields config: each field rendered in its own isolated iframe
  const paymentConfig= {
    fields: {
      cardNumber:        { label: 'Card number',        placeholder: '1234 5678 9012 3456' ,          target :'pan-field'},
      cvv:        { label: 'Security code',      placeholder: '123' ,                          target :'cvv-field'},
      expDate:     { label: 'Expiry date',        placeholder: 'MM / YY' ,                      target :'expiry-field'},
      holderName: { label: 'Cardholder name',    placeholder: 'Name as it appears on card',    target :'holder-field' },
    },
    theme: {
      global: { fontSize: '16px', fontFamily: 'sans-serif' },
      input :{}
    },
  };

  // 4 – Wait for payment methods, pick the first available card method
  checkout.paymentMethods.subscribe((methods) => {
    const cardMethod = methods.find(m => !m.disabled?.value && m.method === 'creditcard');
    if (!cardMethod || cardMethod.isSecondary) return;

    // getPaymentElement returns an object with individual field handles
    const element = cardMethod.getHostedFields(paymentConfig);

    // Mount each field into its dedicated container (separate iframes)
    element.render()
  });

  // 5 – Layout switcher
  const wrapper    = document.getElementById('fields-wrapper')!;
  const layoutBtns = document.querySelectorAll<HTMLButtonElement>('.layout-btn');
  layoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      wrapper.className = `layout-${btn.dataset.layout}`;
      layoutBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 6 – Enable pay once all fields are valid
  const payBtn = document.getElementById('pay-btn') as HTMLButtonElement;
  checkout.isPaymentFulfilled.subscribe((isReady: boolean) => {
    payBtn.disabled = !isReady;
  });

  // 7 – Submit
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
