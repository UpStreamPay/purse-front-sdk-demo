// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const tokenListEl = document.getElementById('token-list');
  const stepCvvEl   = document.getElementById('step-cvv');
  const formEl      = document.getElementById('cvv-form');
  const payBtn      = document.getElementById('pay-btn') as HTMLButtonElement;
  const resultEl    = document.getElementById('result');

  let activeElement = null;

  checkout.paymentTokens.subscribe((tokens) => {
    const primary = tokens.filter(t => !t.isSecondary);

    tokenListEl.innerHTML = '';

    if (!primary.length) {
      tokenListEl.innerHTML =
        '<p class="text-sm text-gray-400 italic px-1">No saved tokens found in this session.</p>';
      return;
    }

    primary.forEach((token) => {
      const btn = document.createElement('button');
      btn.className = 'token-btn flex items-center gap-3 w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 mb-2 text-sm font-medium text-gray-700 bg-white cursor-pointer';

      // Card icon
      const iconWrap = document.createElement('span');
      iconWrap.className = 'w-7 h-7 shrink-0 flex items-center justify-center rounded bg-gray-100';
      iconWrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-gray-500"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.5"/></svg>`;

      const info = document.createElement('div');
      info.className = 'flex flex-col text-left';

      const pan = document.createElement('span');
      pan.className = 'font-semibold text-gray-900';
      pan.textContent = token.description?.masked_pan ?? token.name ?? token.id;

      const meta = document.createElement('span');
      meta.className = 'text-xs text-gray-400';
      meta.textContent = [token.description?.brand, token.description?.expiration_date].filter(Boolean).join(' · ');

      info.appendChild(pan);
      if (meta.textContent) info.appendChild(meta);

      btn.appendChild(iconWrap);
      btn.appendChild(info);
      btn.addEventListener('click', () => selectToken(token, btn));
      tokenListEl.appendChild(btn);
    });
  });

  function selectToken(token, btn) {
    tokenListEl.querySelectorAll('.token-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    activeElement?.remove();
    formEl.innerHTML = '';
    stepCvvEl.classList.remove('hidden');

    if (token.disabled?.value) {
      formEl.innerHTML = '<p class="unavailable">This token is currently unavailable.</p>';
      return;
    }

    activeElement = token.getPaymentElement();
    activeElement.appendTo(formEl);
  }

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
