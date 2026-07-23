import type { DemoStepper, StepState } from '../components/demo-stepper';
import type { DemoNotice } from '../components/demo-notice';
import type { DemoResult } from '../components/demo-result';

export const $ = (id: string) => document.getElementById(id)!;

// Thin imperative façade over the <demo-*> rendering components, so demo
// scripts stay declarative: setStep('step-pay', 'done') etc.

export function setStep(id: string, state: StepState) {
  document.querySelector<DemoStepper>('demo-stepper')?.setStep(id, state);
}

export function showNotice(msg: string) {
  document.querySelector<DemoNotice>('demo-notice')?.show(msg);
}

export function showResult(type: 'success' | 'error', data: unknown, successLabel = 'Payment submitted') {
  document.querySelector<DemoResult>('demo-result')?.show(type, data, successLabel);
}
