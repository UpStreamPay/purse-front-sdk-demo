# Purse SDK — React Demo

React 19 + Vite app demonstrating `@purse-eu/web-sdk` Secure Fields integration.

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

| Variable | Description |
|---|---|
| `VITE_PURSE_TENANT_ID` | Tenant identifier |
| `VITE_PURSE_API_KEY` | API key for Secure Fields |
| `VITE_PURSE_ENVIRONMENT` | `sandbox` (default) or `production` |

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
| `src/shared/env.ts` | Reads env vars; falls back to `localStorage` overrides |
| `src/shared/DebugPanel.tsx` | In-app config panel — set credentials without rebuild |

## Credential override without rebuild

Open the **Debug** panel in the running app and enter `VITE_PURSE_TENANT_ID` / `VITE_PURSE_API_KEY`. Values persist in `localStorage` and override the build defaults immediately.

## Other commands

```sh
npm run build    # production build → dist/
npm run preview  # preview production build locally
npm run lint     # ESLint
npm run format   # Prettier
```
