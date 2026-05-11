import type { DemoConfig } from '../types';

const TENANT_ID = process.env.VITE_SECUREFIELDS_TENANT_ID ?? '';
const API_KEY   = process.env.VITE_SECUREFIELDS_LOGS_API_KEY ?? '';

export const secureFieldsDemo: DemoConfig = {
  template: 'vanilla-ts',
  customSetup: {
    dependencies: {
      '@purse-eu/web-sdk': 'latest',
      '@tailwindcss/browser': '^4',
    },
  },
  files: {
    '/index.html': {
      code: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Secure Fields</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="bg-gray-100 min-h-screen flex items-start justify-center py-10 px-4 font-sans text-gray-900">

    <div class="bg-white rounded-2xl shadow-xl w-full h-full overflow-hidden">

      <!-- Header -->
      <div class="flex items-center gap-3 px-7 py-5 border-b border-gray-100">
        <svg class="w-8 h-8 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#4f46e5"/>
          <path d="M8 12.5l2.5 2.5L16 9" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 4L5 7v4.5C5 15.1 8 18.6 12 20c4-1.4 7-4.9 7-8.5V7L12 4z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div>
          <h1 class="text-base font-semibold tracking-tight leading-none">Secure Fields</h1>
          <p class="text-xs text-gray-400 mt-0.5">Card tokenization via isolated iframes</p>
        </div>
      </div>

      <!-- Credentials notice -->
      <div id="config-notice" class="hidden mx-7 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong class="font-semibold">Configure credentials:</strong> replace <code class="font-mono bg-amber-100 px-1 rounded">TENANT_ID</code> and <code class="font-mono bg-amber-100 px-1 rounded">API_KEY</code> in <code class="font-mono bg-amber-100 px-1 rounded">index.ts</code> with your Purse credentials to run this demo.
      </div>

      <!-- Fields -->
      <div class="px-7 pt-6 pb-4 space-y-3">

        <!-- Card number -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium text-gray-600">Card number</label>
            <div id="brand-pills" class="hidden flex gap-1.5" aria-live="polite"></div>
          </div>
          <div id="sf-pan" class="flex items-center px-3 h-11 bg-white border border-gray-200 rounded-xl overflow-hidden"></div>
        </div>

        <!-- Expiry + CVV -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Expiry date</label>
            <div id="sf-exp" class="flex items-center px-3 h-11 bg-white border border-gray-200 rounded-xl overflow-hidden"></div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Security code</label>
            <div id="sf-cvv" class="flex items-center px-3 h-11 bg-white border border-gray-200 rounded-xl overflow-hidden"></div>
          </div>
        </div>

        <!-- Cardholder name -->
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Cardholder name</label>
          <div id="sf-name" class="flex items-center px-3 h-11 bg-white border border-gray-200 rounded-xl overflow-hidden"></div>
        </div>

      </div>

      <!-- Submit -->
      <div class="px-7 pb-6 pt-2">
        <button id="pay-btn" disabled
          class="flex items-center justify-center gap-2 w-full py-3.5 bg-indigo-600 text-white rounded-xl text-[15px] font-semibold disabled:bg-indigo-300 disabled:text-indigo-100 disabled:cursor-not-allowed">
          <span class="btn-text">Tokenise card</span>
          <svg class="btn-spinner w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/>
          </svg>
        </button>
        <p class="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400">
          <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1L2 3.5v4C2 11 4.7 13.9 8 15c3.3-1.1 6-4 6-7.5v-4L8 1z" stroke="#9ca3af" stroke-width="1.2" stroke-linejoin="round"/></svg>
          Card details are isolated in secure iframes — no PAN touches your code
        </p>
      </div>

      <!-- Result -->
      <div id="result" class="hidden mx-7 mb-6"></div>

    </div>

    <script type="module" src="./index.ts"></script>
  </body>
</html>`,
      readOnly: false,
    },
    '/index.ts': {
      code: `import '@tailwindcss/browser';
import { loadSecureFields } from '@purse-eu/web-sdk';

const TENANT_ID = '${TENANT_ID}';
const API_KEY   = '${API_KEY}';

(async () => {
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

  // 2 – Initialise: each \`target\` ID must match a container in the HTML
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
    if (!brands?.length) {
      brandEl.classList.add('hidden');
      return;
    }
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
      resultEl.innerHTML = \`<span class="font-semibold">Error:</span> \${result.error}\`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
      return;
    }

    // vault_form_token is ready — send it to your backend to create a payment
    const token = (result as any).vault_form_token as string;
    const card  = (result as any).card;

    resultEl.className = 'mx-7 mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs';
    resultEl.innerHTML = \`
      <p class="font-semibold text-emerald-700 mb-2">vault_form_token received</p>
      <code class="block font-mono text-emerald-800 break-all">\${token}</code>
      \${card ? \`<p class="mt-2 text-emerald-600">\${card.detected_brands?.join(' / ')} &middot; &bull;&bull;&bull;&bull; \${card.last_four_digits}</p>\` : ''}
      <p class="mt-2 text-emerald-600 font-sans">Pass this token to your backend to create a payment via the Payment API.</p>
    \`;
  });
})();`,
      readOnly: false,
    },
    '/styles.css': {
      code: `/* Pay button interactive states */
#pay-btn:not(:disabled) { transition: background 0.15s, transform 0.1s, box-shadow 0.15s; cursor: pointer; }
#pay-btn:not(:disabled):hover { background: #4338ca; box-shadow: 0 4px 12px rgb(79 70 229 / 0.4); transform: translateY(-1px); }
#pay-btn:not(:disabled):active { transform: translateY(0); }
#pay-btn.loading .btn-text { opacity: 0.7; }
#pay-btn.loading .btn-spinner { display: block !important; }`,
      readOnly: true,
    },
  },
};
