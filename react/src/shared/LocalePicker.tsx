import { LOCALES, locale, setLocale, t, type Locale } from "../i18n";

/** Language switcher shown at the top of every React page. */
export function LocalePicker({ className = "" }: { className?: string }) {
  return (
    <label className={`inline-flex items-center gap-1.5 text-xs text-gray-400 ${className}`}>
      <span className="sr-only">{t("common.language")}</span>
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
      </svg>
      <select
        className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded-md px-1.5 py-1 cursor-pointer hover:text-gray-700 focus:outline-none focus:border-blue-400"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {(Object.keys(LOCALES) as Locale[]).map((l) => (
          <option key={l} value={l}>
            {LOCALES[l].label}
          </option>
        ))}
      </select>
    </label>
  );
}
