import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DemoElement } from './base';

export type Chip = {
  label: string;
  highlight?: boolean;
  // Identifies the chip in `chip-select`. Required for a selectable chip.
  id?: string;
  // A chip that is displayed for information but cannot be picked (in the
  // advanced flow: a solution the card form cannot drive).
  disabled?: boolean;
};

/**
 * <demo-chips> — a row of pill "chips". Used to display the eligible payment
 * solutions in the advanced-flow demo. Set `chips` from script:
 *
 *   document.querySelector('demo-chips').chips = [{ label: 'creditcard · x', highlight: true }];
 *
 * Read-only by default. With `selectable`, the chips that carry an `id` and are
 * not `disabled` become buttons: clicking one selects it and fires
 * `chip-select` with `{ id }`. `highlight` then follows the selection rather
 * than the caller.
 */
@customElement('demo-chips')
export class DemoChips extends DemoElement {
  @property({ attribute: false }) chips: Chip[] = [];
  @property({ attribute: 'empty-text' }) emptyText = '';
  @property({ type: Boolean }) selectable = false;
  @property({ attribute: false }) selectedId: string | null = null;

  // Select a chip from script (used to pre-select a default) — same event as a
  // click, so callers have a single code path.
  select(id: string) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.dispatchEvent(
      new CustomEvent('chip-select', { detail: { id }, bubbles: true, composed: true }),
    );
  }

  private chipClass(chip: Chip, selected: boolean) {
    const base = 'px-2.5 py-1 rounded-full text-xs';
    if (selected) return `${base} bg-accent text-white font-medium`;
    if (chip.disabled) return `${base} bg-bg border border-border text-muted opacity-60`;
    return `${base} bg-bg border border-border text-muted`;
  }

  render() {
    if (this.chips.length === 0) {
      return this.emptyText
        ? html`<div class="text-xs text-muted">${this.emptyText}</div>`
        : nothing;
    }
    return html`
      <div class="flex flex-wrap gap-2">
        ${this.chips.map(chip => {
          const pickable = this.selectable && !!chip.id && !chip.disabled;
          const selected = this.selectable
            ? !!chip.id && chip.id === this.selectedId
            : !!chip.highlight;
          const cls = this.chipClass(chip, selected);

          if (!pickable) {
            return html`<span class="${cls}">${chip.label}</span>`;
          }
          return html`
            <button
              type="button"
              class="${cls} cursor-pointer font-[inherit] ${selected ? '' : 'hover:border-accent hover:text-accent'}"
              aria-pressed=${selected}
              @click=${() => this.select(chip.id!)}
            >${chip.label}</button>
          `;
        })}
      </div>
    `;
  }
}
