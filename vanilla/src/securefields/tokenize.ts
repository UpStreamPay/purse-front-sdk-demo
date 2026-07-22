import '../components';
import { getEnv } from '../shared/env';
import { setStep, showNotice, showResult } from '../shared/ui';
import { bootSecureFields } from '../shared/secure-fields';
import type { DemoButton } from '../components/demo-button';
import '../shared/debug-panel';

// Secure Fields tokenises card data at tenant level — no payment session needed.
// Configure via VITE_PURSE_SECUREFIELDS_TENANT_ID and VITE_PURSE_API_KEY in
// .env.local or the debug panel.

const payBtn = document.querySelector<DemoButton>('demo-button')!;

async function main() {
  const tenantId = getEnv('VITE_PURSE_SECUREFIELDS_TENANT_ID');
  const apiKey = getEnv('VITE_PURSE_API_KEY');

  if (!tenantId || !apiKey) {
    showNotice('Set VITE_PURSE_SECUREFIELDS_TENANT_ID and VITE_PURSE_API_KEY in .env.local or the debug panel');
    return;
  }

  setStep('step-sdk', 'active');

  // Load the SDK, init the fields and wire brand detection. `brand: true` on
  // <sf-card-form> renders the indicator this fills in.
  const { sf, getSelectedBrand } = await bootSecureFields({
    tenantId,
    apiKey,
    // Only `cvv` is strictly required; the others can be omitted for CVV-only flows.
    fields: {
      cardNumber: { target: 'sf-pan',  placeholder: '1234 5678 9012 3456' },
      holderName: { target: 'sf-name', placeholder: 'Card Holder Name' },
      expDate:    { target: 'sf-exp',  placeholder: 'MM/YY' },
      cvv:        { target: 'sf-cvv',  placeholder: '123' },
    },
    brandSelect: true,
    onReady: () => {
      setStep('step-init', 'done');
      setStep('step-render', 'done');
      setStep('step-submit', 'active');
      payBtn.disabled = false;
    },
  });
  setStep('step-sdk', 'done');
  setStep('step-init', 'active');

  // Submit: tokenise and receive the vault_form_token.
  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    payBtn.label = 'Tokenising…';
    payBtn.loading = true;

    const selectedBrand = getSelectedBrand();
    const result = await sf.submit({
      // For co-branded cards, pass the user-selected network.
      ...(selectedBrand ? { selectedNetwork: selectedBrand } : {}),
    });

    payBtn.loading = false;

    if ('error' in result && result.error) {
      setStep('step-submit', 'error');
      showResult('error', result);
      payBtn.disabled = false;
      payBtn.label = 'Retry';
      return;
    }

    setStep('step-submit', 'done');
    // The vault_form_token is short-lived; pass it to your backend to complete
    // the payment authorisation.
    showResult('success', result, 'Vault token received');
  });
}

main();
