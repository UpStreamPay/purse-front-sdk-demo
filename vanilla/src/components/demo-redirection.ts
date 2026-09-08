import { html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DemoElement } from './base';

/** Mirror of shared/redirection.ts `RedirectionPlan`, kept structural so this
 *  component stays presentational (no logic imports, like every demo-*). */
export type RedirectionPlanView = {
  kind: 'GET' | 'POST' | 'HTML_FORM';
  url?: string;
  params?: Record<string, string>;
  source: string;
};

const CHOICE_BASE = 'flex-1 px-3.5 py-3 bg-bg border border-border rounded-lg text-left cursor-pointer transition-all hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * <demo-redirection> — the "the payment is not done yet, send the shopper to the
 * partner" panel of the advanced flow. Hidden until `plan` is set.
 *
 *   const el = document.querySelector('demo-redirection');
 *   el.plan = extractRedirection(payment);        // shared/redirection.ts
 *   el.addEventListener('redirect-follow', e => run(e.detail.mode));  // 'top' | 'iframe'
 *
 * The component only describes the plan and offers the two ways to execute it.
 * The actual navigation/form submission is done by the demo script through
 * shared/redirection.ts, into the `#redirect-frame` target this component
 * renders (same pattern as the Secure Fields targets).
 */
@customElement('demo-redirection')
export class DemoRedirection extends DemoElement {
  @property({ attribute: false }) plan: RedirectionPlanView | null = null;
  /** Where the shopper comes back to (`shopper_redirection_url`). */
  @property({ attribute: 'return-url' }) returnUrl = '';
  @state() private mode: 'top' | 'iframe' | null = null;
  @state() private status = '';

  /** Called by the demo script once the return page has messaged back. */
  setStatus(message: string) {
    this.status = message;
  }

  private choose(mode: 'top' | 'iframe') {
    this.mode = mode;
    this.status = mode === 'iframe' ? 'Waiting for the return page to post back…' : 'Redirecting…';
    this.dispatchEvent(new CustomEvent('redirect-follow', { detail: { mode }, bubbles: true }));
  }

  private renderParams(params: Record<string, string>) {
    return html`
      <div class="mt-3">
        <div class="text-xs text-muted mb-1.5">Hidden form fields (${Object.keys(params).length})</div>
        <div class="flex flex-col gap-1">
          ${Object.entries(params).map(([name, value]) => html`
            <div class="flex gap-2 text-xs font-mono">
              <span class="shrink-0 font-semibold">${name}</span>
              <span class="text-muted truncate">${value.length > 80 ? `${value.slice(0, 80)}…` : value}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  render() {
    if (!this.plan) return nothing;
    const { kind, url, params, source } = this.plan;
    return html`
      <div class="bg-white border border-border rounded-xl p-5 mt-4">
        <div class="text-sm font-semibold text-muted uppercase tracking-wider mb-3.5">Redirection required</div>

        <p class="text-xs text-muted mb-3.5">
          <code>authorization.status</code> is <strong>PENDING</strong>: the shopper has to be sent to the
          partner page before the authorisation is settled. Resolved from <code>${source}</code>.
        </p>

        <div class="flex flex-col gap-1 text-xs">
          <div class="flex gap-2"><span class="text-muted w-16 shrink-0">Method</span><span class="font-mono font-semibold">${kind === 'HTML_FORM' ? 'POST (HTML form)' : kind}</span></div>
          ${url
            ? html`<div class="flex gap-2"><span class="text-muted w-16 shrink-0">URL</span><span class="font-mono break-all">${url}</span></div>`
            : nothing}
        </div>
        ${params && Object.keys(params).length ? this.renderParams(params) : nothing}

        <div class="flex flex-col sm:flex-row gap-2 mt-4">
          <button class="${CHOICE_BASE}" ?disabled=${this.mode !== null} @click=${() => this.choose('top')}>
            <span class="block text-sm font-medium">Follow the redirection</span>
            <span class="block text-xs text-muted mt-0.5">Full page — ${kind === 'GET' ? 'location.assign()' : 'auto-submitted form, target _top'}</span>
          </button>
          <button class="${CHOICE_BASE}" ?disabled=${this.mode !== null} @click=${() => this.choose('iframe')}>
            <span class="block text-sm font-medium">Open in an iframe</span>
            <span class="block text-xs text-muted mt-0.5">Stay on the checkout — needs a return page that posts back</span>
          </button>
        </div>

        ${this.status
          ? html`<div class="text-xs text-muted mt-3">${this.status}</div>`
          : nothing}

        <!-- Target the demo script mounts the iframe into (iframe mode only). -->
        <div id="redirect-frame" class="mt-4"></div>

        ${this.mode === 'iframe'
          ? html`
            <p class="text-xs text-muted mt-3">
              ⚠ Partner and ACS pages often refuse to be framed (<code>X-Frame-Options: DENY</code>,
              <code>frame-ancestors</code>). If the frame stays blank, fall back to the full-page redirect.
              ${this.returnUrl
                ? html`The frame ends on <code class="break-all">${this.returnUrl}</code>, which posts
                    <code>purse-demo:redirection-complete</code> to this window.`
                : nothing}
            </p>`
          : nothing}
      </div>
    `;
  }
}
