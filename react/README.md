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

Multi-page Vite app. `/` is a landing page listing the demos (`src/Landing.tsx`); each demo lives in its own folder with an `index.html` registered in `vite.config.ts`.

**Secure Fields — tokenization** (`/securefields/`)
- Mounts isolated card-field iframes via `getSecureFields()` from `@purse-eu/web-sdk`
- Toggle between standalone brand selector and embedded brand selector (co-brand support)
- On submit, returns a `vault_form_token` you pass to your backend
- No payment session required — tokenizes at tenant level

### Key files

| File | Description |
|---|---|
| `src/Landing.tsx` | Landing page — add an entry to `DEMOS` for each new demo |
| `src/securefields/SecureFieldsPage.tsx` | Secure Fields page — brand-selector toggle + form |
| `src/securefields/PaymentForm.tsx` | Main form — mounts Secure Fields, handles submit |
| `src/securefields/BrandSelector.tsx` | Co-brand selector component |
| `src/securefields/TokenizationResultDisplay.tsx` | Displays the returned token |
| `src/shared/env.ts` | Reads env vars; falls back to `localStorage` overrides |
| `src/shared/DebugPanel.tsx` | In-app config panel — set credentials without rebuild |

## Languages (i18n)

English and French, switched by the locale picker in each page header (stored under `purse_demo_locale`, shared with the vanilla app). Dictionaries are `src/i18n/en.ts` (reference) and `src/i18n/fr.ts` (typed against it); components call `t('key')`. Same model as the vanilla app — see `vanilla/README.md`.

## Credential override without rebuild

Open the **Debug** panel in the running app and enter `VITE_PURSE_TENANT_ID` / `VITE_PURSE_API_KEY`. Values persist in `localStorage` and override the build defaults immediately.

## Other commands

```sh
npm run build    # production build → dist/
npm run preview  # preview production build locally
npm run lint     # ESLint
npm run format   # Prettier
```
