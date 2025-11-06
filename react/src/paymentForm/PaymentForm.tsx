import { type CardBrand, type SubmitResult } from "@purse-eu/web-sdk";
import { InlineBrandSelector } from "./BrandSelector.tsx";
import {
  type SecureFieldsClient,
  type SecureFieldsConfig,
} from "@purse-eu/web-sdk";

import { initSecureFields as moduleInitSecureFields } from "https://cdn.purse-dev.com/secure-fields/latest/purse.esm.js?module";
import { useEffect, useRef, useState } from "react";
import { TokenizationResultDisplay } from "./TokenizationResultDisplay.tsx";

export const PaymentForm = ({
  embeddedBrandSelector,
}: {
  embeddedBrandSelector?: boolean;
}) => {
  const [brands, setBrands] = useState<CardBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<CardBrand | null>(null);
  const [tokenizationResult, setTokenizationResult] =
    useState<SubmitResult | null>(null);

  const cardNumberRef = useRef<HTMLDivElement | null>(null);
  const cvvRef = useRef<HTMLDivElement | null>(null);
  const expDateRef = useRef<HTMLDivElement | null>(null);
  const holderNameRef = useRef<HTMLDivElement | null>(null);
  const securefields = useRef<SecureFieldsClient | null>(null);

  const initSecureFields = async () => {
    moduleInitSecureFields({
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
            placeholderColor: "#9CA3AF", // Tailwind Gray-400
          },
        },
      } satisfies SecureFieldsConfig,
    }).then((sf) => {
      securefields.current = sf;
      securefields.current.on("ready", () => {
        console.log("Secure fields are ready");
      });
      securefields.current.on("brandDetected", (event) => {
        setBrands(event.brands);
        if (!selectedBrand && event.brands.length > 0) {
          setSelectedBrand(event.brands[0]);
        }
      });
      securefields.current.render();
    });
  };

  const cleanupSecureFields = () => {
    setBrands([]);
    setSelectedBrand(null);

    return () => {
      console.log("Cleaning up secure fields");
      securefields.current?.destroy();
      if (cardNumberRef.current) {
        cardNumberRef.current.innerHTML = "";
      }
      if (cvvRef.current) {
        cvvRef.current.innerHTML = "";
      }
      if (expDateRef.current) {
        expDateRef.current.innerHTML = "";
      }
      if (holderNameRef.current) {
        holderNameRef.current.innerHTML = "";
      }
    };
  };
  useEffect(() => {
    initSecureFields();
    return cleanupSecureFields();
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
        onClick={async () => {
          setTokenizationResult(null);
          if (securefields.current) {
            securefields.current
              .submit({
                selectedNetwork: selectedBrand,
              })
              .then((result) => {
                console.log("Submit");
                setTokenizationResult(result);
              })
              .catch((err) => {
                console.log("Submit");
                setTokenizationResult({ error: err } as any);
              });
          }
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
