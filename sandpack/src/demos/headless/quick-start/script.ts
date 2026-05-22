// @ts-nocheck
import { loadHeadlessCheckout, PurseHeadlessCheckoutPaymentMethod } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  // 1 – Load the SDK
  const Purse = await loadHeadlessCheckout('sandbox');

  // 2 – Initialise the checkout
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const paymentConfig = {
    hostedForm: {
      panInputLabel: 'Card number',
      panPlaceholder: '1234 5678 9012 3456',
      cvvInputLabel: 'Security code',
      cvvPlaceholder: '123',
      cvv4InputLabel: 'Security code',
      cvv4Placeholder: '1234',
      expirationInputLabel: 'Expiry date',
      expirationPlaceholder: 'MM / YY',
      holderInputLabel: 'Cardholder name',
      holderPlaceholder: 'Name as it appears on card',
    },
    theme: {
      global: { fontSize: '16px', fontFamily: 'sans-serif' },
    },
  };

  // 3 – Render available payment methods
  const methodListEl = document.getElementById('method-list')!;
  const stepFields   = document.getElementById('step-fields')!;
  const formEl       = document.getElementById('form')!;
  let activeElement: any = null;

  function renderMethodButton(method: PurseHeadlessCheckoutPaymentMethod, isSecondary: boolean) {
    const btn = document.createElement('button');
    btn.className = 'method-btn flex items-center w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 mb-2 text-sm font-medium text-gray-700 bg-white gap-3 cursor-pointer';

    const dot = document.createElement('span');
    dot.className = isSecondary
      ? 'radio-dot w-4 h-4 rounded-full shrink-0 border-2 border-dashed border-gray-400'
      : 'radio-dot w-4 h-4 rounded-full shrink-0';

    const label = document.createElement('span');
    label.textContent = method.name ?? `${method.method} (${method.partner})`;

    btn.appendChild(dot);
    btn.appendChild(label);
    btn.addEventListener('click', () => selectMethod(method, btn));
    return btn;
  }

  checkout.paymentMethods.subscribe((methods: PurseHeadlessCheckoutPaymentMethod[]) => {
    methodListEl.innerHTML = '';

    const primaries   = methods.filter(m => !m.isSecondary);
    const secondaries = methods.filter(m =>  m.isSecondary);

    primaries.forEach(method => {
      methodListEl.appendChild(renderMethodButton(method, false));
    });

    if (secondaries.length > 0) {
      const divider = document.createElement('p');
      divider.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-2 px-1';
      divider.textContent = 'Gift cards & partial payments';
      methodListEl.appendChild(divider);

      secondaries.forEach(method => {
        methodListEl.appendChild(renderMethodButton(method, true));
      });
    }
  });

  // 4 – On selection: render the payment element into the form container
  function selectMethod(method: PurseHeadlessCheckoutPaymentMethod, btn: HTMLElement) {
    methodListEl.querySelectorAll('.method-btn').forEach(b => {
      b.classList.remove('active');
      const d = b.querySelector('.radio-dot') as HTMLElement | null;
      if (d) { d.style.borderColor = ''; d.style.background = ''; d.style.boxShadow = ''; }
    });
    btn.classList.add('active');
    const dot = btn.querySelector('.radio-dot') as HTMLElement | null;
    if (dot) {
      dot.style.borderColor = '#4f46e5';
      dot.style.background = '#4f46e5';
      dot.style.boxShadow = 'inset 0 0 0 3px white';
    }

    activeElement?.remove();
    formEl.innerHTML = '';
    stepFields.classList.remove('step-hidden');

    if (method.disabled?.value) {
      formEl.innerHTML = `<p class="unavailable">This payment method is currently unavailable.</p>`;
      return;
    }

    if (method.isSecondary) {
      formEl.innerHTML = `
        <div class="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800 space-y-2">
          <p class="font-semibold">Gift card / split payment</p>
          <p>Call <code class="bg-indigo-100 rounded px-1 font-mono">method.take(amount)</code> to apply this method to the split, then pay the remainder with a primary method.</p>
        </div>`;
      return;
    }

    activeElement = method.getPaymentElement(paymentConfig);
    activeElement.appendTo(formEl);
  }

  // 5 – Enable the pay button once the form is complete
  const payBtn = document.getElementById('pay-btn') as HTMLButtonElement;
  checkout.isPaymentFulfilled.subscribe((isReady: boolean) => {
    payBtn.disabled = !isReady;
  });

  // 6 – Submit and display the result
  const resultEl = document.getElementById('result')!;
  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    resultEl.textContent = '';
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
