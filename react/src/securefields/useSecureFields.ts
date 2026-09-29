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

export type SecureFieldsSetup = {
  layout: string;
  styles: NonNullable<Securefields.SecureFieldsConfig["styles"]>;
  options: Record<FieldName, { placeholder?: string; ariaLabel: string }>;
  brandSelector: boolean;
};

/**
 * Mounts one Secure Fields instance into the layout's containers (targetId).
 * Any change to `setup` re-creates it — typed data is lost, the iframes own it.
 * `key` identifies the current instance.
 */
export function useSecureFields(setup: SecureFieldsSetup) {
  // Compared by value: a new object with the same content keeps the instance.
  const key = JSON.stringify(setup);
  const client = useRef<Securefields.SecureFieldsClient | null>(null);
  const [fields, setFields] = useState(emptyFields);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { layout, styles, options, brandSelector }: SecureFieldsSetup =
      JSON.parse(key);
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
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });

    return () => {
      cancelled = true;
      client.current?.destroy();
      client.current = null;
    };
  }, [key]);

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
        !setup.brandSelector && selectedBrand
          ? { selectedNetwork: selectedBrand }
          : undefined,
      );
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };

  return {
    key,
    fields,
    brands,
    selectedBrand,
    ready,
    error,
    submit,
    selectBrand: setSelectedBrand,
  };
}
