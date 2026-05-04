# Purse SDK — Vanilla TypeScript Demos

Multi-page Vite app demonstrating `@purse-eu/web-sdk` integration patterns.

## Setup

```sh
cp .env.example .env.local   # fill in your credentials
npm install
npm run dev                  # http://localhost:5173
```

## Environment variables

| Variable | Required by | Description |
|---|---|---|
| `VITE_PURSE_SESSION_JSON` | Drop-in, Headless checkout | Base64 session token from your backend |
| `VITE_PURSE_TENANT_ID` | Secure Fields | Tenant identifier |
| `VITE_PURSE_API_KEY` | Secure Fields | API key for Secure Fields |
| `VITE_PURSE_ENVIRONMENT` | All | `sandbox` (default) or `production` |

In production, replace `getSession()` in each recipe with a fetch to your backend API that creates and returns a payment session.

## Demos

### Drop-in

| Page | Entry point | Description |
|---|---|---|
| `/dropin/widget.html` | `src/dropin/widget.ts` | Pre-built checkout widget via `createDropinCheckout()`. Minimal integration — mount, react to `isPaymentFulfilled`, call `submitPayment()`. |

### Headless checkout

| Page | Entry point | Description |
|---|---|---|
| `/headless-checkout/render-methods.html` | `src/headless-checkout/render-methods.ts` | Lists all payment methods from the session. Clicking one mounts a hosted form via `getPaymentElement()`. |
| `/headless-checkout/hosted-form.html` | `src/headless-checkout/hosted-form.ts` | Single-iframe form via `getPaymentElement(PaymentElementOptions)` with full label/error/theme customisation. |
| `/headless-checkout/hosted-fields.html` | `src/headless-checkout/hosted-fields.ts` | Isolated per-field iframes via `getHostedFields()`. Switch between grid, single-line, and card-shaped layouts — same iframes reflow via CSS. Includes brand detection and co-brand selection. |

### Secure Fields

| Page | Entry point | Description |
|---|---|---|
| `/securefields/tokenize.html` | `src/securefields/tokenize.ts` | Tokenises card data at tenant level — no payment session required. Returns a `vault_form_token` to pass to your backend. |

## Shared utilities

- `src/shared/session.ts` — reads `VITE_PURSE_SESSION_JSON`, normalises base64 padding
- `src/shared/ui.ts` — `$()` helper, `setStep()`, `showNotice()`, `showResult()`
