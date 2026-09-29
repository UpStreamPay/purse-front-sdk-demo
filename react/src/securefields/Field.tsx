import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { t } from "../i18n";
import { brandLogo } from "../shared/brands";
import {
  LABELS,
  RADIUS_CLASS,
  fieldError,
  useFieldError,
  useForm,
} from "./config";
import { InlineBrandSelector } from "./BrandSelector";
import { TokenizationResultDisplay } from "./TokenizationResultDisplay";
import { targetId, type FieldName } from "./useSecureFields";

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 mt-1.5"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

/** Errors of fields sharing one box (stacked, inline) — named when there are several. */
export function GroupErrors({ fields }: { fields: FieldName[] }) {
  const form = useForm();
  const errors = fields.flatMap((f) => {
    const error = fieldError(form, f);
    return error ? [{ field: f, error }] : [];
  });
  return errors.length ? (
    <div className="space-y-1">
      {errors.map(({ field, error }) => (
        <ErrorMessage key={field}>
          {fields.length > 1 ? `${t(LABELS[field])}: ${error}` : error}
        </ErrorMessage>
      ))}
    </div>
  ) : null;
}

/** The empty container the SDK mounts a field's iframe into. */
export function Slot({
  field,
  className = "",
}: {
  field: FieldName;
  className?: string;
}) {
  const { layout } = useForm();
  return (
    <div
      id={targetId(layout, field)}
      className={`hf-slot flex-1 min-w-0 h-full ${className}`}
    />
  );
}

/**
 * One bordered field: label above, or a floating label that rises on focus or
 * once the field has content (from the iframe's focus + length events — the
 * value itself never reaches the page).
 */
export function Field({
  field,
  label,
  icon,
  className = "",
}: {
  field: FieldName;
  label: string;
  icon?: ReactNode;
  className?: string;
}) {
  const { config, fields } = useForm();
  const error = useFieldError(field);
  const f = fields[field];
  const radius = RADIUS_CLASS[config.radius];
  const showIcon = config.showIcons && icon;

  const iconEl = showIcon && (
    <span
      className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${error ? "text-red-600" : "text-gray-400"}`}
    >
      {icon}
    </span>
  );

  if (config.floatingLabels) {
    const raised = f.focused || f.length > 0;
    return (
      <div className={className}>
        <div
          className={`relative h-14 transition-all ${radius} ${
            error
              ? "border border-red-500 bg-red-50 dark:bg-red-950/30"
              : "border border-transparent bg-gray-100 dark:bg-gray-800"
          } ${f.focused && !error ? "ring-2 ring-indigo-500/40" : ""}`}
        >
          {iconEl}
          <span
            className={`absolute pointer-events-none transition-all duration-200 ${showIcon ? "left-10" : "left-3"} ${
              raised
                ? "top-2 text-xs font-medium"
                : "top-1/2 -translate-y-1/2 text-base text-gray-500"
            } ${raised ? (error ? "text-red-600" : "text-indigo-600 dark:text-indigo-400") : ""}`}
          >
            {label}
          </span>
          <div
            className={`absolute inset-x-0 bottom-0 top-5 flex ${showIcon ? "pl-10" : "pl-3"} pr-3`}
          >
            <Slot field={field} />
          </div>
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    );
  }

  const border = error
    ? "border-red-500"
    : f.focused
      ? "border-indigo-500 ring-2 ring-indigo-500/20"
      : "border-gray-300 dark:border-gray-700";
  return (
    <div className={`space-y-2 ${className}`}>
      <span
        className={`block text-sm font-medium ${error ? "text-red-600" : "text-gray-800 dark:text-gray-200"}`}
      >
        {label}
      </span>
      <div
        className={`relative flex h-11 border bg-white dark:bg-gray-900 transition-all ${radius} ${showIcon ? "pl-10" : "pl-3"} ${error ? "pr-10" : "pr-3"} ${border}`}
      >
        {iconEl}
        <Slot field={field} />
        {error && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-600 pointer-events-none" />
        )}
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}

/** Brand logos: detected ones lit, the rest dimmed. Display only — InlineBrandSelector picks. */
export function BrandIcons() {
  const { fields, brands: detected } = useForm();
  // An emptied field keeps its last detection — nothing typed means no brand yet.
  const brands = fields.cardNumber.length > 0 ? detected : [];
  return (
    <div className="flex items-center gap-1.5">
      {(["VISA", "MASTERCARD", "CARTE_BANCAIRE"] as const).map((b) => (
        <img
          key={b}
          src={brandLogo(b)}
          alt={b}
          className={`h-6 w-9 object-contain transition ${brands.length === 0 || brands.includes(b) ? "" : "opacity-30 grayscale"}`}
        />
      ))}
    </div>
  );
}

/** Tokenize button, co-badge picker above it, result card below it — shared by every layout. */
export function SubmitButton({ className = "" }: { className?: string }) {
  const {
    config,
    onSubmit,
    busy,
    ready,
    brands,
    selectedBrand,
    selectBrand,
    fields,
    result,
  } = useForm();
  return (
    <>
      {/* Co-badged card (e.g. CB + Visa): the shopper picks the brand, unless the SDK's embedded selector does. */}
      {!config.embeddedBrandSelector &&
        brands.length > 1 &&
        fields.cardNumber.length > 0 && (
          <InlineBrandSelector
            brands={brands}
            selectedBrand={selectedBrand}
            onChange={selectBrand}
          />
        )}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={onSubmit}
        className={`w-full h-12 inline-flex items-center justify-center gap-2 text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition ${RADIUS_CLASS[config.radius]} ${className}`}
      >
        {(busy || !ready) && <Loader2 className="h-4 w-4 animate-spin" />}
        {!ready ? t("sf.loading") : busy ? t("sf.processing") : t("sf.submit")}
      </button>
      {result && <TokenizationResultDisplay tokenizationResult={result} />}
    </>
  );
}
