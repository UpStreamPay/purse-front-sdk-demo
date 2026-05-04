import type { DemoConfig } from './types';

export const headlessDemo: DemoConfig = {
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
    <title>Headless Checkout</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body class="bg-gray-100 min-h-screen flex items-start justify-center py-10 px-4 font-sans text-gray-900">

    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

      <div class="flex items-center gap-3 px-7 py-6 border-b border-gray-100">
        <svg class="w-8 h-8 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="6" fill="#4f46e5"/>
          <path d="M6 12h12M12 6l6 6-6 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h1 class="text-lg font-semibold tracking-tight">Secure Checkout</h1>
      </div>

      <!-- Step 1: payment method -->
      <section id="step-methods" class="px-7 pt-6">
        <div class="flex items-center gap-2.5 mb-4">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold shrink-0">1</span>
          <span class="text-xs font-semibold uppercase tracking-widest text-gray-500">Choose payment method</span>
        </div>
        <div id="method-list"></div>
      </section>

      <!-- Step 2: payment details (revealed after selection) -->
      <section id="step-fields" class="step-hidden px-7">
        <div class="flex items-center gap-2.5 mt-5 mb-4">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold shrink-0">2</span>
          <span class="text-xs font-semibold uppercase tracking-widest text-gray-500">Enter payment details</span>
        </div>
        <div id="form" class="min-h-10 pb-6"></div>
      </section>

      <div class="px-7 pb-6 border-t border-gray-100 mt-5 pt-5">
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

  const methodListEl = document.getElementById('method-list')!;
  const stepFields   = document.getElementById('step-fields')!;
  const formEl       = document.getElementById('form')!;
  const payBtn       = document.getElementById('pay-btn') as HTMLButtonElement;
  const resultEl     = document.getElementById('result')!;

  let activeElement: any = null;

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
      global: {
        fontSize: '16px',
        fontFamily: 'sans-serif',
      },
    },
  };

  // 4 – Render available payment methods
  checkout.paymentMethods.subscribe((methods: any[]) => {
    methodListEl.innerHTML = '';
    methods.forEach(method => {
      const btn = document.createElement('button');
      btn.className = 'method-btn flex items-center w-full border-[1.5px] border-gray-200 rounded-xl px-4 py-3.5 mb-2 text-sm font-medium text-gray-700 bg-white gap-3 cursor-pointer';

      const dot = document.createElement('span');
      dot.className = 'radio-dot w-4 h-4 rounded-full shrink-0';

      const label = document.createElement('span');
      label.textContent = method.label ?? method.method;

      btn.appendChild(dot);
      btn.appendChild(label);
      btn.addEventListener('click', () => selectMethod(method, btn));
      methodListEl.appendChild(btn);
    });
  });

  // 5 – On selection: render the payment element into the form container
  function selectMethod(method: any, btn: HTMLElement) {
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
      formEl.innerHTML = \`<p class="unavailable">This payment method is currently unavailable.</p>\`;
      return;
    }

    activeElement = method.getPaymentElement(paymentConfig);
    activeElement.appendTo(formEl);
  }

  // 6 – Enable the pay button once the form is complete
  checkout.isPaymentFulfilled.subscribe((isReady: boolean) => {
    payBtn.disabled = !isReady;
  });

  // 7 – Submit and display the result
  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    resultEl.textContent = '';
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
      code: `/* Step 2 animated reveal — max-height transition can't be done with Tailwind utilities alone */
#step-fields { overflow: hidden; transition: max-height 0.35s ease, opacity 0.3s ease; max-height: 600px; opacity: 1; }
#step-fields.step-hidden { max-height: 0; opacity: 0; }

/* Radio dot base style — kept in CSS to avoid Tailwind cascade conflicts */
.radio-dot { border: 1.5px solid #d1d5db; transition: border-color 0.15s, background 0.15s; }

/* Method button hover & active */
.method-btn { transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; }
.method-btn:hover { border-color: #a5b4fc; box-shadow: 0 0 0 3px #eef2ff; }
.method-btn.active { border-color: #4f46e5 !important; background: #fafafe; color: #1e1b4b; font-weight: 600; }

/* Pay button interactive states */
#pay-btn:not(:disabled) { transition: background 0.15s, transform 0.1s, box-shadow 0.15s; cursor: pointer; }
#pay-btn:not(:disabled):hover { background: #4338ca; box-shadow: 0 4px 12px rgb(79 70 229 / 0.4); transform: translateY(-1px); }
#pay-btn:not(:disabled):active { transform: translateY(0); }
#pay-btn.loading .btn-text { opacity: 0.7; }
#pay-btn.loading .btn-spinner { display: block !important; }

/* Unavailable method */
.unavailable { font-size: 13px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; }`,
      readOnly: true,
    },
  },
};
