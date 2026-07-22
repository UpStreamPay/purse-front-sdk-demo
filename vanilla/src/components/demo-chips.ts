import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DemoElement } from './base';

export type Chip = { label: string; highlight?: boolean };

/**
 * <demo-chips> — a read-only row of pill "chips". Used to display the eligible
 * payment solutions in the advanced-flow demo. Set `chips` from script:
 *
 *   document.querySelector('demo-chips').chips = [{ label: 'creditcard · x', highlight: true }];
 */
@customElement('demo-chips')
export class DemoChips extends DemoElement {
  @property({ attribute: false }) chips: Chip[] = [];
  @property({ attribute: 'empty-text' }) emptyText = '';

  render() {
    if (this.chips.length === 0) {
      return this.emptyText
        ? html`<div class="text-xs text-muted">${this.emptyText}</div>`
        : nothing;
    }
    return html`
      <div class="flex flex-wrap gap-2">
        ${this.chips.map(chip => html`
          <span class="${chip.highlight
            ? 'px-2.5 py-1 bg-accent text-white rounded-full text-xs font-medium'
            : 'px-2.5 py-1 bg-bg border border-border rounded-full text-xs text-muted'}">${chip.label}</span>
        `)}
      </div>
    `;
  }
}
