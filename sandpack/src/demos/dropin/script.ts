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
  await dropin.mount(document.getElementById('dropin-container')!);
}

init();
