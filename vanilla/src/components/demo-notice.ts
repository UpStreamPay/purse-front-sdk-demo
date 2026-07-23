import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DemoElement } from './base';

/**
 * <demo-notice> — the yellow setup/warning banner. Hidden until `show()`.
 *
 *   document.querySelector('demo-notice').show('Set your API key');
 *
 * Drive it from script via the shared `showNotice(msg)` helper (shared/ui.ts).
 */
@customElement('demo-notice')
export class DemoNotice extends DemoElement {
  @state() private message = '';

  show(message: string) {
    this.message = message;
  }

  hide() {
    this.message = '';
  }

  render() {
    if (!this.message) return nothing;
    return html`
      <div class="flex gap-3 px-4 py-3.5 bg-yellow-50 border border-yellow-300 rounded-lg text-sm text-yellow-900 mb-6">
        <span>⚠</span><span>${this.message}</span>
      </div>
    `;
  }
}
