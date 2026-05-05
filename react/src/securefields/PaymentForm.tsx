import { InlineBrandSelector } from "./BrandSelector.tsx";

import { useEffect, useRef, useState } from "react";
import { TokenizationResultDisplay } from "./TokenizationResultDisplay.tsx";
import { loadSecureFields, type Securefields } from "@purse-eu/web-sdk";
import { getEnv } from "../shared/env";

export const PaymentForm = ({
  embeddedBrandSelector,
}: {
  embeddedBrandSelector?: boolean;
}) => {
  const [brands, setBrands] = useState<Securefields.Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Securefields.Brand | null>(null);
  const [tokenizationResult, setTokenizationResult] =
    useState<Securefields.SubmitResult | null>(null);

  const cardNumberRef = useRef<HTMLDivElement | null>(null);
  const cvvRef = useRef<HTMLDivElement | null>(null);
  const expDateRef = useRef<HTMLDivElement | null>(null);
  const holderNameRef = useRef<HTMLDivElement | null>(null);
  const securefields = useRef<Securefields.SecureFieldsClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadSecureFields('sandbox').then(({ initSecureFields }) => {
      if (cancelled) return;
      return initSecureFields({
        tenantId: getEnv("VITE_PURSE_TENANT_ID"),
        apiKey: getEnv("VITE_PURSE_API_KEY"),
        config: {
          brands: [
            "CARTE_BANCAIRE",
            "VISA",
            "MASTERCARD",
            "AMERICAN_EXPRESS",
            "MAESTRO",
          ],
          brandSelector: embeddedBrandSelector,
          fields: {
            cardNumber: {
              target: "card-number-target",
              placeholder: "1234 5678 9012 3456",
            },
            cvv: {
              target: "cvv-target",
              placeholder: "123",
            },
            expDate: {
              target: "expDate-target",
              placeholder: "MM/YY",
            },
            holderName: {
              target: "holder-name-target",
              placeholder: "Card Holder Name",
            },
          },
          styles: {
            input: {
              placeholderColor: "#9CA3AF",
            },
          },
        },
      });
    }).then((sf) => {
      if (!sf || cancelled) return;
      securefields.current = sf;
      sf.on("ready", () => {
        console.log("Secure fields are ready");
      });
      sf.on("brandDetected", (event) => {
        setBrands(event.brands ?? []);
        setSelectedBrand((prev) => prev ?? event.brands?.[0] ?? null);
      });
      sf.render();
    });

    return () => {
      cancelled = true;
      securefields.current?.destroy();
      securefields.current = null;
      setBrands([]);
      setSelectedBrand(null);
    };
  }, [embeddedBrandSelector]);

  return (
    <div>
      <label
        htmlFor="card-number"
        className="block text-sm font-medium text-gray-700"
      >
        Card Number
      </label>
      <div
        id="card-number"
        className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 "
      >
        <div id="card-number-target" ref={cardNumberRef} className="h-8"></div>
      </div>
      {!embeddedBrandSelector && (
        <InlineBrandSelector
          brands={brands}
          selectedBrand={selectedBrand}
          onChange={setSelectedBrand}
        />
      )}

      <label
        htmlFor="cvv"
        className="block text-sm font-medium text-gray-700 mt-4"
      >
        CVV
      </label>
      <div
        id="cvv"
        className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 "
      >
        <div id="cvv-target" ref={cvvRef} className="h-8"></div>
      </div>
      <label
        htmlFor="expiry-date"
        className="block text-sm font-medium text-gray-700 mt-4"
      >
        Expiry Date
      </label>
      <div
        id="expiry-date"
        className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 "
      >
        <div id="expDate-target" ref={expDateRef} className="h-8"></div>
      </div>
      <label
        htmlFor="holder-name"
        className="block text-sm font-medium text-gray-700 mt-4"
      >
        Card Holder Name
      </label>
      <div
        id="holder-name"
        className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 "
      >
        <div id="holder-name-target" ref={holderNameRef} className="h-8"></div>
      </div>

      <button
        type="submit"
        className="mt-6 w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        onClick={() => {
          setTokenizationResult(null);
          if (!securefields.current) return;
          securefields.current
            .submit(selectedBrand ? { selectedNetwork: selectedBrand } : undefined)
            .then((result) => {
              setTokenizationResult(result);
            })
            .catch((err: unknown) => {
              setTokenizationResult({ error: err instanceof Error ? err.message : String(err) });
            });
        }}
      >
        Submit Payment
      </button>

      {tokenizationResult && (
        <TokenizationResultDisplay tokenizationResult={tokenizationResult} />
      )}
    </div>
  );
};
