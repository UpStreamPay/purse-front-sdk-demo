import type { SandpackFiles, SandpackPredefinedTemplate, SandpackSetup } from '@codesandbox/sandpack-react';

export type DemoConfig = {
  files: SandpackFiles;
  template: SandpackPredefinedTemplate;
  customSetup?: SandpackSetup;
};
