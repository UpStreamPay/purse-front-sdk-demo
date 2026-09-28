// English — the reference dictionary; fr.ts is typed against these keys, so a
// missing translation fails tsc. Strings rendered as markup may carry <code>.
export const en = {
  "common.language": "Language",
  "common.viewSource": "View source",
  "common.allDemos": "← All demos",

  "landing.eyebrow": "Purse SDK",
  "landing.title": "React demos",
  "landing.intro":
    "React 19 + <code>@purse-eu/web-sdk</code>. Set credentials in each demo's Debug panel or in the repo-root <code>.env.local</code>.",
  "landing.sf.title": "Tokenize",
  "landing.sf.desc":
    "Card-field iframes via initSecureFields → vault_form_token. Standalone or embedded co-brand selector. No payment session required.",

  "sf.pageTitle": "Purse SDK — React · Secure Fields",
  "sf.eyebrow": "Purse SDK — React demos",
  "sf.embeddedSelector": "Use Embedded Brand Selector",
  "sf.cardNumber": "Card Number",
  "sf.cvv": "CVV",
  "sf.expiry": "Expiry Date",
  "sf.holder": "Card Holder Name",
  "sf.placeholder.exp": "MM/YY",
  "sf.placeholder.holder": "Card Holder Name",
  "sf.submit": "Submit Payment",
  "sf.brand.single": "Your payment will be processed with",
  "sf.brand.pick": "Please select your preferred card brand:",
  "sf.brand.legend": "Select card brand",
  "sf.result.error": "Tokenization Error:",
  "sf.result.success": "Tokenization Successful!",
  "sf.result.token": "Token:",
  "sf.result.bin": "Bin:",
  "sf.result.last4": "Last 4:",
  "sf.result.brands": "Detected Brands:",

  "panel.title": "Debug Config",
  "panel.toggle": "⚙ Config",
  "panel.resetAll": "Reset all",
  "panel.reload": "⟳ Reload",
  "panel.resetOne": "Reset to .env value",
  "panel.default": "default:",
  "panel.local": "local",
  "panel.env": "env",
  "panel.label.tenant": "Tenant ID",
  "panel.label.apiKey": "API Key",
  "panel.hint.secureFields": "for Secure Fields",
} as const;

export type MessageKey = keyof typeof en;
