import { PaymentForm } from "./securefields/PaymentForm.tsx";
import { DebugPanel } from "./shared/DebugPanel.tsx";
import { useState } from "react";

function App() {
  const [embeddedBrandSelector, setEmbeddedBrandSelector] = useState(false);
  return (
    <main className="min-h-screen w-screen  flex flex-col items-center justify-center p-4 ">
      <header className="w-full max-w-lg mb-4 text-center relative">
        <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold">
          Purse SDK — React demos
        </p>
        <h1 className="text-2xl font-bold mt-1">Secure Fields</h1>
        <a
          href="https://github.com/UpStreamPay/purse-front-sdk-demo/tree/main/react/src"
          target="_blank"
          rel="noopener"
          className="absolute right-0 top-0 inline-flex items-center gap-1.5 text-gray-400 no-underline text-xs hover:text-gray-600 border border-gray-200 rounded-md px-2 py-1"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          View source
        </a>
      </header>
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
      <DebugPanel />
    </main>
  );
}

export default App;
