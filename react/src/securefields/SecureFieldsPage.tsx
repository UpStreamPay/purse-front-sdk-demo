import { useEffect, useState, type ReactNode } from "react";
import type { Securefields } from "@purse-eu/web-sdk";
import { RotateCcw } from "lucide-react";
import { t, type MessageKey } from "../i18n";
import { DebugPanel } from "../shared/DebugPanel";
import { DemoSwitcher } from "../shared/DemoSwitcher";
import { LocalePicker } from "../shared/LocalePicker";
import { GitHubIcon } from "../shared/GitHubIcon";
import {
  DEFAULT_CONFIG,
  LABELLED,
  LABELS,
  readUrlState,
  writeUrlState,
  Form,
  GRAYS,
  RADII,
  type Config,
} from "./config";
import { LAYOUTS, StateExamples, type Layout } from "./layouts";
import {
  useSecureFields,
  type FieldName,
  type SubmitResult,
} from "./useSecureFields";

const SOURCE =
  "https://github.com/UpStreamPay/purse-front-sdk-demo/tree/main/react/src/securefields";

// Input text inside the iframes — the only styling the page can't do from outside.
// The SDK has its own colour per state (:focus, :valid…), so the text colour is
// repeated there — setting `color` alone leaves typed text dark in dark mode.
const styles = (
  dark: boolean,
): NonNullable<Securefields.SecureFieldsConfig["styles"]> => {
  const color = dark ? "#f3f4f6" : "#111827";
  return {
    input: {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "16px",
      color,
      backgroundColor: "transparent",
      placeholderColor: dark ? "#6b7280" : "#9ca3af",
      ":focus": { color },
      ":valid": { color },
      ":invalid": { color },
      ":empty": { color },
      ":autocomplete": { color },
    },
  };
};

const PLACEHOLDERS: Record<FieldName, string> = {
  cardNumber: "1234 1234 1234 1234",
  holderName: t("sf.placeholder.holder"),
  expDate: t("sf.placeholder.exp"),
  cvv: "123",
};
function Switch({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${disabled ? "opacity-50" : ""}`}
    >
      <label htmlFor={id} className="space-y-0.5 cursor-pointer">
        <span className="block text-sm font-medium text-gray-600 dark:text-gray-300">
          {label}
        </span>
        {hint && (
          <span className="block text-[10px] text-gray-400">{hint}</span>
        )}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          checked ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

function Customizer({
  config,
  set,
  layout,
}: {
  config: Config;
  set: (patch: Partial<Config>) => void;
  layout: Layout;
}) {
  const hr = <hr className="border-gray-200 dark:border-gray-800" />;
  // Only show the options that change the current layout.
  const hasGray = layout === "stacked";
  const hasFloating = LABELLED[layout].length > 0;
  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6 space-y-6 xl:sticky xl:top-8">
      <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <span>🎨</span> {t("sf.custom.title")}
      </h2>

      <div className="space-y-3">
        <span className="block text-sm font-medium text-gray-600 dark:text-gray-300">
          {t("sf.custom.radius")}
        </span>
        <div className="grid grid-cols-3 gap-2">
          {RADII.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={config.radius === r}
              onClick={() => set({ radius: r })}
              className={`px-2 py-2 text-xs font-medium border rounded-lg cursor-pointer transition-all ${
                config.radius === r
                  ? "bg-indigo-600/5 text-indigo-600 dark:text-indigo-300 border-indigo-600 ring-2 ring-offset-1 ring-indigo-600/20 dark:ring-offset-gray-900"
                  : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {t(`sf.corners.${r}`)}
            </button>
          ))}
        </div>
      </div>

      {hr}

      {hasGray && (
        <>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">
              {t("sf.custom.gray")}
            </legend>
            <div className="flex gap-4">
              {GRAYS.map((g) => (
                <label
                  key={g}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="gray"
                    value={g}
                    checked={config.gray === g}
                    onChange={() => set({ gray: g })}
                    className="accent-indigo-600"
                  />
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>

          {hr}
        </>
      )}

      <div className="space-y-4">
        <Switch
          id="cfg-icons"
          label={t("sf.custom.icons")}
          checked={config.showIcons}
          onChange={(v) => set({ showIcons: v })}
        />
        {hasFloating && (
          <Switch
            id="cfg-floating"
            label={t("sf.custom.floating")}
            hint={t("sf.custom.remounts")}
            checked={config.floatingLabels}
            onChange={(v) => set({ floatingLabels: v })}
          />
        )}
        <Switch
          id="cfg-dark"
          label={t("sf.custom.dark")}
          hint={t("sf.custom.remounts")}
          checked={config.darkMode}
          onChange={(v) => set({ darkMode: v })}
        />
        {hr}
        <Switch
          id="cfg-brand"
          label={t("sf.custom.embeddedBrand")}
          // Its badges have a fixed white background: light forms only.
          hint={t(
            config.darkMode
              ? "sf.custom.embeddedBrandLightOnly"
              : "sf.custom.remounts",
          )}
          disabled={config.darkMode}
          checked={config.embeddedBrandSelector && !config.darkMode}
          onChange={(v) => set({ embeddedBrandSelector: v })}
        />
        {hr}
        <Switch
          id="cfg-errors"
          label={t("sf.custom.errors")}
          hint={t("sf.custom.errorsHint")}
          checked={config.forceErrors}
          onChange={(v) => set({ forceErrors: v })}
        />
      </div>

      {hr}

      <button
        type="button"
        onClick={() => set(DEFAULT_CONFIG)}
        className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
      >
        <RotateCcw className="h-4 w-4" />
        {t("sf.custom.reset")}
      </button>
    </div>
  );
}

function Panel({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
      <div className="p-6 sm:p-8 bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
        {children}
      </div>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border px-4 py-3 text-sm bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
    >
      {message}
    </div>
  );
}

function Showcase({
  config,
  layout,
  setLayout,
}: {
  config: Config;
  layout: Layout;
  setLayout: (layout: Layout) => void;
}) {
  const [busy, setBusy] = useState(false);
  // Tagged with the instance that produced it: a remount empties the fields,
  // so an older token (even one still in flight) is no longer shown.
  const [result, setResult] = useState<{
    key: string;
    value: SubmitResult | null;
  } | null>(null);

  const floating = config.floatingLabels ? LABELLED[layout] : [];
  const options = Object.fromEntries(
    (Object.keys(LABELS) as FieldName[]).map((f) => [
      f,
      {
        ariaLabel: t(LABELS[f]),
        // A floating label replaces the placeholder — only where the layout has one.
        placeholder: floating.includes(f) ? "" : PLACEHOLDERS[f],
      },
    ]),
  ) as Record<FieldName, { placeholder: string; ariaLabel: string }>;
  const sf = useSecureFields({
    layout,
    styles: styles(config.darkMode),
    options,
    brandSelector: config.embeddedBrandSelector,
  });

  const onSubmit = async () => {
    const { key } = sf;
    setResult(null);
    setBusy(true);
    setResult({ key, value: await sf.submit() });
    setBusy(false);
  };

  const Current = LAYOUTS[layout];
  return (
    <Form.Provider
      value={{
        config,
        layout,
        ...sf,
        onSubmit,
        busy,
        result: result?.key === sf.key ? result.value : null,
      }}
    >
      <div className="space-y-12">
        <div className="space-y-4">
          <div
            role="tablist"
            aria-label={t("sf.layouts")}
            className="flex flex-wrap gap-1.5"
          >
            {(Object.keys(LAYOUTS) as Layout[]).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={layout === l}
                onClick={() => setLayout(l)}
                className={`px-3.5 py-1.5 border rounded-full text-sm cursor-pointer transition-all ${
                  layout === l
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-indigo-400"
                }`}
              >
                {t(`sf.layout.${l}` as MessageKey)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("sf.oneLive")}
          </p>
        </div>

        {sf.error && <ErrorBanner message={sf.error} />}

        <Panel
          title={t(`sf.layout.${layout}` as MessageKey)}
          desc={t(`sf.layout.${layout}.desc` as MessageKey)}
        >
          {/* key: a fresh DOM per layout, so the new iframes land in empty containers. */}
          <Current key={layout} />
        </Panel>

        <Panel title={t("sf.states.title")} desc={t("sf.states.desc")}>
          <div className="max-w-md mx-auto">
            <StateExamples />
          </div>
        </Panel>
      </div>
    </Form.Provider>
  );
}

export function SecureFieldsPage() {
  const [initial] = useState(readUrlState);
  const [config, setConfig] = useState(initial.config);
  const [layout, setLayout] = useState<Layout>(initial.layout);

  useEffect(() => writeUrlState(config, layout), [config, layout]);
  const set = (patch: Partial<Config>) =>
    setConfig((c) => ({ ...c, ...patch }));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", config.darkMode);
  }, [config.darkMode]);

  return (
    <main className="min-h-screen w-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DemoSwitcher />
          <div className="flex items-center gap-2">
            <LocalePicker />
            <a
              href={SOURCE}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-gray-500 no-underline text-xs hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1"
            >
              <GitHubIcon />
              {t("common.viewSource")}
            </a>
          </div>
        </div>

        <div className="text-center space-y-4">
          <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold">
            {t("sf.eyebrow")}
          </p>
          <h1 className="text-4xl font-bold tracking-tight">{t("sf.title")}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t("sf.desc")}
          </p>
        </div>

        <hr className="border-gray-200 dark:border-gray-800" />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <div className="xl:col-span-3 z-20">
            <Customizer config={config} set={set} layout={layout} />
          </div>
          <div className="xl:col-span-9">
            <Showcase
              config={{
                ...config,
                embeddedBrandSelector:
                  config.embeddedBrandSelector && !config.darkMode,
              }}
              layout={layout}
              setLayout={setLayout}
            />
          </div>
        </div>
      </div>
      <DebugPanel />
    </main>
  );
}
