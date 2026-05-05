# purse-front-sdk-demo

Demo apps for [`@purse-eu/web-sdk`](https://www.npmjs.com/package/@purse-eu/web-sdk). Two standalone Vite projects share a single `.env.local` at the repo root.

| Folder | Stack | What it demos |
|---|---|---|
| [`vanilla/`](./vanilla/) | Vite + TypeScript | Drop-in checkout, Headless checkout, Secure Fields tokenization |
| [`react/`](./react/) | React 19 + Vite + TypeScript | Secure Fields tokenization |

## Quick start

### 1. Credentials

```sh
cp .env.example .env.local
# Edit .env.local — fill in VITE_PURSE_TENANT_ID, VITE_PURSE_API_KEY, etc.
```

Both apps read env vars from the repo root `.env.local` (no separate env files needed in subfolders).

### 2. Run a demo

```sh
# Vanilla TypeScript — multi-page app
cd vanilla && npm install && npm run dev
# → http://localhost:5173

# React
cd react && npm install && npm run dev
# → http://localhost:5173
```

> If both run at the same time, Vite will auto-assign the second to port 5174.

## Environment variables

Defined in `.env.example`:

| Variable | Used by | Description |
|---|---|---|
| `VITE_PURSE_TENANT_ID` | Secure Fields | Tenant identifier |
| `VITE_PURSE_API_KEY` | Secure Fields, Headless | API key |
| `VITE_PURSE_ENTITY_ID` | Headless checkout, Drop-in | Entity identifier |
| `VITE_PURSE_SESSION_JSON` | Headless checkout, Drop-in | Base64 payment session JSON (local testing only) |
| `VITE_PURSE_ENVIRONMENT` | All | `sandbox` (default) or `production` |

In production, replace `getSession()` in each recipe with a fetch to your backend.

## Credential override without rebuild

Both apps expose a **⚙ Config / Debug** panel in the UI. Values entered there are stored in `localStorage` and take precedence over the `.env.local` build defaults — useful for testing multiple tenants without restarting the dev server.

## About Purse Vault Secure Fields

Secure Fields let you collect and tokenize sensitive payment data in isolated iframes, reducing PCI DSS scope. See [purse.eu](https://purse.eu) for full documentation.
