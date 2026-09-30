import type { ReactNode } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CreditCard,
  Lock,
  User,
} from "lucide-react";
import { t } from "../i18n";
import { GRAY, RADIUS_CLASS, useFieldError, useForm } from "./config";
import { BrandIcons, Field, GroupErrors, SubmitButton, Slot } from "./Field";

const icon = "h-4 w-4";

// Field sets shared by the layouts — labels only, the iframes carry the rest.
const CardNumber = () => (
  <Field
    field="cardNumber"
    label={t("sf.label.cardNumber")}
    icon={<CreditCard className={icon} />}
  />
);
const Expiry = () => (
  <Field
    field="expDate"
    label={t("sf.label.expDate")}
    icon={<Calendar className={icon} />}
  />
);
const Cvv = () => (
  <Field
    field="cvv"
    label={t("sf.label.cvv")}
    icon={<Lock className={icon} />}
  />
);
const Holder = () => (
  <Field
    field="holderName"
    label={t("sf.label.holderName")}
    icon={<User className={icon} />}
  />
);

/** One card-like container with internal dividers — the "Elements" look. */
export function StackedLayout() {
  const { config, fields } = useForm();
  const cardError = [
    useFieldError("cardNumber"),
    useFieldError("expDate"),
    useFieldError("cvv"),
  ].some(Boolean);
  const holderError = useFieldError("holderName");
  const shade = GRAY[config.gray];
  // A pill-shaped container would break the internal dividers.
  const containerRadius =
    RADIUS_CLASS[config.radius === "full" ? "md" : config.radius];
  const box = (error: boolean) =>
    `${containerRadius} border shadow-sm overflow-hidden ${error ? "border-red-500 ring-1 ring-red-500/40" : shade.line}`;
  const cell = (f: keyof typeof fields) =>
    `relative flex items-center px-4 h-14 transition-colors ${shade.bg} ${fields[f].focused ? "ring-2 ring-inset ring-indigo-500/40" : ""}`;
  const label = (error = false) =>
    `block text-base font-medium ${error ? "text-red-600" : "dark:text-gray-200"}`;

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="space-y-2">
        <span className={label()}>{t("sf.label.cardInfo")}</span>
        <div className={box(cardError)}>
          <div className={`${cell("cardNumber")} border-b ${shade.line}`}>
            <Slot field="cardNumber" />
            {config.showIcons && !config.embeddedBrandSelector && (
              // No room beside a full card number on a phone.
              <div className="hidden sm:block">
                <BrandIcons />
              </div>
            )}
          </div>
          <div className={`grid grid-cols-2 divide-x ${shade.line}`}>
            <div className={cell("expDate")}>
              <Slot field="expDate" />
            </div>
            <div className={cell("cvv")}>
              <Slot field="cvv" />
              {config.showIcons && (
                <span className="flex items-center text-gray-400">
                  <Lock className="h-5 w-5" />
                  <span className="text-xs ml-1 font-medium">123</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <GroupErrors fields={["cardNumber", "expDate", "cvv"]} />
      </div>
      {/* Same cell styling as the card block, so the form reads as one set. */}
      <div className="space-y-2">
        <span className={label(!!holderError)}>{t("sf.label.holderName")}</span>
        <div className={box(!!holderError)}>
          <div className={cell("holderName")}>
            <Slot field="holderName" />
          </div>
        </div>
        <GroupErrors fields={["holderName"]} />
      </div>
      <SubmitButton className="h-14" />
    </div>
  );
}

/** Standard vertical flow, one field per row. */
export function ClassicLayout() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <CardNumber />
      <Expiry />
      <Cvv />
      <Holder />
      <SubmitButton />
    </div>
  );
}

/** Related fields side by side — the usual e-commerce checkout. */
export function HybridLayout() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <CardNumber />
      <div className="grid grid-cols-2 gap-4 items-start">
        <Expiry />
        <Cvv />
      </div>
      <Holder />
      <SubmitButton />
    </div>
  );
}

/** Card number, expiry and CVC on one line, for wide viewports. */
export function InlineLayout() {
  const { config, fields } = useForm();
  const cardError = [
    useFieldError("cardNumber"),
    useFieldError("expDate"),
    useFieldError("cvv"),
  ].some(Boolean);
  const anyFocused =
    fields.cardNumber.focused || fields.expDate.focused || fields.cvv.focused;
  const divider = (
    <div className="w-px h-8 bg-gray-300/60 dark:bg-gray-700 self-center" />
  );
  // Too narrow for one line on a phone: the card number takes its own row
  // below `sm`, expiry and CVC share the second.

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <span className="block text-base font-medium dark:text-gray-200">
          {t("sf.label.cardDetails")}
        </span>
        <div
          className={`flex flex-wrap sm:flex-nowrap items-center sm:h-14 border shadow-sm overflow-hidden bg-white dark:bg-gray-900 transition-all ${RADIUS_CLASS[config.radius]} ${
            cardError
              ? "border-red-500 ring-1 ring-red-500/40"
              : anyFocused
                ? "border-indigo-500 ring-2 ring-indigo-500/20"
                : "border-gray-300 dark:border-gray-700"
          }`}
        >
          <div className="basis-full sm:flex-[2] min-w-0 h-14 flex items-center px-4 border-b sm:border-b-0 border-gray-300/60 dark:border-gray-700">
            {config.showIcons && (
              <CreditCard className="h-5 w-5 text-gray-400 mr-3 shrink-0" />
            )}
            <Slot field="cardNumber" />
          </div>
          <div className="hidden sm:block">{divider}</div>
          <div className="flex-1 min-w-0 h-14 flex items-center px-4">
            <Slot field="expDate" />
          </div>
          {divider}
          <div className="flex-1 min-w-0 h-14 flex items-center px-4">
            <Slot field="cvv" />
            {config.showIcons && (
              <Lock className="h-5 w-5 text-gray-400 ml-3 shrink-0" />
            )}
          </div>
        </div>
        <GroupErrors fields={["cardNumber", "expDate", "cvv"]} />
      </div>
      <Field
        field="holderName"
        label={t("sf.label.holderName")}
        icon={<User className="h-5 w-5" />}
      />
      <SubmitButton className="h-14" />
    </div>
  );
}

/** Static reference of the three field states — plain markup, no iframes. */
export function StateExamples() {
  const { config } = useForm();
  const radius = RADIUS_CLASS[config.radius];
  const row = (
    border: string,
    text: string,
    value: string,
    trailing?: ReactNode,
  ) => (
    <div
      className={`relative flex items-center h-11 border bg-white dark:bg-gray-900 ${radius} ${border} ${config.showIcons ? "pl-10" : "pl-3"} pr-10`}
    >
      {config.showIcons && (
        <CreditCard className="absolute left-3 h-4 w-4 text-gray-400" />
      )}
      <span className={text}>{value}</span>
      {trailing}
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <span className="block text-sm font-medium dark:text-gray-200">
          {t("sf.states.default")}
        </span>
        {row(
          "border-gray-300 dark:border-gray-700",
          "text-gray-400",
          "4242 4242 4242 4242",
        )}
        <p className="text-xs text-gray-500">{t("sf.states.defaultHint")}</p>
      </div>
      <div className="space-y-2">
        <span className="block text-sm font-medium dark:text-gray-200">
          {t("sf.states.valid")}
        </span>
        {row(
          "border-green-500",
          "text-gray-900 dark:text-gray-100",
          "4242 4242 4242 4242",
          <CheckCircle className="absolute right-3 h-4 w-4 text-green-500" />,
        )}
        <p className="text-xs text-green-600">{t("sf.states.validHint")}</p>
      </div>
      <div className="space-y-2">
        <span className="block text-sm font-medium text-red-600">
          {t("sf.states.error")}
        </span>
        {row(
          "border-red-500",
          "text-red-900 dark:text-red-300",
          "4242 424",
          <AlertCircle className="absolute right-3 h-4 w-4 text-red-600" />,
        )}
        <p className="text-xs text-red-600">{t("sf.error.cardNumber")}</p>
      </div>
    </div>
  );
}

export const LAYOUTS = {
  stacked: StackedLayout,
  classic: ClassicLayout,
  hybrid: HybridLayout,
  inline: InlineLayout,
} as const;
export type Layout = keyof typeof LAYOUTS;
