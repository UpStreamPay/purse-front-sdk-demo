import manifest from '../demos.json';

/**
 * The demo catalogue — one source for the root landing (which fetches
 * demos.json at runtime, it has no bundler), the per-app landings and the
 * <demo-switcher> every demo page carries.
 *
 * `path` is from the site root (`vanilla/…`, `react/…`), the layout deploy.yml
 * assembles. Each app is served under its own base (VITE_BASE_URL=/vanilla/),
 * so the site root is BASE_URL + '../'. In dev each app is its own server at
 * `/`: links into the same app still resolve, links into the other app only
 * work on the assembled site (`npm run build:site`).
 */

type Text = { en: string; fr: string };
export type App = 'vanilla' | 'react';
export type Section = (typeof manifest.sections)[number];
export type Demo = (typeof manifest.demos)[number];

export const SECTIONS: readonly Section[] = manifest.sections;
export const DEMOS: readonly Demo[] = manifest.demos;

// Badge colour per section. Full class strings so Tailwind keeps them.
export const BADGE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  violet: 'bg-violet-100 text-violet-800',
  pink: 'bg-pink-100 text-pink-800',
  amber: 'bg-amber-100 text-amber-800',
  sky: 'bg-sky-100 text-sky-800',
};

const appOf = (demo: Demo): App => demo.path.split('/')[0] as App;

/** Text in the page language (both apps set <html lang>), English fallback. */
export function pick(text: Text): string {
  return document.documentElement.lang === 'fr' ? text.fr : text.en;
}

/** Site root: the folder above this app's base. */
export function siteRoot(): string {
  return new URL(import.meta.env.BASE_URL + '../', location.href).href;
}

/** Link to a demo from inside `app` — same-app links stay relative to its base. */
export function demoHref(demo: Demo, app: App): string {
  if (appOf(demo) === app) {
    return import.meta.env.BASE_URL + demo.path.slice(app.length + 1);
  }
  return new URL(demo.path, siteRoot()).href;
}

export function demosOf(app: App): Demo[] {
  return DEMOS.filter(d => appOf(d) === app);
}

export function sectionOf(demo: Demo): Section {
  return SECTIONS.find(s => s.id === demo.section)!;
}

const samePage = (href: string) => {
  const strip = (p: string) => p.replace(/index\.html$/, '');
  return strip(new URL(href, location.href).pathname) === strip(location.pathname);
};

const LABELS = {
  all: { en: '← All demos', fr: '← Toutes les démos' },
  jump: { en: 'Jump to demo', fr: 'Aller à la démo' },
};

/**
 * <demo-switcher app="vanilla"> — "← All demos" back to the site root plus a
 * native <select> of every demo (grouped by section, current one selected) to
 * jump straight to another. Light DOM, so the host app's Tailwind styles it.
 */
class DemoSwitcher extends HTMLElement {
  connectedCallback() {
    const app = (this.getAttribute('app') ?? 'vanilla') as App;

    const back = document.createElement('a');
    back.href = siteRoot();
    back.className = 'text-sm text-gray-500 no-underline hover:text-gray-900 whitespace-nowrap';
    back.textContent = pick(LABELS.all);

    const select = document.createElement('select');
    select.ariaLabel = pick(LABELS.jump);
    select.className =
      'text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:border-gray-400 max-w-[14rem]';
    let found = false;
    for (const section of SECTIONS) {
      const group = document.createElement('optgroup');
      group.label = pick(section.title);
      for (const demo of DEMOS.filter(d => d.section === section.id)) {
        const href = demoHref(demo, app);
        const current = samePage(href);
        found ||= current;
        group.append(new Option(pick(demo.title), href, current, current));
      }
      select.append(group);
    }
    if (!found) {
      select.prepend(new Option(pick(LABELS.jump), '', true, true));
    }
    select.addEventListener('change', () => {
      if (select.value) {
        location.href = select.value;
      }
    });

    this.className = 'inline-flex flex-wrap items-center gap-3';
    this.replaceChildren(back, select);
  }
}

if (!customElements.get('demo-switcher')) {
  customElements.define('demo-switcher', DemoSwitcher);
}
