// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const methodListEl  = document.getElementById('method-list');
  const gcFormEl      = document.getElementById('gc-form');
  const panInput      = document.getElementById('pan') as HTMLInputElement;
  const cvvRow        = document.getElementById('cvv-row');
  const cvvInput      = document.getElementById('cvv') as HTMLInputElement;
  const loadBtn       = document.getElementById('load-btn') as HTMLButtonElement;
  const balanceEl     = document.getElementById('balance-section');
  const balanceValEl  = document.getElementById('balance-value');
  const amountInput   = document.getElementById('take-amount') as HTMLInputElement;
  const applyBtn      = document.getElementById('apply-btn') as HTMLButtonElement;
  const feedbackEl    = document.getElementById('feedback');
  const payBtn        = document.getElementById('pay-btn') as HTMLButtonElement;
  const resultEl      = document.getElementById('result');

  let selectedMethod  = null;
  let activeToken     = null;

  checkout.paymentMethods.subscribe((methods) => {
    const secondaries = methods.filter(m => m.isSecondary);

    methodListEl.innerHTML = '';

    if (!secondaries.length) {
      methodListEl.innerHTML =
        '<p class="text-sm text-gray-400 italic px-1">No gift card method available in this session.</p>';
      return;
    }

    secondaries.forEach((method) => {
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
      btn.addEventListener('click', () => {
        methodListEl.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMethod = method;
        gcFormEl.classList.remove('hidden');
        balanceEl.classList.add('hidden');
        activeToken = null;
        panInput.value = '';
        cvvInput.value = '';

        // Show CVV field only if this method requires it (uses initial empty PAN)
        const needsCvv = method.requiresCVV?.('') ?? true;
        cvvRow.classList.toggle('hidden', !needsCvv);

        // Re-evaluate CVV visibility when PAN changes
        panInput.addEventListener('input', () => {
          const show = selectedMethod?.requiresCVV?.(panInput.value) ?? true;
          cvvRow.classList.toggle('hidden', !show);
        });
      });
      methodListEl.appendChild(btn);
    });
  });

  loadBtn.addEventListener('click', async () => {
    if (!selectedMethod) return;
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading…';
    feedbackEl.textContent = '';

    try {
      const cvv = cvvRow.classList.contains('hidden') ? undefined : cvvInput.value || undefined;
      activeToken = await selectedMethod.getSecondaryToken(panInput.value, cvv);

      activeToken.balance.subscribe((bal) => {
        balanceValEl.textContent = `€${bal.toFixed(2)}`;
      });

      balanceEl.classList.remove('hidden');
    } catch (err) {
      feedbackEl.textContent = err.message;
    } finally {
      loadBtn.disabled = false;
      loadBtn.textContent = 'Load card';
    }
  });

  applyBtn.addEventListener('click', async () => {
    if (!activeToken) return;
    applyBtn.disabled = true;
    feedbackEl.textContent = '';

    try {
      await activeToken.take(parseFloat(amountInput.value));
      feedbackEl.textContent = `✓ ${amountInput.value} applied to split.`;
    } catch (err) {
      feedbackEl.textContent = err.message;
    } finally {
      applyBtn.disabled = false;
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
      resultEl.className = `${BASE} success`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Payment submitted!`;
    } catch (err) {
      resultEl.className = `${BASE} error`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg> ${err.message}`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
    }
  });
}

init();
