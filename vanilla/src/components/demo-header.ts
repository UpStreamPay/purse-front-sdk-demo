import { html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { DemoElement } from './base';

// Badge colour per demo category. Full class strings so Tailwind keeps them.
const VARIANTS: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  violet: 'bg-violet-100 text-violet-800',
  pink: 'bg-pink-100 text-pink-800',
  amber: 'bg-amber-100 text-amber-800',
  sky: 'bg-sky-100 text-sky-800',
};

const SOURCE_BASE =
  'https://github.com/UpStreamPay/purse-front-sdk-demo/blob/main/vanilla/src/';

/**
 * <demo-header> — the page header shared by every demo: back link, "View
 * source" link, category badge and title.
 *
 *   <demo-header badge="Headless" variant="violet"
 *                heading="Headless Checkout — Quick Start"
 *                source="headless-checkout/render-methods.ts"></demo-header>
 *
 * `source` is the path under vanilla/src/ (the full GitHub URL is derived).
 * `description` may contain inline markup (e.g. <code>…</code>).
 */
@customElement('demo-header')
export class DemoHeader extends DemoElement {
  @property() badge = '';
  @property() variant = 'blue';
  @property() heading = '';
  @property() source = '';
  @property() description = '';

  render() {
    const badgeClass = VARIANTS[this.variant] ?? VARIANTS.blue;
    return html`
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <a href="../" class="inline-flex items-center gap-1.5 text-muted no-underline text-sm hover:text-text">← All examples</a>
          ${this.source
            ? html`<a href="${SOURCE_BASE}${this.source}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-muted no-underline text-xs hover:text-text border border-border rounded-md px-2 py-1">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                View source
              </a>`
            : nothing}
        </div>
        <div>
          <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${badgeClass}">${this.badge}</span>
          <h1 class="text-2xl font-bold mt-2 mb-1.5">${this.heading}</h1>
          <p class="text-muted text-sm">${unsafeHTML(this.description)}</p>
        </div>
      </div>
    `;
  }
}
