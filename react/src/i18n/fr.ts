import type { MessageKey } from "./en";

export const fr: Record<MessageKey, string> = {
  "common.language": "Langue",
  "common.viewSource": "Voir le code",
  "common.allDemos": "← Toutes les démos",

  "landing.eyebrow": "Purse SDK",
  "landing.title": "Démos React",
  "landing.intro":
    "React 19 + <code>@purse-eu/web-sdk</code>. Renseignez vos identifiants dans le panneau de debug de chaque démo ou dans le <code>.env.local</code> à la racine du dépôt.",
  "landing.sf.title": "Tokenisation",
  "landing.sf.desc":
    "Champs carte en iframes via initSecureFields → vault_form_token. Sélecteur de marque séparé ou intégré. Aucune session de paiement nécessaire.",

  "sf.pageTitle": "Purse SDK — React · Secure Fields",
  "sf.eyebrow": "Purse SDK — Démos React",
  "sf.embeddedSelector": "Utiliser le sélecteur de marque intégré",
  "sf.cardNumber": "Numéro de carte",
  "sf.cvv": "CVV",
  "sf.expiry": "Date d’expiration",
  "sf.holder": "Nom du titulaire",
  "sf.placeholder.exp": "MM/AA",
  "sf.placeholder.holder": "Nom du titulaire",
  "sf.submit": "Valider le paiement",
  "sf.brand.single": "Votre paiement sera traité avec",
  "sf.brand.pick": "Choisissez la marque de votre carte :",
  "sf.brand.legend": "Marque de la carte",
  "sf.result.error": "Erreur de tokenisation :",
  "sf.result.success": "Tokenisation réussie !",
  "sf.result.token": "Token :",
  "sf.result.bin": "BIN :",
  "sf.result.last4": "4 derniers chiffres :",
  "sf.result.brands": "Marques détectées :",

  "panel.title": "Configuration de debug",
  "panel.toggle": "⚙ Config",
  "panel.resetAll": "Tout réinitialiser",
  "panel.reload": "⟳ Recharger",
  "panel.resetOne": "Revenir à la valeur .env",
  "panel.default": "défaut :",
  "panel.local": "local",
  "panel.env": "env",
  "panel.label.tenant": "Tenant ID",
  "panel.label.apiKey": "API Key",
  "panel.hint.secureFields": "pour Secure Fields",
};
