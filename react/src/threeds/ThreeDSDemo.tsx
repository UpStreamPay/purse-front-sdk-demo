import { useState } from 'react';
import { proxyBase } from '@shared/proxy';
import { isOverridden } from '@shared/env';
import { DebugPanel } from '../shared/DebugPanel';
import { SHOWCASE_ENV_KEYS, secureFieldsEnvironment, threeDSSupported } from './config';
import { Checkout } from './checkout/Checkout';
import { Fireworks } from './ui/Fireworks';
import { XRay } from './xray/XRay';
import { Badge, Toggle } from './ui/controls';
import { useCheckout } from './checkout/useCheckout';

/** The page: the shopper's checkout on the left, the x-ray of it on the right. */
export function ThreeDSDemo() {
  const checkout = useCheckout();
  const [presenter, setPresenter] = useState(false);

  return (
    <div className={`min-h-screen ${presenter ? 'presenter' : ''}`}>
      <Fireworks go={checkout.derived.authorization === 'AUTHORIZED'} />

      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1400px] px-6 py-4 flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Purse · Advanced Flow
            </p>
            <h1 className="m-0 mt-0.5 text-[22px] font-bold leading-tight">
              3DS device fingerprint
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap chrome-dim">
            <Badge label="env" value={secureFieldsEnvironment()} />
            <Badge
              label="proxy"
              value={proxyBase().replace(/^https?:\/\//, '') || '—'}
              // A ⚙ Config override beats the .env file — say so.
              note={isOverridden('VITE_PURSE_PROXY_URL') ? 'override' : undefined}
            />
          </div>

          <div className="flex items-center gap-2">
            <Toggle checked={presenter} onChange={setPresenter} label="Presenter" />
            <button
              onClick={checkout.restart}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-white text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer font-[inherit]"
            >
              ↻ Restart
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-4">
          {!threeDSSupported() && <NoThreeDSNotice />}
          <Checkout checkout={checkout} />
        </div>

        <XRay checkout={checkout} />
      </main>

      <DebugPanel keys={SHOWCASE_ENV_KEYS} />
    </div>
  );
}

function NoThreeDSNotice() {
  return (
    <p className="m-0 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
      Running against <strong>{secureFieldsEnvironment()}</strong>, which has no 3DS versioning or
      fingerprint — that only ships in the <code>test</code> Secure Fields build. Restart with{' '}
      <code className="font-mono">npm run dev:react:test</code>.
    </p>
  );
}
