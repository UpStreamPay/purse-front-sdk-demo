import type { DemoConfig } from './types';

export const headlessDemo: DemoConfig = {
  template: 'vanilla-ts',
  customSetup: {
    dependencies: {
      '@purse-eu/web-sdk': 'latest',
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
  <body>
    <h1>Checkout</h1>

    <!-- Step 1: payment method list -->
    <section id="step-methods">
      <p class="label">Select a payment method</p>
      <div id="method-list"></div>
    </section>

    <!-- Step 2: payment element (revealed after selection) -->
    <section id="step-fields" hidden>
      <div id="form"></div>
    </section>

    <button id="pay-btn" disabled>Pay</button>
    <p id="result"></p>

    <script type="module" src="./index.ts"></script>
  </body>
</html>`,
      readOnly: false,
    },
    '/index.ts': {
      code: `import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';

(async () => {
  // 1 – Load the SDK
  const Purse = await loadHeadlessCheckout('sandbox');

  // 2 – Initialise the checkout
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const methodListEl = document.getElementById('method-list')!;
  const stepFields   = document.getElementById('step-fields') as HTMLElement;
  const formEl       = document.getElementById('form')!;
  const payBtn       = document.getElementById('pay-btn') as HTMLButtonElement;
  const resultEl     = document.getElementById('result')!;

  let activeElement: any = null;

  const paymentConfig = {
    hostedForm: {
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
      btn.className = 'method-btn';
      btn.textContent = method.label ?? method.method;
      btn.addEventListener('click', () => selectMethod(method, btn));
      methodListEl.appendChild(btn);
    });
  });

  // 5 – On selection: render the payment element into the form container
  function selectMethod(method: any, btn: HTMLElement) {
    methodListEl.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    activeElement?.remove();
    formEl.innerHTML = '';
    stepFields.hidden = false;

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
    resultEl.textContent = 'Processing…';
    try {
      await checkout.submitPayment();
      resultEl.textContent = 'Payment submitted!';
    } catch (err) {
      resultEl.textContent = \`Error: \${(err as Error).message}\`;
    }
  });
})();`,
      readOnly: false,
    },
    '/styles.css': {
      code: `body { font-family: sans-serif; max-width: 480px; margin: 32px auto; padding: 0 16px; }
h1 { font-size: 20px; margin-bottom: 24px; }
.label { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
.method-btn {
  display: block; width: 100%; text-align: left;
  background: white; border: 1px solid #d1d5db; border-radius: 8px;
  padding: 12px 16px; margin-bottom: 8px; font-size: 15px; cursor: pointer;
}
.method-btn:hover  { border-color: #818cf8; }
.method-btn.active { border-color: #4f46e5; background: #eef2ff; font-weight: 600; }
#step-fields { margin-top: 20px; }
#form { min-height: 40px; }
.unavailable { font-size: 14px; color: #ef4444; }
#pay-btn {
  width: 100%; padding: 12px; margin-top: 4px;
  background: #4f46e5; color: white; border: none; border-radius: 6px;
  font-size: 16px; cursor: pointer;
}
#pay-btn:disabled { background: #a5b4fc; cursor: not-allowed; }
#result { margin-top: 12px; font-size: 14px; color: #6b7280; }`,
      readOnly: true,
    },

  },
};
