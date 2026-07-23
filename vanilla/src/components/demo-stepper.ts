import { html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DemoElement } from './base';

export type StepState = 'pending' | 'active' | 'done' | 'error';

type Step = { id: string; label: string };

/**
 * <demo-stepper> — the horizontal progress bar shown on every demo.
 *
 *   <demo-stepper steps="step-sdk:Load SDK, step-init:Init, step-pay:Pay"></demo-stepper>
 *
 * `steps` is a comma-separated list of `id:label` pairs. Drive it from script
 * via the shared `setStep(id, state)` helper (shared/ui.ts) or directly:
 *
 *   document.querySelector('demo-stepper').setStep('step-pay', 'done');
 */
@customElement('demo-stepper')
export class DemoStepper extends DemoElement {
  @property() steps = '';
  @state() private states: Record<string, StepState> = {};

  private get parsed(): Step[] {
    return this.steps
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(pair => {
        const idx = pair.indexOf(':');
        return { id: pair.slice(0, idx).trim(), label: pair.slice(idx + 1).trim() };
      });
  }

  setStep(id: string, state: StepState) {
    this.states = { ...this.states, [id]: state };
  }

  private icon(state: StepState, n: number) {
    if (state === 'done') return '✓';
    if (state === 'error') return '✗';
    return String(n);
  }

  private iconBg(state: StepState) {
    if (state === 'done') return 'bg-success';
    if (state === 'error') return 'bg-error';
    if (state === 'active') return 'bg-accent';
    return 'bg-step-pending';
  }

  render() {
    const steps = this.parsed;
    return html`
      <div class="flex mb-7 bg-white border border-border rounded-xl overflow-hidden sm:flex-row flex-col">
        ${steps.map((step, i) => {
          const st = this.states[step.id] ?? 'pending';
          const last = i === steps.length - 1;
          return html`
            <div class="flex-1 px-3.5 py-3 text-xs text-muted border-r border-border flex items-center gap-2 ${last ? '' : 'sm:border-b-0 border-b'}" data-state=${st}>
              <div class="w-5 h-5 rounded-full ${this.iconBg(st)} flex items-center justify-center shrink-0 text-xs text-white transition-colors duration-200">${this.icon(st, i + 1)}</div>
              <span class="text-xs">${step.label}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}
