import {en, type MessageKey} from './en';
import {fr} from './fr';
import {resolveLocale} from './resolve';

/**
 * Demo i18n — a typed dictionary per language, no library.
 *
 *   t('shop.pay')                       → "Payer" (fr)
 *   t('result.returned', {status: 'X'}) → interpolates {status}
 *
 * Static markup is translated by `applyI18n()` from data attributes (see below);
 * changing language reloads the page, so nothing has to re-render live.
 */
export const LOCALES = {
    en: {label: 'English', tag: 'en-GB', messages: en},
    fr: {label: 'Français', tag: 'fr-FR', messages: fr},
} as const satisfies Record<string, {label: string; tag: string; messages: Record<MessageKey, string>}>;

export type Locale = keyof typeof LOCALES;
export type {MessageKey};

// Shared with the React app and the root landing: on the showcase they are one
// origin, so a choice made on one page carries over to the others.
export const LOCALE_STORAGE_KEY = 'purse_demo_locale';

function storedLocale(): string | null {
    try {
        return localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
        return null;
    }
}

export const locale: Locale = resolveLocale(
    Object.keys(LOCALES) as Locale[],
    storedLocale(),
    navigator.languages?.length ? navigator.languages : [navigator.language],
);

/** BCP-47 tag for `Intl` and the SDK's `locale` options (e.g. `'fr-FR'`) — both
 *  tags are among the drop-in's shipped translations. */
export const localeTag = LOCALES[locale].tag;

export function t(key: MessageKey, params?: Record<string, string | number>): string {
    const message: string = LOCALES[locale].messages[key] ?? en[key] ?? key;
    if (!params) {
        return message;
    }
    return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** t() for keys that come from markup (stepper labels…): unknown text passes through. */
export function translate(keyOrText: string): string {
    return Object.prototype.hasOwnProperty.call(en, keyOrText) ? t(keyOrText as MessageKey) : keyOrText;
}

export function setLocale(next: Locale) {
    try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
        // Storage blocked: the choice just won't survive this reload.
    }
    location.reload();
}

/**
 * Translate static markup in place:
 *   data-i18n="key"                    → textContent
 *   data-i18n-html="key"               → innerHTML (strings carrying <code>…</code>)
 *   data-i18n-attr="attr:key;attr:key" → attributes (custom-element props too)
 *
 * Dictionaries are part of the bundle (never user input), so innerHTML is safe.
 */
export function applyI18n(root: ParentNode = document) {
    document.documentElement.lang = locale;
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
        el.textContent = translate(el.dataset.i18n!);
    });
    root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach(el => {
        el.innerHTML = translate(el.dataset.i18nHtml!);
    });
    root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach(el => {
        for (const pair of el.dataset.i18nAttr!.split(';')) {
            const [attr, key] = pair.split(':').map(s => s.trim());
            el.setAttribute(attr, translate(key));
        }
    });
}
