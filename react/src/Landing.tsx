import { t } from "./i18n";
import { LocalePicker } from "./shared/LocalePicker";

// One entry per demo page. Each `href` is a folder with its own index.html
// (see vite.config.ts), relative so it works under any VITE_BASE_URL.
const DEMOS = [
  {
    href: "securefields/",
    badge: "Secure Fields",
    title: t("landing.sf.title"),
    description: t("landing.sf.desc"),
  },
];

export function Landing() {
  return (
    <main className="min-h-screen w-screen flex flex-col items-center p-4 pt-10">
      <header className="w-full max-w-2xl mb-8 relative">
        <LocalePicker className="absolute right-0 top-0" />
        <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold">
          {t("landing.eyebrow")}
        </p>
        <h1 className="text-2xl font-bold mt-1">{t("landing.title")}</h1>
        {/* Static dictionary markup (<code>) — never user input. */}
        <p className="text-sm text-gray-400 mt-1" dangerouslySetInnerHTML={{ __html: t("landing.intro") }} />
      </header>
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DEMOS.map((demo) => (
          <a
            key={demo.href}
            href={demo.href}
            className="block p-4 bg-white rounded-xl shadow-lg no-underline text-gray-900 transition-all hover:ring-2 hover:ring-blue-300"
          >
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-pink-100 text-pink-800">
              {demo.badge}
            </span>
            <div className="font-semibold text-base my-2">{demo.title}</div>
            <div className="text-sm text-gray-500">{demo.description}</div>
          </a>
        ))}
      </div>
    </main>
  );
}
