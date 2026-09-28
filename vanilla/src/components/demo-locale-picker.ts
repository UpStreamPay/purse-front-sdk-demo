import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DemoElement } from './base';
import { LOCALES, locale, setLocale, t, type Locale } from '../i18n';

/**
 * <demo-locale-picker> — the language switcher. Part of <demo-header>, so every
 * demo page has it at the top; the landing page places it directly.
 *
 * Changing language reloads the page (see i18n/index.ts), so the SDK elements
 * are re-created with the new `locale` too.
 */
@customElement('demo-locale-picker')
export class DemoLocalePicker extends DemoElement {
  render() {
    return html`
      <label class="inline-flex items-center gap-1.5 text-xs text-muted">
        <span class="sr-only">${t('common.language')}</span>
        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>
        <select
          class="text-xs text-muted bg-transparent border border-border rounded-md px-1.5 py-1 cursor-pointer hover:text-text focus:outline-none focus:border-accent"
          @change=${(e: Event) => setLocale((e.target as HTMLSelectElement).value as Locale)}
        >
          ${(Object.keys(LOCALES) as Locale[]).map(
            l => html`<option value=${l} ?selected=${l === locale}>${LOCALES[l].label}</option>`,
          )}
        </select>
      </label>
    `;
  }
}
