import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DemoElement } from './base';
import { t, type MessageKey } from '../i18n';

// Canonical render order; `fields` selects which of these to show.
const FIELD_DEFS: Record<string, { label: MessageKey; target: string; cls: string }> = {
  pan:  { label: 'common.cardNumber', target: 'sf-pan',  cls: 'hf-field hf-field--full hf-field--pan' },
  exp:  { label: 'common.expiry',     target: 'sf-exp',  cls: 'hf-field' },
  cvv:  { label: 'common.cvv',        target: 'sf-cvv',  cls: 'hf-field hf-field--exp' },
  name: { label: 'common.holderName', target: 'sf-name', cls: 'hf-field hf-field--name' },
};
const ORDER = ['pan', 'exp', 'cvv', 'name'];

/**
 * <sf-card-form> — the Secure Fields card grid. Each field is an empty target
 * the SDK injects an iframe into (looked up by id: sf-pan / sf-exp / sf-cvv /
 * sf-name), so this component renders ONCE from its static attributes and is
 * never re-rendered (that would wipe the injected iframes).
 *
 *   <sf-card-form fields="pan exp cvv name" brand></sf-card-form>   (full form)
 *   <sf-card-form fields="cvv"></sf-card-form>                      (CVV-only)
 *
 * `brand` adds the <demo-brand-pills> scheme selector, driven by
 * shared/secure-fields.ts.
 */
@customElement('sf-card-form')
export class SfCardForm extends DemoElement {
  @property() fields = 'pan exp cvv name';
  @property({ type: Boolean }) brand = false;

  render() {
    const selected = new Set(this.fields.split(/\s+/).filter(Boolean));
    const shown = ORDER.filter(k => selected.has(k));
    return html`
      <div class="bg-white border border-border rounded-xl p-5 mb-4">
        <div class="text-sm font-semibold text-muted uppercase tracking-wider mb-3.5">${t('common.cardDetails')}</div>
        <div class="hf-layout-grid">
          ${shown.map(k => {
            const f = FIELD_DEFS[k];
            return html`
              <div class="${f.cls}">
                <label class="hf-label">${t(f.label)}</label>
                <div class="hf-field-wrap" id="${f.target}"></div>
              </div>
            `;
          })}
        </div>
        ${this.brand ? html`<demo-brand-pills></demo-brand-pills>` : nothing}
      </div>
    `;
  }
}
