import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DemoElement } from './base';

/**
 * <demo-button> — the full-width primary action button.
 *
 *   <demo-button label="Pay" disabled></demo-button>
 *
 * Drive it from script via reflected properties, and listen for clicks on the
 * element itself (the inner <button>'s click bubbles up):
 *
 *   const btn = document.querySelector('demo-button');
 *   btn.addEventListener('click', () => { ... });
 *   btn.disabled = true; btn.loading = true; btn.label = 'Processing…';
 */
@customElement('demo-button')
export class DemoButton extends DemoElement {
  @property() label = 'Submit';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;

  render() {
    return html`
      <button
        class="flex items-center justify-center gap-2 w-full py-3.5 bg-accent text-white border-0 rounded-lg text-base font-semibold cursor-pointer transition-all mt-4 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed ${this.loading ? 'loading' : ''}"
        ?disabled=${this.disabled}
      >${this.label}</button>
    `;
  }
}
