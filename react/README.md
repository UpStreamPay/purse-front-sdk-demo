# Purse SDK — React Demo

React 19 + Vite app demonstrating `@purse-eu/web-sdk`. Two pages:

| Page | URL | What it demos |
|---|---|---|
| Tokenize | `/` | Secure Fields tokenization |
| 3DS fingerprint | `/threeds.html` | The 3DS device fingerprint, instrumented and animated |

## Setup

```sh
# From repo root — create and fill in credentials
cp .env.example .env.local

# Install and run
cd react
npm install
npm run dev
# → http://localhost:5173
```

> `.env.local` must be at the **repo root** (not inside `react/`). Vite is configured to read env vars from `../`.

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `VITE_PURSE_SECUREFIELDS_TENANT_ID` | both pages | Tenant identifier |
| `VITE_PURSE_API_KEY` | both pages | API key for Secure Fields |
| `VITE_PURSE_PROXY_URL` | 3DS page | Merchant backend (Alfred) proxying the Payment API v2 routes |
| `VITE_PURSE_ENTITY_ID` | 3DS page | Scopes the v2 calls; omit to use the proxy's default entity |
| `VITE_PURSE_ENVIRONMENT` | both pages | `sandbox` (default), `test`, or `production` |

## What's in here

Single-page app with one demo:

**Secure Fields — tokenization**
- Mounts isolated card-field iframes via `getSecureFields()` from `@purse-eu/web-sdk`
- Toggle between standalone brand selector and embedded brand selector (co-brand support)
- On submit, returns a `vault_form_token` you pass to your backend
- No payment session required — tokenizes at tenant level

### Key files

| File | Description |
|---|---|
| `src/securefields/PaymentForm.tsx` | Main form — mounts Secure Fields, handles submit |
| `src/securefields/BrandSelector.tsx` | Co-brand selector component |
| `src/securefields/TokenizationResultDisplay.tsx` | Displays the returned token |
| `src/shared/DebugPanel.tsx` | In-app config panel — set credentials without rebuild |

Env handling is shared with the vanilla app: `@shared/*` is aliased to
`../vanilla/src/shared/*` (see `vite.config.ts`), so `env.ts` and `proxy.ts`
have one copy rather than two.

---

## 3DS fingerprint showcase — `/threeds.html`

Runs a real Payment API v2 payment and makes the normally-invisible 3DS device
fingerprint watchable: an animated timeline, the decoded `threeDSMethodData`,
and a live network / postMessage trace.

### Why it is built the way it is

`@purse-eu/web-sdk@0.10.0` exposes **no 3DS API** — `securefields.d.ts` has no
`threeDS` config member, no `threeDSServerTransID` on `SubmitResult`, and no 3DS
entry in `SecureFieldsEvents`. Versioning and the fingerprint are performed by
the runtime loaded from `cdn.purse-test.com`, which is not part of this repo.

So the page observes the browser instead (`src/threeds/probe.ts`): patched
`fetch`/`XHR`, a capture-phase `message` listener, a `MutationObserver` for the
injected iframe and form, and a `PerformanceObserver` for the ACS resource load.
The probe installs in `main.tsx` **before** the SDK loads — patch it after and
the CDN bundle has already captured the originals.

Nothing is narrated. A step with no evidence renders as *not observable*, never
as done.

Two safeguards, because the trace goes on a projector: request bodies are
recursively redacted by key (card number, CVV, API key, Authorization…), and
secret query parameters are stripped — the versioning call is made as
`…/3ds/versioning?api-key=<key>`.

### Requirements

- **`test` environment.** The 3DS chain exists only in the `test` Secure Fields
  build; `cdn.purse-sandbox.com` has no versioning endpoint. The page therefore
  defaults itself to `test` in `src/threeds/config.ts` rather than through
  `VITE_PURSE_ENVIRONMENT`, which is global and would break the headless and
  drop-in demos (they have no `test` CDN entry).
- **A merchant backend on the matching environment**, via `VITE_PURSE_PROXY_URL`.
- **A 3DS-enrolled card whose range advertises a 3DS Method URL.** Without one,
  versioning returns no Method URL and the fingerprint step correctly reports
  that no frame appeared.

### Presenting it

- **Arm "Reveal the hidden frame" _before_ paying.** The SDK tears the
  `purse-3ds-method` frame down a few seconds after the fingerprint completes,
  so there is nothing left to reveal afterwards. Armed first, the 0×0
  `display:none` iframe is forced on screen the moment it is inserted.
- **Presenter mode** enlarges type and dims chrome for a projector.
- **Restart** clears the probe log so a second run starts from nothing.

### Key files

| File | Description |
|---|---|
| `src/threeds/probe.ts` | Instrumentation, redaction, `threeDSMethodData` decoding, `selfCheck()` |
| `src/threeds/steps.ts` | Pure derivation of the timeline from the probe log |
| `src/threeds/ThreeDSDemo.tsx` | Layout and flow orchestration |
| `src/threeds/Timeline.tsx` · `PayloadInspector.tsx` · `Trace.tsx` | The three x-ray panels |
| `src/threeds/secureFields.ts` | Secure Fields boot with the (untyped) `threeDS` option |
| `src/threeds/config.ts` | Environment resolution and the debug-panel key list |

### Tests

There is no test runner in this repo. The two pieces of non-trivial pure logic —
the redactor and the `threeDSMethodData` decoder — assert themselves via
`probe.selfCheck()`, called from `main.tsx` under `import.meta.env.DEV`. A
regression throws on page load in dev rather than leaking a card number.

## Credential override without rebuild

Open the **⚙ Config** panel in the running app and enter the values. They persist in `localStorage` and override the build defaults immediately. Each page shows only the keys it actually reads.

## Other commands

```sh
npm run build    # production build → dist/
npm run preview  # preview production build locally
npm run lint     # ESLint
npm run format   # Prettier
```
