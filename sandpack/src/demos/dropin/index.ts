import type { DemoConfig } from '../types';

export const dropinDemo: DemoConfig = {
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
    <title>Drop-in Checkout</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div id="dropin-container"></div>
    <p id="status"></p>
    <script type="module" src="./index.ts"></script>
  </body>
</html>`,
      readOnly: true,
    },
    '/index.ts': {
      code: `import { loadDropInCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';

export async function init() {
  const Purse = await loadDropInCheckout('sandbox');

  const dropin = await Purse.createDropinCheckout({
    session: clientSession.widget.data,
    locale: 'en-US',
    hidePayButton: true, // we render our own pay button below
  });

  // Mount the pre-built checkout UI
  await dropin.mount(document.getElementById('dropin-container')!);
}

init();`,
      readOnly: false,
      active: true,
    },
    '/styles.css': {
      code: `body { font-family: sans-serif; max-width: 480px; margin: 32px auto; padding: 0 16px; }
h1 { font-size: 20px; margin-bottom: 24px; }
#pay-btn {
  margin-top: 16px; width: 100%; padding: 12px;
  background: #4f46e5; color: white; border: none; border-radius: 6px;
  font-size: 16px; cursor: pointer;
}
#pay-btn:disabled { background: #a5b4fc; cursor: not-allowed; }
#status { margin-top: 12px; font-size: 14px; color: #6b7280; }`,
      readOnly: true,
    },
  },
};
