import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DemoElement } from './base';

const PILL_BASE = 'px-2.5 py-0.5 bg-bg border border-border rounded-full text-xs cursor-pointer transition-all';
const PILL_SELECTED = 'px-2.5 py-0.5 bg-accent text-white border-accent rounded-full text-xs cursor-pointer transition-all';

/**
 * <demo-brand-pills> — the co-branded-card scheme selector. Shared by the
 * Secure Fields tokenize demo and the hosted-fields demo (both detect brands
 * and let the shopper pick the network).
 *
 * Set `brands` from script (a plain property, not an attribute) and listen for
 * the selection:
 *
 *   const pills = document.querySelector('demo-brand-pills');
 *   pills.addEventListener('brand-select', e => useBrand(e.detail.brand));
 *   pills.brands = ['CB', 'VISA'];   // hidden when empty; auto-selects a lone brand
 */
@customElement('demo-brand-pills')
export class DemoBrandPills extends DemoElement {
  @property({ attribute: false }) brands: string[] = [];
  @state() private selected: string | null = null;

  updated(changed: Map<string, unknown>) {
    if (changed.has('brands')) {
      this.selected = null;
      // A single detected brand needs no choice — select it automatically.
      if (this.brands.length === 1) this.select(this.brands[0]);
    }
  }

  private select(brand: string) {
    this.selected = brand;
    this.dispatchEvent(new CustomEvent('brand-select', { detail: { brand }, bubbles: true }));
  }

  render() {
    if (this.brands.length === 0) return nothing;
    return html`
      <div class="flex items-center gap-2 text-xs text-muted mt-2.5">
        <span>Detected:</span>
        <div class="flex gap-1.5 flex-wrap">
          ${this.brands.map(
            b => html`<button class="${b === this.selected ? PILL_SELECTED : PILL_BASE}" @click=${() => this.select(b)}>${b}</button>`,
          )}
        </div>
      </div>
    `;
  }
}
