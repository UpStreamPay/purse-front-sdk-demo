import { loadSecureFields, type Securefields } from '@purse-eu/web-sdk';
import { getEnv, getEnvironment } from '../shared/env';
import { $, setStep, showNotice, showResult } from '../shared/ui';
import '../shared/debug-panel';

// Secure Fields tokenises card data at tenant level — no payment session needed.
// Configure via VITE_PURSE_TENANT_ID and VITE_PURSE_API_KEY in .env.local or the debug panel.

const payBtn = $('pay-btn') as HTMLButtonElement;

const BRAND_PILL_BASE = 'px-2.5 py-0.5 bg-bg border border-border rounded-full text-xs cursor-pointer transition-all';
const BRAND_PILL_SELECTED = 'px-2.5 py-0.5 bg-accent text-white border-accent rounded-full text-xs cursor-pointer transition-all';

let selectedBrand: Securefields.Brand | null = null;

async function main() {
  const tenantId = getEnv('VITE_PURSE_TENANT_ID');
  const apiKey   = getEnv('VITE_PURSE_API_KEY');

  if (!tenantId || !apiKey) {
    showNotice('Set VITE_PURSE_TENANT_ID and VITE_PURSE_API_KEY in .env.local or the debug panel');
    return;
  }

  setStep('step-sdk', 'active');

  // Step 1 — Load Secure Fields SDK from CDN
  const { initSecureFields } = await loadSecureFields(
    getEnvironment(),
  );
  setStep('step-sdk', 'done');
  setStep('step-init', 'active');

  // Step 2 — Initialise Secure Fields
  // Each `target` id must match a DOM element in the page.
  // Only `cvv` is strictly required; the others can be omitted for CVV-only flows.
  const sf = await initSecureFields({
    tenantId,
    apiKey,
    config: {
      brands: ['CARTE_BANCAIRE', 'VISA', 'MASTERCARD', 'AMERICAN_EXPRESS', 'MAESTRO'],
      // brandSelector: true renders the brand selector inside the card number iframe.
      // Set to false to handle brand selection yourself (see brandDetected event below).
      brandSelector: false,
      fields: {
        cardNumber: { target: 'sf-pan',  placeholder: '1234 5678 9012 3456' },
        holderName: { target: 'sf-name', placeholder: 'Card Holder Name' },
        expDate:    { target: 'sf-exp',  placeholder: 'MM/YY' },
        cvv:        { target: 'sf-cvv',  placeholder: '123' },
      },
      styles: {
        input: {
          placeholderColor: '#9ca3af',
          // fontSize: '15px',
          // color: '#1a1d2e',
        },
      },
    },
  });

  // Step 3 — Listen for SDK events, then render the iframes
  sf.on('ready', () => {
    setStep('step-init', 'done');
    setStep('step-render', 'done');
    setStep('step-submit', 'active');
    payBtn.disabled = false;
  });

  // brandDetected fires when enough digits are typed to identify the card scheme.
  // For co-branded cards (e.g. CB/Visa), brands will contain more than one entry.
  sf.on('brandDetected', ({ brands }) => {
    if (!brands || brands.length === 0) {
      ($('brand-indicator') as HTMLElement).style.display = 'none';
      selectedBrand = null;
      return;
    }

    ($('brand-indicator') as HTMLElement).style.display = 'flex';
    const pills = $('brand-pills');
    pills.innerHTML = '';

    brands.forEach(brand => {
      const pill = document.createElement('button');
      pill.className = BRAND_PILL_BASE;
      pill.textContent = brand;
      pill.addEventListener('click', () => {
        selectedBrand = brand;
        pills.querySelectorAll('button').forEach(p => {
          p.className = BRAND_PILL_BASE;
        });
        pill.className = BRAND_PILL_SELECTED;
      });
      pills.appendChild(pill);
    });

    // Auto-select single brands
    if (brands.length === 1) {
      selectedBrand = brands[0];
      const firstPill = pills.querySelector('button');
      if (firstPill) {
        firstPill.className = BRAND_PILL_SELECTED;
      }
    }
  });

  // Render the field iframes into their target elements
  sf.render();

  // Step 4 — Submit: tokenise and receive the vault_form_token
  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    payBtn.textContent = 'Tokenising…';
    payBtn.classList.add('loading');

    const result = await sf.submit({
      // For co-branded cards, pass the user-selected network.
      // Required when multiple brands are detected.
      ...(selectedBrand ? { selectedNetwork: selectedBrand } : {}),
    });

    payBtn.classList.remove('loading');

    if ('error' in result && result.error) {
      setStep('step-submit', 'error');
      showResult('error', result);
      payBtn.disabled = false;
      payBtn.textContent = 'Retry';
      return;
    }

    setStep('step-submit', 'done');
    // The vault_form_token is a short-lived token representing the card data.
    // Pass it to your backend to complete the payment authorisation.
    showResult('success', result, 'Vault token received');
  });
}

main();
