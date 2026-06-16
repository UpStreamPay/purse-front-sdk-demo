// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  const paymentConfig = {
    fields: {
      cardNumber: { target: 'pan-field',    placeholder: '1234 5678 9012 3456' },
      expDate:    { target: 'expiry-field', placeholder: 'MM / YY' },
      cvv:        { target: 'cvv-field',    placeholder: '123' },
    },
    theme: { global: { fontSize: '16px', fontFamily: 'sans-serif', height: '45px', width: '100%' } },
  };

  // createHeadlessCheckout resolves after session ready — paymentMethods.value populated sync
  const creditCard = checkout.paymentMethods.value.find(m => !m.disabled?.value && m.method === 'creditcard');
  if (creditCard) {
    const hostedFields = creditCard.getHostedFields(paymentConfig);
    hostedFields.render();

    // Render brand chips once supported brands are loaded
    hostedFields.supportedBrands.subscribe((brands) => {
      console.log('[brand-detection] supportedBrands:', brands);
      const picker = document.getElementById('brand-picker');
      picker.innerHTML = '';

      if (!brands.length) {
        picker.innerHTML = '<span class="no-brands">No co-branded card detected for this session.</span>';
        return;
      }

      brands.forEach((brand) => {
        const chip = document.createElement('button');
        chip.className = 'brand-chip';
        chip.textContent = brand;
        chip.dataset.brand = brand;
        chip.addEventListener('click', () => {
          if (chip.dataset.blocked === 'true') return;
          hostedFields.setSelectedBrand(brand);
        });
        picker.appendChild(chip);
      });
    });

    // Highlight brands that match the typed PAN
    hostedFields.detectedBrands.subscribe((detected) => {
      console.log('[brand-detection] detectedBrands:', detected);
      const hasDetection = detected.length > 0;
      document.querySelectorAll<HTMLElement>('.brand-chip').forEach((chip) => {
        const isDetected = detected.includes(chip.dataset.brand);
        chip.classList.toggle('detected', isDetected);
        const blocked = hasDetection && !isDetected;
        chip.dataset.blocked = String(blocked);
        chip.classList.toggle('blocked', blocked);
      });
    });

    // Mark the currently selected brand
    hostedFields.selectedBrand.subscribe((selected) => {
      console.log('[brand-detection] selectedBrand:', selected);
      document.querySelectorAll('.brand-chip').forEach((chip) => {
        chip.classList.toggle('selected', chip.dataset.brand === selected);
      });
    });
  }

  const payBtn = document.getElementById('pay-btn') as HTMLButtonElement;
  checkout.isPaymentFulfilled.subscribe((isReady) => { payBtn.disabled = !isReady; });

  const resultEl = document.getElementById('result');
  payBtn.addEventListener('click', async () => {
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    resultEl.className = 'hidden';
    const BASE = 'result-banner';
    try {
      await checkout.submitPayment();
      resultEl.className = `${BASE} success`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg> Payment submitted successfully!`;
    } catch (err) {
      resultEl.className = `${BASE} error`;
      resultEl.innerHTML = `<svg class="icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg> ${err.message}`;
      payBtn.classList.remove('loading');
      payBtn.disabled = false;
    }
  });
}

init();
