import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DemoElement } from './base';

type ResultKind = 'success' | 'error';

/**
 * <demo-result> — the success/error result panel with a JSON dump. Empty until
 * `show()`. Drive it from script via the shared `showResult()` helper.
 */
@customElement('demo-result')
export class DemoResult extends DemoElement {
  @state() private kind: ResultKind | null = null;
  @state() private label = '';
  @state() private data: unknown = null;

  show(kind: ResultKind, data: unknown, label = 'Payment submitted') {
    this.kind = kind;
    this.data = data;
    this.label = label;
  }

  render() {
    if (!this.kind) return nothing;
    const colorClasses =
      this.kind === 'success'
        ? 'bg-success-bg border border-emerald-200 text-success'
        : 'bg-error-bg border border-red-300 text-error';
    return html`
      <div class="p-4 rounded-lg mt-4 text-sm ${colorClasses}">
        <div class="font-bold mb-1">${this.kind === 'success' ? this.label : 'Error'}</div>
        <pre class="font-mono text-xs break-all whitespace-pre-wrap mt-2 opacity-80">${JSON.stringify(this.data, null, 2)}</pre>
      </div>
    `;
  }
}
