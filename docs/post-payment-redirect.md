# Post-payment redirect for Sandpack demos

## Problem

When a payment completes in a Sandpack demo, the Purse SDK redirects the preview iframe to `shopper_redirection_url`. Previously this URL was `https://example.com`, so the preview went blank with no feedback and no way to restart the demo.

## Solution

Two moving parts work together:

### 1. `redirectionUrl` in `DemoConfig`

Each session-backed demo factory now accepts a `redirectionUrl` via `dynamicData`:

```ts
dropinDemo({ redirectionUrl: 'https://docs.purse.tech/docs/fake-confirmation-page' })
```

This value flows through `createDemo` and is stored on the `DemoConfig` object.

### 2. `PurseDemo` — two-step session creation

`PurseDemo.tsx` fetches a session in two steps:

1. **GET the order template** — `POST /orchestration_order` returns a base order object with all required fields pre-filled.
2. **Override `shopper_redirection_url`** — if `demo.redirectionUrl` is set, it replaces the URL on the order before the session is created.
3. **Create the session** — `POST /orchestration_session` with the (possibly modified) order as the request body.

```ts
const order = await fetch(VITE_PURSE_ORDER_URL, { method: 'POST' }).then(r => r.json());

if (demo.redirectionUrl) {
    order.shopper_redirection_url = demo.redirectionUrl;
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

This makes it work on any deployment (local dev at `localhost:3000`, staging, production) without hardcoding a URL in the package.

## Data flow

```
SandpackDemo.tsx (usp-doc)
  │  passes redirectionUrl = window.location.origin + '/docs/fake-confirmation-page'
  ▼
PurseDemo.tsx
  │  1. POST /orchestration_order  →  get base order object
  │  2. order.shopper_redirection_url = redirectionUrl
  │  3. POST /orchestration_session  { ...order }
  │
  │  usp-widget-merchant backend
  │  creates Purse API client session with shopper_redirection_url = redirectionUrl
  │  returns session JSON → injected as /session.json in Sandpack
  │
  │  User completes payment in Sandpack preview iframe
  │
  └─ SDK redirects iframe → redirectionUrl?purse-redirection-data=<JWS>
       └─ Iframe shows fake-confirmation-page → user sees decoded payment status
```

## Required backend change

The `usp-widget-merchant` service (repository: `usp-widget-merchant`) needs to read `shopper_redirection_url` from the POST body when present and pass it to the Purse API client session creation call.

```
POST /orchestration_session
Content-Type: application/json

{ "shopper_redirection_url": "https://docs.purse.tech/docs/fake-confirmation-page" }
```

Until this is deployed, the Sandpack preview will still navigate away to whatever URL the backend currently uses.

## Files changed

| File | Repo | Change |
|---|---|---|
| `sandpack/src/demos/types.ts` | purse-front-sdk-demo | Added `redirectionUrl?: string` to `DemoConfig` |
| `sandpack/src/demos/utils.ts` | purse-front-sdk-demo | `createDemo` accepts and forwards `redirectionUrl` |
| `sandpack/src/demos/*/index.ts` | purse-front-sdk-demo | All four session-backed factories accept `dynamicData.redirectionUrl` |
| `sandpack/src/PurseDemo.tsx` | purse-front-sdk-demo | Sends `redirectionUrl` in session POST body |
| `src/components/SandpackDemo.tsx` | usp-doc | Passes `redirectionUrl` derived from `window.location.origin` |
| `docs/fake-confirmation-page.mdx` | usp-doc | New unlisted page; decodes and displays `purse-redirection-data` JWT |
