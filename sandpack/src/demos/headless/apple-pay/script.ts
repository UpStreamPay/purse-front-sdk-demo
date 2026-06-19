// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  // xPayButton config — edit these values to customise the button
  const xPayButtonConfig = {
    apple: {
      type: 'buy',             // 'plain' | 'buy' | 'donate' | 'check-out' | 'book' | 'subscribe' | …
      buttonstyle: 'black',    // 'black' | 'white' | 'white-outline'
      borderRadius: '8px',
      width: '100%',
      height: '48px',
    },
  };

  // createHeadlessCheckout resolves only after session is ready — paymentMethods.value is already populated
  const applePay = checkout.paymentMethods.value.find(m => m.method === 'applepay');

  if (!applePay) {
    document.getElementById('not-available').classList.remove('hidden');
    document.getElementById('btn-container').classList.add('hidden');
    return;
  }

  document.getElementById('not-available').classList.add('hidden');
  const icon = document.getElementById('method-icon') as HTMLImageElement;
  icon.src = applePay.iconUrl;
  icon.style.display = 'block';

  checkout.getPaymentElement({ method: 'applepay', xPayButton: xPayButtonConfig })
    .appendTo(document.getElementById('btn-container'));
}

init();
