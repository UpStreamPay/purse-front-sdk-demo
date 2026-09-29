import "../../../shared/demos";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "demo-switcher": { app: string };
    }
  }
}

/** "← All demos" + jump-to-any-demo select, shared with the vanilla app (shared/demos.ts). */
export function DemoSwitcher() {
  return <demo-switcher app="react" />;
}
