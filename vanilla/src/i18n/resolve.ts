/**
 * Pick the demo's locale: an explicit choice (locale picker) wins, else
 * English. The browser language is ignored on purpose.
 */
export function resolveLocale<L extends string>(supported: readonly L[], stored: string | null | undefined): L {
    if (stored && (supported as readonly string[]).includes(stored)) {
        return stored as L;
    }
    return supported[0];
}
