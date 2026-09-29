import { t } from "./i18n";
import { LocalePicker } from "./shared/LocalePicker";
import { GitHubIcon } from "./shared/GitHubIcon";
import {
  BADGE_CLASSES,
  SECTIONS,
  demoHref,
  demosOf,
  pick,
} from "../../shared/demos";

// Cards come from the shared catalogue (demos.json), this app's demos only —
// same look as the vanilla landing (vanilla/index.html + src/landing.ts).
const DEMOS = demosOf("react");

export function Landing() {
  return (
    <main className="max-w-2xl mx-auto px-5 pt-10 pb-20">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mt-2 mb-1.5">
            {t("landing.title")}
          </h1>
          {/* Static dictionary markup (<code>) — never user input. */}
          <p
            className="text-sm text-gray-500"
            dangerouslySetInnerHTML={{ __html: t("landing.intro") }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-2">
          <LocalePicker />
          <a
            href="https://github.com/UpStreamPay/purse-front-sdk-demo/tree/main/react/src"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-gray-500 no-underline text-xs hover:text-gray-900 border border-gray-200 rounded-md px-2 py-1"
          >
            <GitHubIcon />
            {t("common.viewSource")}
          </a>
        </div>
      </header>

      {SECTIONS.map((section) => {
        const cards = DEMOS.filter((d) => d.section === section.id);
        if (!cards.length) {
          return null;
        }
        return (
          <section key={section.id}>
            <h2 className="text-base font-bold mb-3 mt-2">
              {pick(section.title)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
              {cards.map((demo) => (
                <a
                  key={demo.path}
                  href={demoHref(demo, "react")}
                  className="block p-4 bg-white border border-gray-200 rounded-xl no-underline text-inherit transition-all hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/10"
                >
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${BADGE_CLASSES[section.variant]}`}
                  >
                    {section.badge}
                  </span>
                  <div className="font-semibold text-base my-2">
                    {pick(demo.title)}
                  </div>
                  {/* demos.json is our own static file; desc carries <code> markup. */}
                  <div
                    className="text-sm text-gray-500"
                    dangerouslySetInnerHTML={{ __html: pick(demo.desc) }}
                  />
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
