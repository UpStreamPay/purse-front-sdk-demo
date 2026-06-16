// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const methodListEl  = document.getElementById('method-list');
  const formEl        = document.getElementById('form');
  const stepFieldsEl  = document.getElementById('step-fields');
  const payBtn        = document.getElementById('pay-btn') as HTMLButtonElement;

  let activeElement = null;

  checkout.paymentMethods.subscribe((methods) => {
    // Find redirect-type payment methods
    const redirectMethods = methods.filter(
      m => !m.isSecondary && m.integrationType === 'redirection',
    );

    methodListEl.innerHTML = '';

    if (!redirectMethods.length) {
      methodListEl.innerHTML =
        '<p class="text-sm text-gray-400 italic px-1">No redirect methods available in this session.</p>';
      return;
    }

    redirectMethods.forEach((method) => {
      const btn = document.createElement('button');
      btn.className = 'method-btn flex items-center gap-3 w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 mb-2 text-sm font-medium text-gray-700 bg-white cursor-pointer';

      const icon = document.createElement('img');
      icon.src = method.iconUrl;
      icon.alt = method.method;
      icon.className = 'w-7 h-7 rounded object-contain shrink-0';

      const label = document.createElement('span');
      label.textContent = method.name ?? `${method.method} (${method.partner})`;

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.addEventListener('click', () => selectMethod(method, btn));
      methodListEl.appendChild(btn);
    });
  });

  function selectMethod(method, btn) {
    methodListEl.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    activeElement?.remove();
    formEl.innerHTML = '';
    stepFieldsEl.classList.remove('hidden');

    if (method.disabled?.value) {
      formEl.innerHTML = '<p class="unavailable">This method is currently unavailable.</p>';
      return;
    }

    // Redirection: the payment element shows the redirect notice
    activeElement = method.getPaymentElement({
      redirection: { title: `You will be redirected to ${method.name ?? method.partner}` },
    });
    activeElement.appendTo(formEl);
  }

  checkout.isPaymentFulfilled.subscribe((isReady) => { payBtn.disabled = !isReady; });

  const resultEl = document.getElementById('result');
  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    const BASE = 'result-banner';
    try {
      await checkout.submitPayment();
      resultEl.className = `${BASE} success`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Redirecting…`;
    } catch (err) {
      resultEl.className = `${BASE} error`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg> ${err.message}`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
    }
  });
}

init();
