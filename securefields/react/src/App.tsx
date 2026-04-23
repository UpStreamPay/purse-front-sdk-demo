import { PaymentForm } from "./paymentForm/PaymentForm.tsx";
import { useState } from "react";

function App() {
  const [embeddedBrandSelector, setEmbeddedBrandSelector] = useState(false);
  return (
    <main className="min-h-screen w-screen  flex flex-col items-center justify-center p-4 ">
      <h1>Basic Tokenization Example</h1>
      <div className="w-10/12 max-w-lg rounded overflow-hidden shadow-lg bg-white p-6 mt-4">
        <div className="flex items-center">
          <button
            type="button"
            role="switch"
            aria-checked={embeddedBrandSelector}
            tabIndex={0}
            onClick={() => setEmbeddedBrandSelector((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setEmbeddedBrandSelector((v) => !v);
              }
            }}
            className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${embeddedBrandSelector ? "bg-blue-500" : "bg-gray-200"}`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.68,-0.55,0.27,1.55)",
            }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${embeddedBrandSelector ? "translate-x-6" : "translate-x-1"}`}
              style={{
                transitionTimingFunction: "cubic-bezier(0.68,-0.55,0.27,1.55)",
              }}
            />
          </button>
          <span className="ml-2 text-sm font-medium text-gray-700">
            Use Embedded Brand Selector
          </span>
        </div>
      </div>
      <div className="w-10/12 max-w-lg rounded overflow-hidden shadow-lg bg-white p-6 mt-4">
        <PaymentForm embeddedBrandSelector={embeddedBrandSelector} />
      </div>
    </main>
  );
}

export default App;
