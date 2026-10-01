# Purse SDK · React Demo

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
| `VITE_PURSE_SECUREFIELDS_TENANT_ID` | Tenant identifier |
| `VITE_PURSE_API_KEY` | API key for Secure Fields |
| `VITE_PURSE_ENVIRONMENT` | `sandbox` (default) or `production` |

## What's in here

Multi-page Vite app. `/` is a landing page listing the demos (`src/Landing.tsx`, cards from the repo-root `demos.json`); each demo lives in its own folder with an `index.html` registered in `vite.config.ts`.

**Secure Fields · form variations** (`/securefields/`)
- Four card-form layouts (stacked, classic, hybrid, inline) plus a UI customizer (radius, icons, gray shade, floating labels, dark mode, embedded brand selector, error preview). Settings are kept in the URL, so a configured form is a shareable link
- One `initSecureFields()` instance at a time: switching layout re-creates it in the new containers (`useSecureFields.ts`)
- Labels, borders, icons and errors are React around the fields, driven by their `focus` / `blur` / `change` events (length + validity, never the value)
- Co-badged cards: brand picked in the page (`brandDetected` → `submit({ selectedNetwork })`) or by the SDK's embedded selector
- Submit tokenizes the card and shows the `vault_form_token` (plus BIN / last 4 / brands) under the button. No payment session required

### Known SDK limitations

- **Embedded brand selector logo is clipped in tall fields.** The badge follows the iframe height, then is cropped to 36px wide.
- **The embedded brand selector only fits light forms.** Its badges have a white background, and `styles.input.backgroundColor` is ignored. The demo turns the stacked card-number row white while it is on, and disables it in dark mode.

### Key files

| File | Description |
|---|---|
| `src/Landing.tsx` | Landing page; cards come from the repo-root `demos.json` |
| `src/securefields/SecureFieldsPage.tsx` | Page, UI customizer, layout tabs, submit |
| `src/securefields/useSecureFields.ts` | Mounts Secure Fields, tracks field / brand state, tokenizes |
| `src/securefields/layouts.tsx` / `Field.tsx` | The four layouts and the field shell around each iframe |
| `src/securefields/BrandSelector.tsx` | Co-brand selector component |
| `src/securefields/TokenizationResultDisplay.tsx` | Displays the returned token |
| `src/shared/env.ts` | Reads env vars; falls back to `localStorage` overrides |
| `src/shared/DebugPanel.tsx` | In-app config panel to set credentials without rebuild |

## Languages (i18n)

English and French, switched by the locale picker in each page header (stored under `purse_demo_locale`, shared with the vanilla app). Dictionaries are `src/i18n/en.ts` (reference) and `src/i18n/fr.ts` (typed against it); components call `t('key')`. Same model as the vanilla app (see `vanilla/README.md`).

## Credential override without rebuild

Open the **Debug** panel in the running app and enter `VITE_PURSE_SECUREFIELDS_TENANT_ID` / `VITE_PURSE_API_KEY`. Values persist in `localStorage` and override the build defaults immediately.

## Other commands

```sh
npm run build    # production build → dist/
npm run preview  # preview production build locally
npm run lint     # ESLint
npm run format   # Prettier
```
