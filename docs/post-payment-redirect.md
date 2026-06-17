# Post-payment redirect for Sandpack demos

## Problem

When a payment completes in a Sandpack demo, the Purse SDK redirects the preview iframe to `shopper_redirection_url`. Previously this URL was `https://example.com`, so the preview went blank with no feedback.

## Solution

Two moving parts work together:

### 1. `redirectionUrl` in `DemoConfig`

Each session-backed demo factory accepts a `redirectionUrl` via `dynamicData`:

```ts
dropinDemo({ redirectionUrl: 'https://docs.purse.tech/docs/fake-confirmation-page' })
```

This value flows through `createDemo` and is stored on the `DemoConfig` object.

### 2. `PurseDemo` — two-step session creation

`PurseDemo.tsx` fetches a session in two steps:

1. **Fetch the legacy order** — `GET /order` returns `{ order: <legacy order> }`, the same format alfred's `/orchestration_session` expects.
2. **Override `redirection`** — if `demo.redirectionUrl` is set, it replaces `order.order.redirection` before the session is created.
3. **Create the session** — `POST /orchestration_session` with the (possibly modified) legacy order as the request body.

```ts
const { order } = await fetch(VITE_PURSE_ORDER_URL).then(r => r.json()); // GET /order

if (demo.redirectionUrl) {
    order.order.redirection = demo.redirectionUrl;
}

const session = await fetch(VITE_PURSE_SESSION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
}).then(r => r.json());
```

After payment the SDK redirects the preview iframe to `shopper_redirection_url` instead of a dead URL.

### 3. `fake-confirmation-page` in `usp-doc`

`usp-doc/docs/fake-confirmation-page.mdx` is an unlisted Docusaurus page served at `/docs/fake-confirmation-page`. It:

- Reads the `purse-redirection-data` JWS query parameter appended by the Purse SDK after redirect
- Decodes the JWT payload and displays `authorization_status`, `payment_id`, `client_session_id`, and `client_session_status`
- Shows a green/red confirmation card based on the payment outcome
- Includes a note pointing to the signing JWKS endpoint for real signature verification

`SandpackDemo.tsx` (the usp-doc wrapper component) derives this URL at render time:

```ts
const redirectionUrl = `${window.location.origin}/docs/fake-confirmation-page`;
```

This makes it work on any deployment (local dev, staging, production) without hardcoding a URL in the package.

## Data flow

```
SandpackDemo.tsx (usp-doc)
  │  passes redirectionUrl = window.location.origin + '/docs/fake-confirmation-page'
  ▼
PurseDemo.tsx
  │  1. GET /order  →  { order: <legacy order> }
  │  2. order.order.redirection = redirectionUrl
  │  3. POST /orchestration_session  <legacy order>
  │
  │  alfred (usp-widget-merchant) calls fromLegacyOrder() on the body,
  │  maps order.order.redirection → shopper_redirection_url,
  │  creates Purse API client session, returns session JSON
  │  → injected as /session.json in Sandpack
  │
  │  User completes payment in Sandpack preview iframe
  │
  └─ SDK redirects iframe → redirectionUrl?purse-redirection-data=<JWS>
       └─ Iframe shows fake-confirmation-page → user sees decoded payment status
```

## Files changed

| File | Repo | Change |
|---|---|---|
| `sandpack/src/demos/types.ts` | purse-front-sdk-demo | Added `redirectionUrl?: string` to `DemoConfig` |
| `sandpack/src/demos/utils.ts` | purse-front-sdk-demo | `createDemo` accepts and forwards `redirectionUrl` |
| `sandpack/src/demos/*/index.ts` | purse-front-sdk-demo | All four session-backed factories accept `dynamicData.redirectionUrl` |
| `sandpack/src/PurseDemo.tsx` | purse-front-sdk-demo | `GET /order` → patch `order.order.redirection` → `POST /orchestration_session` |
| `sandpack/.env` | purse-front-sdk-demo | `VITE_PURSE_ORDER_URL` points to `/order` (was `/orchestration_order/`) |
| `.github/workflows/demos-publish.yaml` | purse-front-sdk-demo | Same URL update for CI build |
| `src/components/SandpackDemo.tsx` | usp-doc | Passes `redirectionUrl` derived from `window.location.origin` |
| `docs/fake-confirmation-page.mdx` | usp-doc | New unlisted page; decodes and displays `purse-redirection-data` JWT |
