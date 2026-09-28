# Purse SDK — Vanilla TypeScript Demos

Multi-page Vite app demonstrating `@purse-eu/web-sdk` integration patterns.

## Setup

```sh
# From repo root — create and fill in credentials
cp .env.example .env.local

# Install and run
cd vanilla
npm install
npm run dev
# → http://localhost:5173
```

> `.env.local` must be at the **repo root** (not inside `vanilla/`). Vite is configured to read env vars from `../`.

## Environment variables

| Variable | Required by | Description |
|---|---|---|
| `VITE_PURSE_SESSION_JSON` | Drop-in, Headless checkout | Static base64 session — wins over `VITE_PURSE_PROXY_URL` when set |
| `VITE_PURSE_TENANT_ID` | Secure Fields | Tenant identifier |
| `VITE_PURSE_API_KEY` | Secure Fields | API key for Secure Fields |
| `VITE_PURSE_PROXY_URL` | Drop-in, Headless checkout, Advanced Flow | Merchant backend (Alfred). Creates a fresh session per page load (`/order/` → `/orchestration_session/`) and proxies the Payment API v2 endpoints |
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
| `/headless-checkout/express-checkout.html` | `src/headless-checkout/express-checkout.ts` | One-click "Buy now" from a product page into an express bottom sheet. Pays with the session's saved card (`paymentTokens`) in one tap, or falls back to a card sheet built with `getHostedFields()` and an optional save-card (`register`) checkbox. |

### Secure Fields

| Page | Entry point | Description |
|---|---|---|
| `/securefields/tokenize.html` | `src/securefields/tokenize.ts` | Tokenises card data at tenant level — no payment session required. Returns a `vault_form_token` to pass to your backend. |

### Advanced Flow

| Page | Entry point | Description |
|---|---|---|
| `/advanced-flow/complete-payment.html` | `src/advanced-flow/complete-payment.ts` | Drives the raw [Payment API v2 complete-payment flow](https://docs.purse.tech/docs/integrate/purse-api/additional-features/advanced-flow/complete-payment-flow): `eligible_solutions` → Secure Fields card form → `create_payment` (with optional `save_token`). The v2 endpoints are proxied by a merchant backend (`VITE_PURSE_PROXY_URL`) since they require a server-side bearer token. |

## Shared utilities

- `src/shared/session.ts` — a pasted `VITE_PURSE_SESSION_JSON` wins (normalises base64 padding), else creates a session through the proxy
- `src/shared/ui.ts` — `$()` helper, `setStep()`, `showNotice()`, `showResult()`
