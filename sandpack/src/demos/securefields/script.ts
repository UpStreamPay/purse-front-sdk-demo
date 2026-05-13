// @ts-nocheck
import { loadSecureFields } from '@purse-eu/web-sdk';
import './styles.css';

const TENANT_ID = '__TENANT_ID__';
const API_KEY   = '__API_KEY__';

export async function init() {
  const payBtn   = document.getElementById('pay-btn') as HTMLButtonElement;
  const resultEl = document.getElementById('result')!;
  const noticeEl = document.getElementById('config-notice')!;
  const brandEl  = document.getElementById('brand-pills')!;

  if (!TENANT_ID) {
    noticeEl.classList.remove('hidden');
    return;
  }

  // 1 – Load the SecureFields SDK
  const { initSecureFields } = await loadSecureFields('sandbox');

  // 2 – Initialise: each `target` ID must match a container in the HTML
  const sf = await initSecureFields({
    tenantId: TENANT_ID,
    apiKey: API_KEY,
    config: {
      brands: ['VISA', 'MASTERCARD', 'CARTE_BANCAIRE', 'AMERICAN_EXPRESS'],
      brandSelector: false, // we render brand pills ourselves via the brandDetected event
      fields: {
        cardNumber: { target: 'sf-pan',  placeholder: '1234 5678 9012 3456' },
        expDate:    { target: 'sf-exp',  placeholder: 'MM / YY' },
        cvv:        { target: 'sf-cvv',  placeholder: '123' },
        holderName: { target: 'sf-name', placeholder: 'Name as it appears on card' },
      },
      styles: {
        input: {
          fontSize: '14px',
          color: '#111827',
          placeholderColor: '#9ca3af',
          ':focus': { color: '#111827' },
        },
      },
    },
  });

  // 3 – Enable submit once all fields are valid
  sf.on('formValid', ({ hasErrors }) => {
    payBtn.disabled = hasErrors;
  });

  // 4 – Show detected card network(s) as pills
  sf.on('brandDetected', ({ brands }) => {
    brandEl.innerHTML = '';
    if (!brands?.length) { brandEl.classList.add('hidden'); return; }
    brandEl.classList.remove('hidden');
    brands.forEach(brand => {
      const pill = document.createElement('span');
      pill.className = 'px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200';
      pill.textContent = brand;
      brandEl.appendChild(pill);
    });
  });

  // 5 – Render the field iframes into their target containers
  sf.render();

  // 6 – Tokenise on submit
  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    resultEl.innerHTML = '';

    const result = await sf.submit({ saveToken: false });

    if ('error' in result && result.error) {
      resultEl.className = 'mx-7 mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800';
      resultEl.innerHTML = `<span class="font-semibold">Error:</span> ${result.error}`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
      return;
    }

    const token = result.vault_form_token;
    const card  = result.card;
    resultEl.className = 'mx-7 mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs';
    resultEl.innerHTML = `
      <p class="font-semibold text-emerald-700 mb-2">vault_form_token received</p>
      <code class="block font-mono text-emerald-800 break-all">${token}</code>
      ${card ? `<p class="mt-2 text-emerald-600">${card.detected_brands?.join(' / ')} &middot; &bull;&bull;&bull;&bull; ${card.last_four_digits}</p>` : ''}
      <p class="mt-2 text-emerald-600 font-sans">Pass this token to your backend to create a payment via the Payment API.</p>
    `;
  });
}

init();
