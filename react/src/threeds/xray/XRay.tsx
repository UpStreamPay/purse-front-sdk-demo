import { useState } from 'react';
import { PayloadInspector } from './PayloadInspector';
import { Timeline } from './Timeline';
import { Trace } from './Trace';
import type { Checkout } from '../checkout/useCheckout';

const TABS = ['Timeline', 'Payloads', 'Trace'] as const;
type Tab = (typeof TABS)[number];

/** The observer's side: what the browser actually did, in three views. */
export function XRay({ checkout }: { checkout: Checkout }) {
  const [tab, setTab] = useState<Tab>('Timeline');
  const { events, derived, browserNode } = checkout;
  const span = events.length > 0 ? events[events.length - 1].at : 0;
  const authorized = derived.authorization === 'AUTHORIZED';

  return (
    <section className="rounded-2xl bg-xray border border-xray-line overflow-hidden">
      <div className="flex items-center gap-1 border-b border-xray-line px-3 py-2">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-3 py-1.5 rounded-lg border-0 cursor-pointer font-[inherit] transition-colors ${
              tab === t
                ? 'bg-white/10 text-white font-semibold'
                : 'bg-transparent text-xray-dim hover:text-xray-text'
            }`}
          >
            {t}
            {t === 'Trace' && events.length > 0 && (
              <span className="ml-1.5 text-[10px] text-xray-dim">{events.length}</span>
            )}
          </button>
        ))}
        <span className="ml-auto text-[10.5px] font-mono text-xray-dim">
          {span > 0 ? `${span} ms elapsed` : 'idle'}
        </span>
      </div>

      {authorized && <Authenticated checkout={checkout} />}

      <div className="p-4 max-h-[calc(100vh-190px)] overflow-y-auto">
        {tab === 'Timeline' && <Timeline steps={derived.steps} />}
        {tab === 'Payloads' && <PayloadInspector derived={derived} browserNode={browserNode} />}
        {tab === 'Trace' && <Trace events={events} span={span} />}
      </div>
    </section>
  );
}

/** The payload says `flow: FRICTIONLESS` outright — no need to infer it. */
function Authenticated({ checkout: { derived } }: { checkout: Checkout }) {
  const frictionless = derived.frictionless;
  const { eci, version, directory_response } = derived.outcome ?? {};

  return (
    <div className="pop-in border-b border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
      <p className="m-0 text-sm font-bold text-emerald-300">
        {frictionless ? 'Authenticated frictionless' : 'Authenticated by challenge'}
      </p>
      <p className="m-0 mt-0.5 text-[12px] text-emerald-200/80">
        {frictionless
          ? `The issuer approved on the fingerprint alone${
              derived.authMs !== undefined ? `, in ${derived.authMs} ms` : ''
            }. The shopper was never asked for anything.`
          : 'The fingerprint was not enough, the cardholder answered the challenge, and the payment read back AUTHORIZED.'}
      </p>
      <p className="xray-mono m-0 mt-1.5 font-mono text-[11.5px] text-emerald-300/90">
        {[
          eci && `ECI ${eci}`,
          version && `3DS ${version}`,
          directory_response && `directory ${directory_response}`,
          'liability shifted',
        ]
          .filter(Boolean)
          .join('  ·  ')}
      </p>
    </div>
  );
}
