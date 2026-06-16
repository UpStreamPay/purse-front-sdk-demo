// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const skeletonEl  = document.getElementById('skeleton');
  const formEl      = document.getElementById('hosted-form');
  const checkboxEl  = document.getElementById('save-card') as HTMLInputElement;
  const nameRowEl   = document.getElementById('name-row');
  const nameInput   = document.getElementById('card-name') as HTMLInputElement;
  const regStateEl  = document.getElementById('reg-state');
  const payBtn      = document.getElementById('pay-btn') as HTMLButtonElement;
  const resultEl    = document.getElementById('result');

  const paymentConfig = {
    hostedForm: {
      panInputLabel:         'Card number',
      panPlaceholder:        '1234 5678 9012 3456',
      cvvInputLabel:         'Security code',
      cvvPlaceholder:        '123',
      expirationInputLabel:  'Expiry date',
      expirationPlaceholder: 'MM / YY',
      holderInputLabel:      'Cardholder name',
      holderPlaceholder:     'Name as it appears on card',
    },
    theme: { global: { fontSize: '16px', fontFamily: 'sans-serif' } },
  };

  // createHeadlessCheckout resolves after session ready — paymentMethods.value populated sync
  const creditCard = checkout.paymentMethods.value.find(m => !m.disabled?.value && m.method === 'creditcard');
  if (!creditCard) {
    skeletonEl.textContent = 'No credit card method available in this session.';
    return;
  }

  creditCard.getPaymentElement(paymentConfig).appendTo(formEl);
  skeletonEl.classList.add('hidden');
  formEl.classList.remove('hidden');

  // Toggle save-card: call register() on the method
  checkboxEl.addEventListener('change', async () => {
    if (checkboxEl.checked) {
      nameRowEl.classList.remove('hidden');
      await creditCard.register(true, { name: nameInput.value || 'My Card' });
    } else {
      nameRowEl.classList.add('hidden');
      await creditCard.register(false);
    }
  });

  // Update name in real-time when the user types
  nameInput.addEventListener('input', async () => {
    if (checkboxEl.checked) {
      await creditCard.register(true, { name: nameInput.value || 'My Card' });
    }
  });

  // Subscribe to registration state for UI feedback
  creditCard.registration.subscribe((state) => {
    if (state.registered) {
      regStateEl.textContent = `Will be saved as "${state.name}"`;
      regStateEl.className = 'reg-active';
    } else {
      regStateEl.textContent = '';
      regStateEl.className = '';
    }
  });

  checkout.isPaymentFulfilled.subscribe((isReady) => { payBtn.disabled = !isReady; });

  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    const BASE = 'result-banner';
    try {
      await checkout.submitPayment();
      const saved = checkboxEl.checked ? ' Card saved.' : '';
      resultEl.className = `${BASE} success`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Payment submitted!${saved}`;
    } catch (err) {
      resultEl.className = `${BASE} error`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg> ${err.message}`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
    }
  });
}

init();
