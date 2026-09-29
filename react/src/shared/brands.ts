const assetsBrandMapper: Record<string, string> = {
  AMERICAN_EXPRESS: "amex",
  MAESTRO: "maestro",
  MASTERCARD: "mastercard",
  VISA: "visa",
  CARTE_BANCAIRE: "cb",
  DINERS_CLUB: "diners-club",
  DISCOVER: "discover",
  JCB: "jcb",
};

// public/ is served at the app base (/react/ on the showcase), not at /public/.
export const brandLogo = (brand: string) => `${import.meta.env.BASE_URL}brands/${assetsBrandMapper[brand]}.svg`;
