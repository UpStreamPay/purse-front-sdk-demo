import type { DemoStepper, StepState } from '../components/demo-stepper';
import type { DemoNotice } from '../components/demo-notice';
import type { DemoResult } from '../components/demo-result';
import { consumeRedirectionReturn } from './redirection';
import { t } from '../i18n';

export const $ = (id: string) => document.getElementById(id)!;

// Thin imperative façade over the <demo-*> rendering components, so demo
// scripts stay declarative: setStep('step-pay', 'done') etc.

export function setStep(id: string, state: StepState) {
  document.querySelector<DemoStepper>('demo-stepper')?.setStep(id, state);
}

export function showNotice(msg: string) {
  document.querySelector<DemoNotice>('demo-notice')?.show(msg);
}

export function showResult(type: 'success' | 'error', data: unknown, successLabel = t('result.submitted')) {
  document.querySelector<DemoResult>('demo-result')?.show(type, data, successLabel);
}

/** Authorization statuses that mean the payment did not go through. */
export function isFailedAuthorization(status = ''): boolean {
  return /REFUSED|FAILED|CANCEL|ERROR/i.test(status);
}

/**
 * Session demos are their own `shopper_redirection_url`: on the way back from
 * `submitPayment()`, show the outcome instead of booting a new checkout.
 * Returns true when the page was loaded from a redirection — the caller stops.
 */
export function showRedirectionReturn(): boolean {
  const claims = consumeRedirectionReturn();
  if (!claims) {
    return false;
  }
  const status = claims.authorization_status ?? 'UNKNOWN';
  showResult(
    isFailedAuthorization(status) ? 'error' : 'success',
    claims,
    t('result.returned', { status }),
  );
  return true;
}
