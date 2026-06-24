// @ts-nocheck
import { loadDropInCheckout } from '@purse-eu/web-sdk';
import clientSession from './session.json';
import './styles.css';

export async function init() {
  const Purse = await loadDropInCheckout('sandbox');

  const dropin = await Purse.createDropinCheckout({
    session: clientSession.widget.data,
    locale: 'en-US',
    hidePayButton: true, // we render our own pay button below
  });

  // Mount the pre-built checkout UI
  const container = document.getElementById('dropin-container')!;
  container.innerHTML = '';
  await dropin.mount(container);
}

init();
