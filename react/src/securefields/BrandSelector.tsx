import type { Securefields } from "@purse-eu/web-sdk";
type CardBrand = Securefields.Brand;

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

export const InlineBrandSelector = ({
  brands,
  selectedBrand,
  onChange,
}: {
  brands: Array<CardBrand>;
  selectedBrand: CardBrand | null;
  onChange?: (brand: CardBrand) => void;
}) => {
  if (!brands || brands.length === 0) return null;

  if (brands.length === 1) {
    // Only one brand, just show the icon
    return (
      <div className="flex px-4 py-2 items-center text-sm text-gray-600">
        <span id="brand-label">Your payment will be processed with</span>
        <span
          aria-label={brands[0]}
          title={brands[0]}
          className="ml-2 flex items-center"
        >
          <img
            src={`/public/brands/${assetsBrandMapper[brands[0]]}.svg`}
            alt={brands[0]}
            className="h-6 w-9 inline-block"
          />
          <span className="sr-only">{brands[0]}</span>
        </span>
      </div>
    );
  }

  // Multiple brands: render as a radio group
  return (
    <div className="flex px-4 py-2 items-center text-sm text-gray-600">
      <span id="brand-label">Please select your preferred card brand:</span>
      <fieldset
        style={{ border: "none", padding: 0, margin: 0 }}
        aria-labelledby="brand-label"
      >
        <legend className="sr-only">Select card brand</legend>
        <div
          role="radiogroup"
          aria-labelledby="brand-label"
          className="flex space-x-4 ml-4"
        >
          {brands.map((brand) => (
            <label
              key={brand}
              className={`${selectedBrand === brand ? "outline-blue-500 outline-2" : ""} cursor-pointer flex flex-col items-center focus-within:outline focus-within:outline-blue-500 focus-within:outline-2`}
            >
              <input
                type="radio"
                name="card-brand"
                value={brand}
                checked={selectedBrand === brand}
                aria-checked={selectedBrand === brand}
                aria-label={brand}
                tabIndex={selectedBrand === brand ? 0 : -1}
                onChange={() => onChange?.(brand)}
                className="sr-only"
              />
              <img
                src={`/public/brands/${assetsBrandMapper[brand]}.svg`}
                alt={brand}
                className="h-6 w-9 hover:shadow-lg"
              />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
};
