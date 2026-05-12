import type { DemoConfig } from '../types';

export const hostedFieldsDemo: DemoConfig = {
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
    <title>Hosted Fields</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="bg-gray-100 min-h-screen flex items-start justify-center py-10 px-4 font-sans text-gray-900">

    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">

      <div class="flex items-center justify-between gap-3 px-7 py-5 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <svg class="w-8 h-8 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect width="24" height="24" rx="6" fill="#4f46e5"/>
            <rect x="4" y="9" width="16" height="3" rx="1" fill="white" opacity=".9"/>
            <rect x="4" y="14" width="6" height="2" rx="1" fill="white" opacity=".6"/>
            <rect x="12" y="14" width="4" height="2" rx="1" fill="white" opacity=".6"/>
          </svg>
          <div>
            <h1 class="text-base font-semibold tracking-tight leading-none">Hosted Fields</h1>
            <p class="text-xs text-gray-400 mt-0.5">Each field is an isolated iframe</p>
          </div>
        </div>

        <!-- Layout switcher -->
        <div class="flex gap-1 bg-gray-100 rounded-lg p-1" role="group" aria-label="Field layout">
          <button data-layout="grid"
            class="layout-btn active px-2.5 py-1 rounded-md text-xs font-medium transition-all">
            Grid
          </button>
          <button data-layout="single-line"
            class="layout-btn px-2.5 py-1 rounded-md text-xs font-medium transition-all">
            Inline
          </button>
          <button data-layout="card"
            class="layout-btn px-2.5 py-1 rounded-md text-xs font-medium transition-all">
            Card
          </button>
        </div>
      </div>

      <!-- Fields area — layout class drives the arrangement -->
      <div class="px-7 pt-6 pb-4">
        <div id="fields-wrapper" class="layout-grid">
          <div id="pan-field"    class="field-slot field-pan"></div>
          <div id="expiry-field" class="field-slot field-expiry"></div>
          <div id="cvv-field"    class="field-slot field-cvv"></div>
          <div id="holder-field" class="field-slot field-holder"></div>
        </div>
      </div>

      <div class="px-7 pb-6 pt-2">
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
      readOnly: true,
    },
    '/index.ts': {
      code: `import '@tailwindcss/browser';
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';

export async function init() {
  // 1 – Load the SDK
  const Purse = await loadHeadlessCheckout('sandbox');

  // 2 – Initialise the checkout
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  // 3 – hostedFields config: each field rendered in its own isolated iframe
  const paymentConfig = {
    hostedFields: {
      pan:        { label: 'Card number',       placeholder: '1234 5678 9012 3456' },
      expiry:     { label: 'Expiry date',        placeholder: 'MM / YY' },
      cvv:        { label: 'Security code',      placeholder: '123' },
      holderName: { label: 'Cardholder name',    placeholder: 'Name as it appears on card' },
    },
    theme: {
      global: { fontSize: '16px', fontFamily: 'sans-serif' },
    },
  };

  // 4 – Wait for payment methods, pick the first available card method
  checkout.paymentMethods.subscribe((methods: any[]) => {
    const cardMethod = methods.find(m => !m.disabled?.value);
    if (!cardMethod) return;

    // getPaymentElement returns an object with individual field handles
    const element = cardMethod.getPaymentElement(paymentConfig);

    // Mount each field into its dedicated container (separate iframes)
    element.fields.pan.appendTo(document.getElementById('pan-field')!);
    element.fields.expiry.appendTo(document.getElementById('expiry-field')!);
    element.fields.cvv.appendTo(document.getElementById('cvv-field')!);
    element.fields.holderName.appendTo(document.getElementById('holder-field')!);
  });

  // 5 – Layout switcher
  const wrapper    = document.getElementById('fields-wrapper')!;
  const layoutBtns = document.querySelectorAll<HTMLButtonElement>('.layout-btn');
  layoutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      wrapper.className = \`layout-\${btn.dataset.layout}\`;
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
      resultEl.className = \`\${BASE} bg-emerald-50 border-emerald-200 text-emerald-800\`;
      resultEl.innerHTML = \`<svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Payment submitted successfully!\`;
    } catch (err) {
      resultEl.className = \`\${BASE} bg-red-50 border-red-200 text-red-800\`;
      resultEl.innerHTML = \`<svg class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg> \${(err as Error).message}\`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
    }
  });
}

init();`,
      readOnly: false,
      active: true,
    },
    '/styles.css': {
      code: `/* ── Layout: Grid (default) ─────────────────────────────────────────── */
.layout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.layout-grid .field-pan    { grid-column: 1 / -1; }
.layout-grid .field-holder { grid-column: 1 / -1; }

/* ── Layout: Single-line (inline strip) ─────────────────────────────── */
.layout-single-line {
  display: flex;
  gap: 8px;
  align-items: stretch;
  flex-wrap: nowrap;
  overflow-x: auto;
}
.layout-single-line .field-slot { min-width: 0; }
.layout-single-line .field-pan    { flex: 2.5; }
.layout-single-line .field-expiry { flex: 1.2; }
.layout-single-line .field-cvv    { flex: 1; }
.layout-single-line .field-holder { flex: 2; }

/* ── Layout: Card-shaped ─────────────────────────────────────────────── */
.layout-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: linear-gradient(135deg, #4338ca 0%, #7c3aed 100%);
  border-radius: 16px;
  padding: 24px 20px 20px;
  box-shadow: 0 8px 24px rgb(99 102 241 / 0.35);
}
.layout-card .field-pan    { grid-column: 1 / -1; }
.layout-card .field-holder { grid-column: 1 / -1; }

/* Field slot base — gives each iframe a visual border */
.field-slot {
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
  min-height: 52px;
}
.layout-card .field-slot {
  border-color: rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.12);
}

/* Layout switcher pill styles */
.layout-btn { color: #6b7280; }
.layout-btn.active { background: #fff; color: #4f46e5; font-weight: 600; box-shadow: 0 1px 3px rgb(0 0 0 / 0.1); }

/* Pay button states */
#pay-btn:not(:disabled) { transition: background 0.15s, transform 0.1s, box-shadow 0.15s; cursor: pointer; }
#pay-btn:not(:disabled):hover { background: #4338ca; box-shadow: 0 4px 12px rgb(79 70 229 / 0.4); transform: translateY(-1px); }
#pay-btn:not(:disabled):active { transform: translateY(0); }
#pay-btn.loading .btn-text { opacity: 0.7; }
#pay-btn.loading .btn-spinner { display: block !important; }`,
      readOnly: true,
    },
  },
};
