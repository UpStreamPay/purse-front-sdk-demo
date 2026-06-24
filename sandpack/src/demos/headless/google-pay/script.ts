// @ts-nocheck
import { loadHeadlessCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadHeadlessCheckout('sandbox');
  const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);

  // xPayButton config — edit these values to customise the button
  const xPayButtonConfig = {
    google: {
      buttonColor: 'default', // 'default' | 'black' | 'white'
      buttonType: 'buy',      // 'buy' | 'plain' | 'donate' | 'checkout' | 'book' | 'subscribe' | 'pay'
      buttonRadius: 4,        // 0–100
    },
  };

  // createHeadlessCheckout resolves only after session is ready — paymentMethods.value is already populated
  const googlePay = checkout.paymentMethods.value.find(m => m.method === 'googlepay');

  if (!googlePay) {
    document.getElementById('not-available').classList.remove('hidden');
    document.getElementById('btn-container').classList.add('hidden');
    return;
  }

  document.getElementById('not-available').classList.add('hidden');
  const icon = document.getElementById('method-icon') as HTMLImageElement;
  icon.src = googlePay.iconUrl;
  icon.style.display = 'block';

  const btnContainer = document.getElementById('btn-container');
  btnContainer.innerHTML = '';
  checkout.getPaymentElement({ method: 'googlepay', xPayButton: xPayButtonConfig })
    .appendTo(btnContainer);
}

init();
