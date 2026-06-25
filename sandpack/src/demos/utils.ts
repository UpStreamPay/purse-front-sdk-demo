import type { DemoConfig } from './types';
import { globalStyles } from './global-styles';

const TAILWIND_CDN = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4';

export function createDemo(opts: {
  template: string;
  script: string;
  styles: string;
  needsSession?: boolean;
  redirectionUrl?: string;
}): DemoConfig {
  const html = opts.template.replace(
    '</head>',
    `  <script src="${TAILWIND_CDN}"></script>\n  </head>`,
  );

  return {
    template: 'vanilla-ts',
    customSetup: {
      dependencies: {
        '@purse-eu/web-sdk': 'latest',
      },
    },
    needsSession: opts.needsSession ?? true,
    redirectionUrl: opts.redirectionUrl,
    files: {
      '/index.html': { code: html, readOnly: true },
      '/index.ts': { code: opts.script, readOnly: false, active: true },
      '/styles.css': { code: `${globalStyles}\n${opts.styles}`, readOnly: true },
    },
  };
}
