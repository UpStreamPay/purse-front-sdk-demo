import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DemoElement } from './base';

export type Option = {
  id: string;
  title: string;
  secondary?: string;
  // Optional muted sub-lines shown under the title (e.g. holder, partner, dates).
  meta?: string[];
};

const ROW_BASE = 'flex items-start justify-between gap-3 w-full px-3.5 py-3 bg-bg border border-border rounded-lg text-left cursor-pointer transition-all hover:border-accent';
const ROW_ACTIVE = 'flex items-start justify-between gap-3 w-full px-3.5 py-3 bg-accent/10 border border-accent rounded-lg text-left cursor-pointer transition-all';

/**
 * <demo-option-list> — a single-select list of rows (a primary title on the
 * left, optional secondary text on the right). Used for the saved-card token
 * list and the headless payment-method list.
 *
 *   const list = document.querySelector('demo-option-list');
 *   list.addEventListener('option-select', e => pick(e.detail.id));
 *   list.options = [{ id, title, secondary }];   // set from script
 *
 * `mono` renders titles in a monospace font; `uppercase-secondary` upper-cases
 * the secondary text; `empty-text` shows when there are no options.
 */
@customElement('demo-option-list')
export class DemoOptionList extends DemoElement {
  @property({ attribute: false }) options: Option[] = [];
  @property({ attribute: 'empty-text' }) emptyText = '';
  @property({ type: Boolean }) mono = false;
  @property({ type: Boolean, attribute: 'uppercase-secondary' }) uppercaseSecondary = false;
  @state() private selectedId: string | null = null;

  // Programmatic selection (e.g. auto-select the first item) without a click.
  select(id: string) {
    this.selectedId = id;
    this.dispatchEvent(new CustomEvent('option-select', { detail: { id }, bubbles: true }));
  }

  render() {
    if (this.options.length === 0) {
      return this.emptyText
        ? html`<div class="text-xs text-muted">${this.emptyText}</div>`
        : nothing;
    }
    return html`
      <div class="flex flex-col gap-2">
        ${this.options.map(opt => html`
          <button class="${opt.id === this.selectedId ? ROW_ACTIVE : ROW_BASE}" @click=${() => this.select(opt.id)}>
            <span class="flex flex-col gap-0.5 min-w-0">
              <span class="text-sm ${this.mono ? 'font-mono' : 'font-medium'}">${opt.title}</span>
              ${(opt.meta ?? []).map(line => html`<span class="text-xs text-muted">${line}</span>`)}
            </span>
            ${opt.secondary
              ? html`<span class="text-xs text-muted shrink-0 ${this.uppercaseSecondary ? 'uppercase' : ''}">${opt.secondary}</span>`
              : nothing}
          </button>
        `)}
      </div>
    `;
  }
}
