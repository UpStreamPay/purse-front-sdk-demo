import { en, type MessageKey } from "./en";
import { fr } from "./fr";

/**
 * Demo i18n — same model as the vanilla app (vanilla/src/i18n): a typed
 * dictionary per language, and a page reload on change, so no context or
 * re-render plumbing is needed.
 */
export const LOCALES = {
  en: { label: "English", messages: en },
  fr: { label: "Français", messages: fr },
} as const satisfies Record<string, { label: string; messages: Record<MessageKey, string> }>;

export type Locale = keyof typeof LOCALES;
export type { MessageKey };

// Shared with the vanilla app and the root landing (one origin on the showcase).
const STORAGE_KEY = "purse_demo_locale";

/**
 * Stored choice → first supported browser language → English. Same rule as
 * vanilla/src/i18n/resolve.ts (which carries the self-check).
 */
function resolveLocale(stored: string | null, preferred: readonly string[]): Locale {
  const isSupported = (l: string | null | undefined): l is Locale =>
    !!l && Object.prototype.hasOwnProperty.call(LOCALES, l);
  if (isSupported(stored)) {
    return stored;
  }
  const match = preferred.map((tag) => tag.toLowerCase().split("-")[0]).find(isSupported);
  return match ?? "en";
}

function storedLocale(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const locale: Locale = resolveLocale(storedLocale(), navigator.languages ?? [navigator.language]);

export function t(key: MessageKey): string {
  return LOCALES[locale].messages[key] ?? en[key];
}

export function setLocale(next: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice just won't survive this reload.
  }
  location.reload();
}

document.documentElement.lang = locale;
