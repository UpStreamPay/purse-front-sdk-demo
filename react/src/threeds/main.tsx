// Install the instrumentation before anything else runs. The Secure Fields
// bundle is pulled from the CDN on first use, and if it captures the original
// fetch/XHR before we patch them, the probe sees nothing.
import * as probe from './probe';
probe.install();

import { createRoot } from 'react-dom/client';
import './threeds.css';
import { ThreeDSDemo } from './ThreeDSDemo';

// There is no test runner in this repo, so the redactor and the
// threeDSMethodData decoder check themselves on every dev load. A broken
// redactor throws here rather than leaking a card number onto a projector.
if (import.meta.env.DEV) {
  probe.selfCheck();
  // Handy when working on the panels: replay a captured create_payment response
  // with `__probe.mark('payment:done', json)` instead of paying again.
  (window as unknown as { __probe: typeof probe }).__probe = probe;
}

// Deliberately not wrapped in StrictMode: it double-invokes effects in dev, so
// the order fetch and the Secure Fields boot would each run twice and the trace
// — whose entire job is to be a legible record of what the page did — would show
// every request duplicated.
createRoot(document.getElementById('root')!).render(<ThreeDSDemo />);
