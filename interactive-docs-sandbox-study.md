# Study: Interactive Code Editor for Developer Documentation

**Goal:** Integrate interactive, editable examples
into [docs.purse.tech](https://docs.purse.tech/docs/integrate/purse-checkout/integration-modes) allowing developers to
test the Purse widget without any local installation.

**Context:**

- Docs platform: Docusaurus 3.10.0
- Session provider: `alfred` — deployed Docker image, credentials baked in, exposes a `getSession` HTTP endpoint. No
  token ever transits through the browser.
- Concurrent users: <100
- Demos must be **editable** by the user

---

## Table of Contents

- [Summary](#summary)
- [Shortlisted Solutions](#shortlisted-solutions)
    - [Sandpack (self-hosted) — Recommended](#sandpack-self-hosted--recommended)
    - [CodeSandbox SDK — Secondary option](#codesandbox-sdk-scale-tier--secondary-option)
- [Eliminated Solutions](#eliminated-solutions)
- [Implementation Plan](#implementation-plan-sandpack)
- [Demo Cases — File Structure](#demo-cases--file-structure)
- [Cross-repo Sync (purse-front-sdk-demo → usp-doc)](#cross-repo-sync-purse-front-sdk-demo--usp-doc)
- [References](#references)

---

## Summary

| Solution                   | Pricing          | Editable   | Node.js           | Programmatic    | COOP/COEP  | alfred integration       | Rate limits                |
|----------------------------|------------------|------------|-------------------|-----------------|------------|--------------------------|----------------------------|
| **Sandpack** (self-hosted) | **Free** (OSS)   | Yes        | Limited (Nodebox) | Via React props | No         | `fetch` from editor code | None                       |
| **CodeSandbox SDK**        | ~€170/mo (Scale) | Yes        | Full (Linux VM)   | Yes (SDK)       | No         | `fetch` from editor code | 1,000 creations/hr (Scale) |
| StackBlitz WebContainers   | On request       | Yes        | Full (WASM)       | Yes (SDK)       | **Yes ⚠️** | `fetch` from editor code | ~10k req/mo                |
| CodePen                    | €0–26/mo         | Yes (fork) | No                | **No**          | No         | `fetch` only             | No API                     |
| JSFiddle                   | €0–9/mo          | Yes (fork) | No                | **No**          | No         | `fetch` only             | No API                     |
| Replit                     | €20–95/mo        | Partial    | Yes               | No              | No         | `fetch` from editor code | No creation API            |

**Recommendation: Self-hosted Sandpack.** Zero cost, editable, Docusaurus-native React component, no COOP/COEP
constraint, alfred called directly from the editor code. Given <100 concurrent users and no 3DS popup requirement, none
of the heavier solutions add value.

---

## Shortlisted Solutions

### Sandpack (self-hosted) ✅ Recommended

Sandpack is a React component (MIT) by CodeSandbox that runs a bundler in a cross-origin iframe in the visitor's
browser. No server, no API, no per-load cost.

**Pricing**

Free. The npm package (`@codesandbox/sandpack-react`) is open-source. Hosting the bundler is a one-time deploy of a
static build to any CDN or subdomain.

**Editable demos in Docusaurus**

Sandpack renders a full code editor (Monaco or CodeMirror) + live preview out of the box. Drop-in as an MDX component:

```jsx
// docs/src/components/PurseWidgetDemo.jsx
import { Sandpack } from '@codesandbox/sandpack-react';

export function PurseWidgetDemo() {
  return (
    <Sandpack
      template="vanilla"
      files={{
        '/index.html': `<script src="https://cdn.purse.tech/widget.js"></script>
<div id="purse-widget"></div>`,
        '/index.js': `const res = await fetch('https://usp-widget-merchant.purse-test.com/api/sessions/');
const { sessionId } = await res.json();

PurseWidget.init({ sessionId, container: '#purse-widget' });`
      }}
      options={{ editorHeight: 400 }}
    />
  );
}
```

**Bundler**

Sandpack uses CodeSandbox's bundler at `sandpack-bundler.codesandbox.io` by default — no setup required. The `bundlerURL` option is omitted unless you choose to self-host.

Self-hosting is optional and only worth it if you want to avoid the external dependency or need a fully controlled domain in your CSP. For <100 users on a public docs site, the default bundler is sufficient.

**Alfred integration**

The demo code calls `https://usp-widget-merchant.purse-test.com/api/sessions/` at runtime. Alfred must set CORS headers allowing the bundler origin:

```
Access-Control-Allow-Origin: https://sandpack-bundler.codesandbox.io
```

(Replace with your own subdomain if you self-host the bundler.)

**Session creation constraints**

None from the sandbox side. Alfred's rate-limiting and per-IP quotas are already in place.

**Security**

- Bundler iframe runs on `sandpack-bundler.codesandbox.io` — cross-origin from the docs page, strong isolation.
- No COOP/COEP required on `docs.purse.tech`.
- Alfred credentials never leave the Docker image.
- `docs.purse.tech` CSP must allow `frame-src https://sandpack-bundler.codesandbox.io` — confirmed adaptable.

---

### CodeSandbox SDK (Scale tier) — Secondary option

Full Linux VMs per sandbox. Useful if a demo needs to show real server-side code (e.g. a Node.js backend calling alfred,
not the browser calling it directly).

**Pricing**

| Plan         | Price       | Creations/hr | Concurrent VMs | Requests/hr |
|--------------|-------------|--------------|----------------|-------------|
| Build (free) | €0/month    | 20           | 10             | 1,000       |
| Scale        | ~€170/month | 1,000        | 250            | 10,000      |

- Additional VM cost: ~€0.015/hour (Nano VM, 2 vCPU / 4 GB RAM).
- 40 free VM hours/month on Build tier.
- At <100 concurrent users, Build tier may be sufficient to start.

**Editable demos**

The SDK embeds a full VS Code-like editor + live preview iframe. Edits reflect in the running VM.

**Alfred integration**

Same as Sandpack: the demo code calls `https://usp-widget-merchant.purse-test.com/api/sessions/`. The VM runs in a
MicroVM with its own network; alfred's CORS must allow the CodeSandbox preview subdomain.

**Session creation constraints**

- VM cold start: a few seconds. Use `preloadAllClients()` or lazy-load on hover to hide latency.
- Sandboxes are persistent and reusable — no VM creation on each page visit if the sandbox already exists.

**Security**

- MicroVM isolation — user-edited code cannot reach Purse infrastructure.
- No COOP/COEP required on the host page.
- Preview URLs use unique per-sandbox subdomains.

---

## Eliminated Solutions

| Solution                     | Reason                                                                                                                                                                                  |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **StackBlitz WebContainers** | Requires `COOP: same-origin` + `COEP: require-corp` on the host page. Even without 3DS today, this is a structural constraint that conflicts with any future cross-origin payment flow. |
| **CodePen / JSFiddle**       | No programmatic sandbox creation API. Demos must be manually authored and cannot be generated or parameterized. Frontend-only — cannot show server-side flows.                          |
| **Replit**                   | No on-demand sandbox creation API. Persistent containers billed by compute minute regardless of usage. No meaningful advantage over Sandpack for this use case.                         |

---

## Implementation Plan (Sandpack)

1. **Alfred CORS** — add `Access-Control-Allow-Origin: https://sandpack-bundler.codesandbox.io` to the `POST /api/sessions/` response on `usp-widget-merchant.purse-test.com`. Rate-limiting already in place. ✅
2. **Update `docs.purse.tech` CSP** — add `frame-src https://sandpack-bundler.codesandbox.io`.
3. **Create the Docusaurus component** `<PurseWidgetDemo />` — purely static, no SSR work.
4. **Use the component in MDX** pages for each integration mode example.

---

## Demo Cases — File Structure

Each integration mode in the docs gets its own demo case. A demo case is a plain TypeScript file that exports the set of
files Sandpack will load into the editor. It has no runtime dependency — it is just data.

**Location across repos**

```
purse-front-sdk-demo/                   ← demo source of truth
  demos/
    dropin.ts
    headless.ts
    hosted-fields.ts
    hosted-page.ts

usp-doc/                                ← Docusaurus root (synced from purse-front-sdk-demo)
  src/
    components/
      PurseWidgetDemo.tsx               ← Sandpack wrapper, shared by all demos
    demos/                              ← copied here on release
      dropin.ts
      headless.ts
      hosted-fields.ts
      hosted-page.ts
  docs/
    integrate/
      purse-checkout/
        integration-modes.mdx           ← imports and uses <PurseWidgetDemo />
```

**What a demo file looks like**

```ts
// src/demos/dropin.ts
import type { SandpackFiles } from '@codesandbox/sandpack-react';

export const dropinDemo: SandpackFiles = {
  '/index.html': {
    code: `<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.purse.tech/widget.js"></script>
  </head>
  <body>
    <div id="purse-widget"></div>
    <script src="./index.js" type="module"></script>
  </body>
</html>`,
    readOnly: false,
  },
  '/index.js': {
    code: `const { sessionId } = await fetch(
  'https://usp-widget-merchant.purse-test.com/api/sessions/'
).then(r => r.json());

PurseWidget.dropin({
  sessionId,
  container: '#purse-widget',
});`,
    readOnly: false,
  },
};
```

**How the wrapper component uses it**

```tsx
// src/components/PurseWidgetDemo.tsx
import { Sandpack } from '@codesandbox/sandpack-react';
import { dropinDemo } from '../demos/dropin';

export function PurseWidgetDemo({ files = dropinDemo }) {
  return (
    <Sandpack
      template="vanilla"
      files={files}
    />
  );
}
```

**Using it in an MDX doc page**

```mdx
import { PurseWidgetDemo } from '@site/src/components/PurseWidgetDemo';
import { dropinDemo } from '@site/src/demos/dropin';

## Drop-in integration

<PurseWidgetDemo files={dropinDemo} />
```

**Rules for demo files**

- One file per integration mode — no shared logic between demos. Each file must be self-contained so the user sees only
  what is relevant.
- `index.html` + `index.js` is the standard split. Add files only when the integration mode genuinely requires them (
  e.g. a `styles.css` for a headless demo).
- The `getSession` call is always the same URL and always at the top of `index.js` — do not abstract it, it is part of
  what the developer needs to understand.
- Mark files `readOnly: true` only for boilerplate the developer would never touch (e.g. a reset stylesheet). The
  session fetch and widget init should always be editable.

---

## Cross-repo Sync (purse-front-sdk-demo → usp-doc)

Demo files are authored in `purse-front-sdk-demo` and synced to `usp-doc` on release using the same mechanism already in
place for headless-checkout SDK references in `usp-widget` (`reusable-build-artifact-and-pr-target.yaml`).

**Sync trigger**

Add a `doc-sync.yaml` in `purse-front-sdk-demo`, triggered on its release tags:

```yaml
name: SYNC DOC
on:
  push:
    tags:
      - 'demos@[0-9]+.[0-9]+.[0-9]+'

jobs:
  sync-demos:
    uses: UpStreamPay/usp-widget/.github/workflows/reusable-build-artifact-and-pr-target.yaml@main
    with:
      target_repo: 'UpStreamPay/usp-doc'
      target_path: 'src/demos/'
      package_path: '.'
      package: 'demos'
      artifact_path: 'demos'
      artifact_name: 'purse-front-sdk-demos'
      pr_prefix: 'doc/purse-front-sdk-demo'
      command: 'echo "no build needed"'
    secrets:
      USP_GITHUB_ADMIN_ACCES_TOKEN: ${{ secrets.USP_GITHUB_ADMIN_ACCES_TOKEN }}
```

**What happens on release**

1. A tag `demos@x.x.x` is pushed in `purse-front-sdk-demo`.
2. The workflow uploads the `demos/` directory as an artifact (no build step needed — files are plain TS).
3. The reusable workflow checks out `usp-doc`, copies the artifact to `src/demos/`, and opens a draft PR titled
   `[purse-front-sdk-demo/demos] Doc sync @x.x.x`.
4. A reviewer merges it — demo code in the docs is in sync.

---

## References

- [Sandpack — Hosting the bundler](https://sandpack.codesandbox.io/docs/guides/hosting-the-bundler)
- [Sandpack — Advanced client](https://sandpack.codesandbox.io/docs/advanced-usage/client)
- [CodeSandbox SDK — Sessions](https://codesandbox.io/docs/sdk/sessions)
- [CodeSandbox SDK — Browser previews](https://codesandbox.io/docs/sdk/browser-previews)
- [CodeSandbox — SDK pricing](https://codesandbox.io/docs/sdk/pricing)
- [StackBlitz — COOP/COEP cross-browser](https://blog.stackblitz.com/posts/cross-browser-with-coop-coep/)
