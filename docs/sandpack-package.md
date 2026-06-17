# `@upstreampay/purse-sdk-demos` — sandpack package

The `sandpack/` workspace publishes the `@upstreampay/purse-sdk-demos` npm package. It provides ready-made Sandpack demo configurations and the `PurseDemo` React component used in the [Purse developer documentation site](https://docs.purse.tech).

## What it contains

| Export | Kind | Description |
|---|---|---|
| `PurseDemo` | React component | Renders a Sandpack sandbox (code editor + preview) with a live Purse session |
| `dropinDemo` | Config factory | Drop-in Checkout demo |
| `headlessDemo` | Config factory | Headless Checkout quick-start demo |
| `hostedFormDemo` | Config factory | Headless Checkout — hosted form variant |
| `hostedFieldsDemo` | Config factory | Headless Checkout — hosted fields variant |
| `secureFieldsDemo` | Config factory | SecureFields tokenization demo |
| `DemoConfig` | TypeScript type | Shape of the object returned by config factories |

## How it works

```
doc page (MDX)
  └─ <SandpackDemo config={dropinDemo} />        ← usp-doc wrapper
       └─ <PurseDemo demo={dropinDemo({...})} />  ← this package
            ├─ POST /orchestration_session  →  fetch fresh client session
            ├─ /session.json (hidden file)  →  injected into Sandpack files
            └─ SandpackProvider             →  code editor + live preview
```

Each config factory returns a `DemoConfig` describing the Sandpack files (`index.ts`, `index.html`, `styles.css`) and optional runtime parameters. `PurseDemo` fetches a client session from the backend, injects it as a hidden `session.json` file, and boots the Sandpack sandbox.

## `DemoConfig` type

```ts
type DemoConfig = {
  files: SandpackFiles;            // Sandpack file tree
  template: SandpackPredefinedTemplate;
  customSetup?: SandpackSetup;     // extra npm dependencies
  needsSession: boolean;           // whether to fetch a client session
  redirectionUrl?: string;         // post-payment redirect destination
};
```

## The `redirectionUrl` parameter

All session-backed demo factories accept an optional `dynamicData` object:

```ts
dropinDemo({ redirectionUrl: 'https://docs.purse.tech/docs/fake-confirmation-page' })
headlessDemo({ redirectionUrl: '...' })
hostedFormDemo({ redirectionUrl: '...' })
hostedFieldsDemo({ redirectionUrl: '...' })
```

When set, `PurseDemo` sends it in the session POST body so the backend can embed it as `shopper_redirection_url` in the Purse API client session. After payment the SDK redirects the preview iframe to that page instead of a dead URL.

See [post-payment-redirect.md](./post-payment-redirect.md) for the full design and the required backend change.

## Adding a demo

1. Create a folder under `sandpack/src/demos/<name>/` with four files:
   - `template.html` — HTML shell (loaded as `readOnly`)
   - `script.ts` — user-editable entry point; use `// @ts-nocheck` for SDK imports
   - `styles.css` — scoped styles
   - `index.ts` — config factory

2. In `index.ts`, call `createDemo` and accept `dynamicData`:

   ```ts
   import { createDemo } from '../utils';
   import template from './template.html?raw';
   import script from './script.ts?raw';
   import styles from './styles.css?raw';

   export const myDemo = (dynamicData?: Record<string, any>) =>
       createDemo({ template, script, styles, redirectionUrl: dynamicData?.redirectionUrl });
   ```

3. Export it from `sandpack/src/index.ts`.

4. Add a `<SandpackDemo config={myDemo} />` to the relevant MDX page in `usp-doc`.

## Session injection

The backend at `VITE_PURSE_SESSION_URL` is expected to return a Purse client session JSON. The shape used inside the demos:

```json
{
  "widget": {
    "data": "<widget token string>"
  }
}
```

The demos import this as `./session.json`:

```ts
import clientSession from './session.json';
const checkout = await Purse.createHeadlessCheckout(clientSession.widget.data);
```

## Environment variables

| Variable | Set at | Description |
|---|---|---|
| `VITE_PURSE_SESSION_URL` | **build time** (baked by tsup) | Backend endpoint for creating client sessions |
| `VITE_SECUREFIELDS_TENANT_ID` | build time | Default SecureFields tenant (overridable via `dynamicData`) |
| `VITE_SECUREFIELDS_LOGS_API_KEY` | build time | SecureFields logging key |

`VITE_PURSE_SESSION_URL` is baked into the published bundle during `npm run build`. It is set to the sandbox URL in the CI publish workflow (`.github/workflows/demos-publish.yaml`) and to the dev URL in the local `.env` file.

## Building and publishing

```sh
cd sandpack
npm run build       # tsup — outputs dist/index.js, dist/index.cjs, dist/index.d.ts
npm run typecheck   # tsc --noEmit
```

Publishing is automated: pushing a tag matching `@upstreampay/purse-sdk-demos@x.y.z` triggers `.github/workflows/demos-publish.yaml`, which builds and publishes to the GitHub npm registry (`npm.pkg.github.com`).

To bump the version locally:

```sh
cd sandpack
npx release-it      # follows conventional-changelog, creates the tag
```
