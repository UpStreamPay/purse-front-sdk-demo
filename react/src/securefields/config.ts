import { createContext, useContext } from "react";
import { t, type MessageKey } from "../i18n";
import type { Layout } from "./layouts";
import type {
  Brand,
  FieldName,
  FieldState,
  SubmitResult,
} from "./useSecureFields";

export const RADII = ["none", "sm", "md", "lg", "full"] as const;
export const GRAYS = ["gray", "neutral", "stone"] as const;

/** The UI customizer's settings — everything outside the iframes. */
export type Config = {
  radius: (typeof RADII)[number];
  showIcons: boolean;
  gray: (typeof GRAYS)[number];
  floatingLabels: boolean;
  darkMode: boolean;
  forceErrors: boolean;
  embeddedBrandSelector: boolean;
};

export const DEFAULT_CONFIG: Config = {
  radius: "md",
  showIcons: true,
  gray: "gray",
  floatingLabels: false,
  darkMode: false,
  forceErrors: false,
  embeddedBrandSelector: false,
};

// Full class strings so Tailwind keeps them.
export const RADIUS_CLASS: Record<Config["radius"], string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

// Stacked cells: fill + divider per shade. Tailwind's 100-level grays are
// indistinguishable, so the shades go cool (slate) / neutral / warm (stone).
export const GRAY: Record<Config["gray"], { bg: string; line: string }> = {
  gray: {
    bg: "bg-slate-100 dark:bg-slate-800",
    line: "border-slate-300 divide-slate-300 dark:border-slate-600 dark:divide-slate-600",
  },
  neutral: {
    bg: "bg-neutral-200/70 dark:bg-neutral-800",
    line: "border-neutral-300 divide-neutral-300 dark:border-neutral-600 dark:divide-neutral-600",
  },
  stone: {
    bg: "bg-amber-50 dark:bg-stone-800",
    line: "border-stone-300 divide-stone-300 dark:border-stone-600 dark:divide-stone-600",
  },
};

/** Shared by every layout: settings + the live state of the mounted fields. */
export type FormContext = {
  config: Config;
  layout: string;
  fields: Record<FieldName, FieldState>;
  brands: Brand[];
  selectedBrand: Brand | null;
  selectBrand: (brand: Brand) => void;
  onSubmit: () => void;
  busy: boolean;
  result: SubmitResult | null;
  ready: boolean;
};

export const Form = createContext<FormContext | null>(null);

export function useForm(): FormContext {
  return useContext(Form)!;
}

const ERRORS: Record<FieldName, MessageKey> = {
  cardNumber: "sf.error.cardNumber",
  holderName: "sf.error.holderName",
  expDate: "sf.error.expDate",
  cvv: "sf.error.cvv",
};

/** Error to show for a field: after it was left invalid, or always in "Show error states". */
export function fieldError(
  { fields, config }: FormContext,
  field: FieldName,
): string | null {
  const f = fields[field];
  if (config.forceErrors) {
    return t(ERRORS[field]);
  }
  if (!f.touched || f.focused || f.valid) {
    return null;
  }
  return f.length === 0 ? t("sf.error.required") : t(ERRORS[field]);
}

export function useFieldError(field: FieldName): string | null {
  return fieldError(useForm(), field);
}

/**
 * Fields each layout renders in a labelled <Field> shell — the only ones the
 * "Floating labels" option changes (grouped cells have no label to float).
 */
export const LABELLED: Record<Layout, readonly FieldName[]> = {
  stacked: [],
  classic: ["cardNumber", "expDate", "cvv", "holderName"],
  hybrid: ["cardNumber", "expDate", "cvv", "holderName"],
  inline: ["holderName"],
};

/**
 * Layout + customizer settings <-> query string (`?layout=inline&radius=lg&darkMode=1`),
 * so a configured form is a link. Only non-default values are written.
 */
export function readUrlState(): { config: Config; layout: Layout } {
  const q = new URLSearchParams(location.search);
  const config: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const [key, def] of Object.entries(DEFAULT_CONFIG)) {
    const v = q.get(key);
    if (v === null) {
      continue;
    }
    if (typeof def === "boolean") {
      config[key] = v === "1";
    } else if ((key === "radius" ? RADII : GRAYS).includes(v as never)) {
      config[key] = v;
    }
  }
  const layout = q.get("layout");
  return {
    config: config as Config,
    layout: layout && layout in LABELLED ? (layout as Layout) : "stacked",
  };
}

export function writeUrlState(config: Config, layout: Layout) {
  const q = new URLSearchParams(location.search);
  for (const [key, def] of Object.entries(DEFAULT_CONFIG)) {
    const v = config[key as keyof Config];
    if (v === def) {
      q.delete(key);
    } else {
      q.set(key, typeof v === "boolean" ? (v ? "1" : "0") : v);
    }
  }
  if (layout === "stacked") {
    q.delete("layout");
  } else {
    q.set("layout", layout);
  }
  const search = q.toString();
  history.replaceState(
    null,
    "",
    `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
  );
}
