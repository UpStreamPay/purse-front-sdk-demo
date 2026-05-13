import type { DemoConfig } from './types';
import { globalStyles } from './global-styles';

export function createDemo(opts: {
  template: string;
  script: string;
  styles: string;
}): DemoConfig {
  return {
    template: 'vanilla-ts',
    customSetup: {
      dependencies: {
        '@purse-eu/web-sdk': 'latest',
      },
    },
    files: {
      '/index.html': { code: opts.template, readOnly: true },
      '/index.ts': { code: opts.script, readOnly: false, active: true },
      '/styles.css': { code: `${globalStyles}\n${opts.styles}`, readOnly: true },
    },
  };
}
