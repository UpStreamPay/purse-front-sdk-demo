import type { DemoConfig } from '../types';

export const hostedFormDemo: DemoConfig = {
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
    <title>Hosted Form</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="bg-gray-100 min-h-screen flex items-start justify-center py-10 px-4 font-sans text-gray-900">

    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

      <div class="flex items-center gap-3 px-7 py-6 border-b border-gray-100">
        <svg class="w-8 h-8 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#4f46e5"/>
          <path d="M5 12h14M9 8l-4 4 4 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div>
          <h1 class="text-lg font-semibold tracking-tight leading-none">Card Payment</h1>
          <p class="text-xs text-gray-400 mt-0.5">All fields rendered in a single iframe</p>
        </div>
      </div>

      <!-- Skeleton shown while the hosted form loads -->
      <div id="skeleton" class="px-7 pt-6 pb-4 space-y-3">
        <div class="h-14 bg-gray-100 rounded-xl animate-pulse"></div>
        <div class="flex gap-3">
          <div class="h-14 bg-gray-100 rounded-xl animate-pulse flex-1"></div>
          <div class="h-14 bg-gray-100 rounded-xl animate-pulse flex-1"></div>
        </div>
        <div class="h-14 bg-gray-100 rounded-xl animate-pulse"></div>
      </div>

      <!-- Single hosted-form iframe mounts here -->
      <div id="hosted-form" class="px-7 pt-6 pb-2 hidden"></div>

      <div class="px-7 pb-6 pt-4">
        <button id="pay-btn" disabled
          class="flex items-center justify-center gap-2 w-full py-3.5 bg-indigo-600 text-white rounded-xl text-[15px] font-semibold disabled:bg-indigo-300 disabled:text-indigo-100 disabled:cursor-not-allowed">
          <span class="btn-text">Pay now</span>
          <svg class="btn-spinner w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="31.4" stroke-dashoffset="10"/>
          </svg>
        </button>
        <p class="flex items-center justify-center gap-1.5 mt-3 text-xs text-gray-400">
          <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1L2 3.5v4C2 11 4.7 13.9 8 15c3.3-1.1 6-4 6-7.5v-4L8 1z" stroke="#9ca3af" stroke-width="1.2" stroke-linejoin="round"/></svg>
          Payments are encrypted and secure
        </p>
      </div>

      <div id="result" class="hidden mx-7 mb-6 text-sm rounded-lg flex items-center gap-2"></div>

    </div>

    <script type="module" src="./index.ts"></script>
  </body>
</html>`,
      readOnly: false,
    },
    '/index.ts': {
      code: `import '@tailwindcss/browser';
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';

(async () => {
  // 1 – Load the SDK
  const Purse = await loadHeadlessCheckout('sandbox');

  // 2 – Initialise the checkout
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const skeletonEl = document.getElementById('skeleton')!;
  const formEl     = document.getElementById('hosted-form')!;
  const payBtn     = document.getElementById('pay-btn') as HTMLButtonElement;
  const resultEl   = document.getElementById('result')!;

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
  checkout.isPaymentFulfilled.subscribe((isReady: boolean) => {
    payBtn.disabled = !isReady;
  });

  // 6 – Submit
  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    const BASE = 'mx-7 mb-6 text-sm rounded-lg flex items-center gap-2 p-3 border';
    try {
      await checkout.submitPayment();
      resultEl.className = \`\${BASE} bg-emerald-50 border-emerald-200 text-emerald-800\`;
      resultEl.innerHTML = \`<svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Payment submitted successfully!\`;
    } catch (err) {
      resultEl.className = \`\${BASE} bg-red-50 border-red-200 text-red-800\`;
      resultEl.innerHTML = \`<svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg> \${(err as Error).message}\`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
    }
  });
})();`,
      readOnly: false,
    },
    '/styles.css': {
      code: `#pay-btn:not(:disabled) { transition: background 0.15s, transform 0.1s, box-shadow 0.15s; cursor: pointer; }
#pay-btn:not(:disabled):hover { background: #4338ca; box-shadow: 0 4px 12px rgb(79 70 229 / 0.4); transform: translateY(-1px); }
#pay-btn:not(:disabled):active { transform: translateY(0); }
#pay-btn.loading .btn-text { opacity: 0.7; }
#pay-btn.loading .btn-spinner { display: block !important; }`,
      readOnly: true,
    },
  },
};
