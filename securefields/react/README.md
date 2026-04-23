# Purse Secure Fields React Showcase

A minimal React + Vite + Tailwind demo showing how to integrate Purse Vault Secure Fields for card tokenization.

## Features

- Secure, PCI-scope reducing card data collection via Purse Secure Fields iframe injection
- Toggle between embedded brand selector (automatic) and manual inline selector
- Dynamic detection of card brands and display of tokenization results
- Simple styling customization (placeholders, input theming)

## Tech Stack

- React 19 + Vite
- TypeScript (strict)
- Tailwind CSS (via `@tailwindcss/vite`)
- Purse Web SDK (`@purse-eu/web-sdk`) + hosted Secure Fields script

## Quick Start

### 1. Clone & Install

```bash
git clone <your-fork-or-repo-url>
cd purse-securefields-react-demo/react
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `react/` folder (same level as `package.json`):

```bash
VITE_PURSE_TENANT_ID=your_tenant_id
VITE_PURSE_API_KEY=your_public_api_key
```

See `.env.example` for the template. Use test credentials provided by Purse; never commit production secrets.

### 3. Run Dev Server

```bash
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

### 4. Build for Production

```bash
npm run build
npm run preview
```

## Secure Fields Integration Overview

The core integration lives in `src/paymentForm/PaymentForm.tsx`.

### Initialization

Secure Fields are initialized via the hosted ES module:

```ts
import { initSecureFields } from "https://cdn.purse-dev.com/secure-fields/latest/purse.esm.js?module";

await initSecureFields({
  tenantId: import.meta.env.VITE_PURSE_TENANT_ID,
  apiKey: import.meta.env.VITE_PURSE_API_KEY,
  config: {
    brands: [
      "CARTE_BANCAIRE",
      "VISA",
      "MASTERCARD",
      "AMERICAN_EXPRESS",
      "MAESTRO",
    ],
    brandSelector: embeddedBrandSelector, // toggled in App
    fields: {
      cardNumber: {
        target: "card-number-target",
        placeholder: "1234 5678 9012 3456",
      },
      cvv: { target: "cvv-target", placeholder: "123" },
      expDate: { target: "expDate-target", placeholder: "MM/YY" },
      holderName: {
        target: "holder-name-target",
        placeholder: "Card Holder Name",
      },
    },
    styles: { input: { placeholderColor: "#9CA3AF" } },
  },
});
```

The library injects PCI-sensitive inputs inside isolated iframes, returning only a vaulted token to your app.

### Brand Selection Modes

- Embedded (`brandSelector: true`): Purse handles brand selection UI inside the secure field.
- Manual (`brandSelector: false`): App renders `InlineBrandSelector` (see `BrandSelector.tsx`) with accessible radio
  buttons and brand logos from `public/brands/`.

### Tokenization Flow

1. User enters card data into secure iframes (never reaches your JS runtime).
2. Form submit triggers `securefields.submit()`.
3. Response (`SubmitResult`) contains `vault_form_token`, card metadata (BIN, last four, detected brands) or an error.
4. Display logic lives in `TokenizationResultDisplay.tsx`.

### Styling

You can adjust:

- Placeholders (per field)
- Colors via `styles.input.placeholderColor`
  Further advanced styling (focus, error states) can be set via the Secure Fields configuration—refer to Purse docs for
  full schema.

## File Map

- `src/App.tsx`: Demo shell + toggle for brand selector mode.
- `src/paymentForm/PaymentForm.tsx`: Secure Fields setup + submit handling.
- `src/paymentForm/BrandSelector.tsx`: Accessible inline brand chooser.
- `src/paymentForm/TokenizationResultDisplay.tsx`: Success/error rendering.
- `public/brands/*.svg`: Card brand assets.

## Environment Variables

| Name                   | Description                    | Required |
| ---------------------- | ------------------------------ | -------- |
| `VITE_PURSE_TENANT_ID` | Your Purse tenant identifier   | Yes      |
| `VITE_PURSE_API_KEY`   | Public API key for browser use | Yes      |

(These are exposed to the client via Vite—use only public/test keys.)

## Security Notes

- Never log full PAN, CVV, or expiry—Secure Fields prevents access by design.
- Treat the returned `vault_form_token` as sensitive; transmit it server-side over TLS.
- Use distinct API keys for test vs production.

## Accessibility

- Custom toggle switch for embedded brand selector implements keyboard activation (Space/Enter) and ARIA roles.
- Brand selector radio group uses `fieldset`, `legend`, and `aria-labelledby` for screen reader clarity.

## Troubleshooting

| Issue                       | Possible Cause                   | Fix                                                   |
| --------------------------- | -------------------------------- | ----------------------------------------------------- |
| Secure fields not appearing | Missing env vars                 | Check `.env` matches names above.                     |
| Brand logos broken          | Incorrect asset path             | Ensure `/public/brands/` SVG names match mapper keys. |
| Tokenization error          | Invalid test card data or config | Use valid test card numbers provided by Purse.        |
| CORS / network errors       | Wrong tenant or API key          | Verify values & environment (test vs prod).           |

---
