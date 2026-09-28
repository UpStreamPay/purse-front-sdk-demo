/**
 * Pick the demo's locale: an explicit choice (locale picker) wins, then the
 * first browser language we have a dictionary for, then English.
 *
 * `preferred` is `navigator.languages` — region subtags are ignored, so
 * `fr-CA` and `fr-BE` both resolve to `fr`.
 */
export function resolveLocale<L extends string>(
    supported: readonly L[],
    stored: string | null | undefined,
    preferred: readonly string[],
): L {
    const isSupported = (l: string | undefined): l is L => !!l && (supported as readonly string[]).includes(l);
    if (isSupported(stored ?? undefined)) {
        return stored as L;
    }
    for (const tag of preferred) {
        const lang = tag.toLowerCase().split('-')[0];
        if (isSupported(lang)) {
            return lang;
        }
    }
    return supported[0];
}
