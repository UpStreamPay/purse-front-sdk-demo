import { useEffect, useRef, useState } from "react";
import { loadSecureFields, type Securefields } from "@purse-eu/web-sdk";
import { getEnv } from "../shared/env";

export type Brand = Securefields.Brand;
export type SubmitResult = Securefields.SubmitResult;

export const FIELDS = ["cardNumber", "holderName", "expDate", "cvv"] as const;
export type FieldName = (typeof FIELDS)[number];

/** What the page can know about a field from outside its iframe — no value. */
export type FieldState = {
  focused: boolean;
  length: number;
  valid: boolean;
  touched: boolean;
};
const EMPTY: FieldState = {
  focused: false,
  length: 0,
  valid: false,
  touched: false,
};
const emptyFields = () =>
  Object.fromEntries(FIELDS.map((f) => [f, EMPTY])) as Record<
    FieldName,
    FieldState
  >;

/** Container id a layout gives each field's iframe. */
export const targetId = (layout: string, field: FieldName) =>
  `sf-${layout}-${field}`;

const BRANDS: Brand[] = [
  "CARTE_BANCAIRE",
  "VISA",
  "MASTERCARD",
  "AMERICAN_EXPRESS",
  "MAESTRO",
];

/**
 * Mounts one Secure Fields instance into the current layout's containers
 * (targetId). Anything that changes its config — layout, styles, placeholders,
 * embedded brand selector — must change `remountKey`: the instance is destroyed
 * and re-created, and what was typed is lost (the iframes own it).
 */
export function useSecureFields(
  layout: string,
  styles: NonNullable<Securefields.SecureFieldsConfig["styles"]>,
  options: Record<FieldName, { placeholder?: string; ariaLabel: string }>,
  brandSelector: boolean,
  remountKey: string,
) {
  const client = useRef<Securefields.SecureFieldsClient | null>(null);
  const [fields, setFields] = useState(emptyFields);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // A new instance starts blank: drop the previous one's field and brand state.
    setFields(emptyFields());
    setBrands([]);
    setSelectedBrand(null);
    setReady(false);
    setError(null);

    const update =
      (patch: Partial<FieldState>) =>
      (p: Securefields.SecureFieldsChangeEventPayload) => {
        const name = p.fieldName as FieldName;
        if (!FIELDS.includes(name)) {
          return;
        }
        setFields((prev) => ({
          ...prev,
          [name]: {
            ...prev[name],
            length: p.length ?? prev[name].length,
            valid: p.valid ?? prev[name].valid,
            touched: prev[name].touched || !!p.touched,
            ...patch,
          },
        }));
      };

    // The SDK accepts 'test' at runtime too; its public type only lists sandbox | production.
    loadSecureFields(
      getEnv("VITE_PURSE_ENVIRONMENT") as Parameters<
        typeof loadSecureFields
      >[0],
    )
      .then(({ initSecureFields }) =>
        initSecureFields({
          tenantId: getEnv("VITE_PURSE_SECUREFIELDS_TENANT_ID"),
          apiKey: getEnv("VITE_PURSE_API_KEY"),
          config: {
            brands: BRANDS,
            brandSelector,
            fields: Object.fromEntries(
              FIELDS.map((f) => [
                f,
                { target: targetId(layout, f), ...options[f] },
              ]),
            ) as Securefields.SecureFieldsConfig["fields"],
            styles,
          },
        }),
      )
      .then((sf) => {
        if (cancelled) {
          sf.destroy();
          return;
        }
        sf.on("focus", update({ focused: true }));
        sf.on("blur", update({ focused: false, touched: true }));
        sf.on("change", update({}));
        sf.on("ready", () => setReady(true));
        sf.on("brandDetected", (e) => {
          setBrands(e.brands ?? []);
          setSelectedBrand((prev) =>
            prev && e.brands?.includes(prev) ? prev : (e.brands?.[0] ?? null),
          );
        });
        sf.render();
        client.current = sf;
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));

    return () => {
      cancelled = true;
      client.current?.destroy();
      client.current = null;
    };
    // styles/options are derived from remountKey; listing them would remount on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, remountKey]);

  /** Tokenize. Marks every field touched first so the page shows what is missing. */
  const submit = async (): Promise<SubmitResult | null> => {
    if (!client.current) {
      return null;
    }
    setFields(
      (prev) =>
        Object.fromEntries(
          FIELDS.map((f) => [f, { ...prev[f], touched: true }]),
        ) as Record<FieldName, FieldState>,
    );
    try {
      // With the embedded selector the SDK tracks the brand itself.
      return await client.current.submit(
        !brandSelector && selectedBrand
          ? { selectedNetwork: selectedBrand }
          : undefined,
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };

  return {
    fields,
    brands,
    selectedBrand,
    ready,
    error,
    submit,
    selectBrand: setSelectedBrand,
  };
}
