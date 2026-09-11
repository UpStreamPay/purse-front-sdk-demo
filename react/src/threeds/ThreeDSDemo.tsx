import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Securefields } from '@purse-eu/web-sdk';
import {
  browserData,
  createPayment,
  fetchEligibleSolutions,
  fetchOrder,
  proxyBase,
  type CardSolution,
  type OrderInfo,
} from '@shared/proxy';
import { getEnv } from '@shared/env';
import { DebugPanel } from '../shared/DebugPanel';
import { SHOWCASE_ENV_KEYS, secureFieldsEnvironment, threeDSSupported } from './config';
import * as probe from './probe';
import { derive } from './steps';
import { Timeline } from './Timeline';
import { Trace } from './Trace';
import { PayloadInspector } from './PayloadInspector';
import { Fireworks } from './Fireworks';
import { bootSecureFields, type Handle } from './secureFields';

const TABS = ['Timeline', 'Payloads', 'Trace'] as const;
type Tab = (typeof TABS)[number];

const solutionId = ({ partner, method }: CardSolution) => `${partner}:${method}`;

export function ThreeDSDemo() {
  const events = useSyncExternalStore(probe.subscribe, probe.getSnapshot);

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [cards, setCards] = useState<CardSolution[]>([]);
  const [solutions, setSolutions] = useState<CardSolution[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [threeDS, setThreeDS] = useState(true);
  const [brands, setBrands] = useState<Securefields.Brand[]>([]);
  const [brand, setBrand] = useState<Securefields.Brand | null>(null);
  const [formReady, setFormReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('Timeline');
  const [presenter, setPresenter] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [browserNode, setBrowserNode] = useState<Record<string, unknown> | undefined>();

  const handle = useRef<Handle | null>(null);

  const derived = derive(events, threeDS);

  // ── Steps 1 & 2: order + eligible solutions ───────────────────────────────
  useEffect(() => {
    if (!proxyBase()) {
      setNotice('No proxy URL. Set VITE_PURSE_PROXY_URL in .env.local, or type one into ⚙ Config.');
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        probe.mark('flow:start', { environment: secureFieldsEnvironment(), proxy: proxyBase() });
        const info = await fetchOrder();
        if (cancelled) return;
        probe.mark('order:done', { amount: info.amount, currency: info.currency });
        setOrder(info);

        const { solutions: all, cards: cardSolutions } = await fetchEligibleSolutions(info.eligibleBody);
        if (cancelled) return;
        probe.mark('eligible:done', { count: all.length, cards: cardSolutions.length });
        setSolutions(all);
        setCards(cardSolutions);
        if (cardSolutions.length === 0) {
          setNotice('No credit-card solution is eligible for this order — nothing to run 3DS against.');
          return;
        }
        setPicked(solutionId(cardSolutions[0]));
      } catch (e) {
        if (cancelled) return;
        const message = (e as Error).message;
        probe.mark('flow:error', { error: message });
        // A cross-origin fetch that never connects throws a bare "Failed to
        // fetch", which says nothing on stage. Name the host it could not reach.
        setNotice(
          /failed to fetch|networkerror|load failed/i.test(message)
            ? `Cannot reach the merchant backend at ${proxyBase()}. Is it running?`
            : message,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Step 3: mount Secure Fields. `threeDS` is an init option, so flipping it
  // tears the instance down and mounts a fresh one. ──────────────────────────
  useEffect(() => {
    if (cards.length === 0) return;
    const tenantId = getEnv('VITE_PURSE_SECUREFIELDS_TENANT_ID');
    const apiKey = getEnv('VITE_PURSE_API_KEY');
    if (!tenantId || !apiKey) {
      setNotice('Set the Tenant ID and API Key in .env.local, or in ⚙ Config.');
      return;
    }

    let cancelled = false;
    setFormReady(false);
    handle.current?.sf.destroy();
    handle.current = null;

    // `ready` is emitted from inside initSecureFields, so it can fire before the
    // boot promise resolves and hands us the instance. Enabling Pay on `ready`
    // alone therefore races: the click lands while handle.current is still null
    // and silently does nothing. Require both.
    let ready = false;
    const enableIfReady = () => {
      if (!cancelled && ready && handle.current) setFormReady(true);
    };

    bootSecureFields({
      tenantId,
      apiKey,
      threeDS,
      onReady: () => {
        if (cancelled) return;
        probe.mark('form:ready');
        probe.mark(threeDS ? '3ds:armed' : '3ds:off');
        ready = true;
        enableIfReady();
      },
      onBrands: detected => {
        if (cancelled) return;
        setBrands(detected);
        setBrand(prev => (detected.includes(prev as Securefields.Brand) ? prev : null));
      },
    })
      .then(h => {
        if (cancelled) {
          h.sf.destroy();
          return;
        }
        handle.current = h;
        enableIfReady();
      })
      .catch(e => {
        if (cancelled) return;
        probe.mark('flow:error', { error: (e as Error).message });
        setNotice(`Secure Fields failed to load: ${(e as Error).message}`);
      });

    return () => {
      cancelled = true;
    };
  }, [cards.length, threeDS]);

  // ── Steps 4 & 5: tokenise (3DS runs inside), then create the payment ──────
  const pay = useCallback(async () => {
    const h = handle.current;
    const solution = cards.find(c => solutionId(c) === picked);
    if (!h || !order || !solution) return;

    setPaying(true);
    setNotice(null);

    try {
      probe.mark('tokenize:start', { threeDS, brand });
      const result = await h.submit(brand);

      if ('error' in result) {
        probe.mark('tokenize:error', { error: result.error });
        setNotice(`Tokenisation failed: ${result.error}`);
        setPaying(false);
        return;
      }

      probe.mark('tokenize:done', {
        threeDSServerTransID: result.threeDSServerTransID,
        hasToken: !!result.vault_form_token,
      });

      const browser = browserData();
      setBrowserNode({ ...browser, ip_address: order.customer.ip_address });

      const body = {
        amount: order.amount,
        currency: order.currency,
        order: order.v2Order,
        customer: order.customer,
        split: [
          {
            amount: order.amount,
            partner: solution.partner,
            method: solution.method,
            vault_form_token: result.vault_form_token,
            ...(result.threeDSServerTransID
              ? { threeds_server_trans_id: result.threeDSServerTransID }
              : {}),
            // Versioning and the fingerprint are wired; a challenge is not, so
            // none is requested here.
            three_ds_authentication_options: { challenge_indicator: 'NO_CHALLENGE_REQUESTED' },
          },
        ],
        browser,
      };

      probe.mark('payment:start', body);
      const { ok, data } = await createPayment(body);
      if (!ok) {
        probe.mark('payment:error', data);
        setNotice('create_payment was rejected — see the response in Payloads.');
        setPaying(false);
        return;
      }
      probe.mark('payment:done', data);
    } catch (e) {
      probe.mark('flow:error', { error: (e as Error).message });
      setNotice((e as Error).message);
    } finally {
      setPaying(false);
    }
  }, [brand, cards, order, picked, threeDS]);

  // Arm it *before* paying: the SDK tears the 3DS Method frame down a few
  // seconds after the fingerprint completes, so there is nothing left to reveal
  // by the time anyone could click.
  const toggleReveal = (on: boolean) => {
    probe.setReveal(on);
    setRevealed(on);
  };

  const restart = () => {
    probe.reset();
    setBrowserNode(undefined);
    setNotice(null);
    probe.setReveal(false);
    setRevealed(false);
    location.reload();
  };

  // The backend states the outcome outright (`flow: FRICTIONLESS`), so trust it
  // rather than inferring frictionless from "authorized and not challenged".
  const frictionless = derived.frictionless && derived.authorization === 'AUTHORIZED';
  const span = events.length > 0 ? events[events.length - 1].at : 0;

  return (
    <div className={`min-h-screen ${presenter ? 'presenter' : ''}`}>
      <Fireworks go={frictionless} />

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
            <Badge label="proxy" value={proxyBase().replace(/^https?:\/\//, '') || '—'} />
          </div>

          <div className="flex items-center gap-2">
            <Toggle checked={presenter} onChange={setPresenter} label="Presenter" />
            <button
              onClick={restart}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-white text-muted hover:border-accent hover:text-accent transition-colors cursor-pointer font-[inherit]"
            >
              ↻ Restart
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6 grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
        {/* ── Left: context + the shopper's view ── */}
        <div className="flex flex-col gap-4">
          {!threeDSSupported() && (
            <p className="m-0 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-900">
              Running against <strong>{secureFieldsEnvironment()}</strong>, which has no 3DS
              versioning or fingerprint — that only ships in the <code>test</code> Secure Fields
              build. Restart with <code className="font-mono">npm run dev:react:test</code>.
            </p>
          )}

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="m-0 mb-3 text-sm font-bold">Checkout</h2>

            {notice && (
              <p className="m-0 mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12.5px] text-amber-900">
                {notice}
              </p>
            )}

            {order && (
              <div className="mb-4 flex items-baseline justify-between rounded-lg bg-bg px-3 py-2">
                <span className="text-xs text-muted">Order total</span>
                <span className="font-mono text-base font-semibold">
                  {(order.amount / 100).toFixed(2)} {order.currency}
                </span>
              </div>
            )}

            {solutions.length > 0 && (
              <div className="mb-4">
                <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Eligible solutions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {solutions.map(s => {
                    const id = solutionId(s);
                    const selectable = cards.some(c => solutionId(c) === id);
                    return (
                      <button
                        key={id}
                        disabled={!selectable}
                        onClick={() => setPicked(id)}
                        className={`text-[11.5px] px-2.5 py-1 rounded-full border font-[inherit] transition-colors ${
                          picked === id
                            ? 'bg-accent text-white border-accent cursor-pointer'
                            : selectable
                              ? 'bg-white text-text border-border hover:border-accent cursor-pointer'
                              : 'bg-bg text-muted/60 border-border cursor-not-allowed'
                        }`}
                      >
                        {s.method} · {s.partner}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="relative flex flex-col gap-2.5">
              <Field label="Card number" id="sf-pan" />
              <Field label="Cardholder" id="sf-name" />
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Expiry" id="sf-exp" />
                <Field label="CVV" id="sf-cvv" />
              </div>
              {paying && <div className="scanning absolute inset-0 overflow-hidden rounded-xl" />}
            </div>

            {brands.length > 1 && (
              <div className="mt-3">
                <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Co-branded — pick a network
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {brands.map(b => (
                    <button
                      key={b}
                      onClick={() => setBrand(b)}
                      className={`text-[11.5px] px-2.5 py-1 rounded-full border font-[inherit] cursor-pointer transition-colors ${
                        brand === b
                          ? 'bg-accent text-white border-accent'
                          : 'bg-white text-text border-border hover:border-accent'
                      }`}
                    >
                      {b.replace(/_/g, ' ').toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
              <Toggle
                checked={threeDS}
                onChange={setThreeDS}
                label="Arm 3DS on submit"
                hint="threeDS: { enabled: true } — versioning + device fingerprint"
              />
              <Toggle
                checked={revealed}
                onChange={toggleReveal}
                label="Reveal the hidden frame"
                hint="Arm before paying — the 3DS Method frame is torn down seconds after"
              />
            </div>

            <button
              onClick={pay}
              disabled={!formReady || paying || !picked}
              className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer border-0 font-[inherit]"
            >
              {paying ? 'Authenticating…' : formReady ? 'Pay' : 'Loading Secure Fields…'}
            </button>
          </section>
        </div>

        {/* ── Right: the x-ray ── */}
        <section className="rounded-2xl bg-xray border border-xray-line overflow-hidden">
          <div className="flex items-center gap-1 border-b border-xray-line px-3 py-2">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-xs px-3 py-1.5 rounded-lg border-0 cursor-pointer font-[inherit] transition-colors ${
                  tab === t ? 'bg-white/10 text-white font-semibold' : 'bg-transparent text-xray-dim hover:text-xray-text'
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

          {frictionless && (
            <div className="pop-in border-b border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
              <p className="m-0 text-sm font-bold text-emerald-300">
                Authenticated frictionless
              </p>
              <p className="m-0 mt-0.5 text-[12px] text-emerald-200/80">
                The issuer approved on the fingerprint alone
                {derived.authMs !== undefined ? `, in ${derived.authMs} ms` : ''}. The shopper was
                never asked for anything.
              </p>
              <p className="xray-mono m-0 mt-1.5 font-mono text-[11.5px] text-emerald-300/90">
                {[
                  derived.outcome?.eci && `ECI ${derived.outcome.eci}`,
                  derived.outcome?.version && `3DS ${derived.outcome.version}`,
                  derived.outcome?.directory_response &&
                    `directory ${derived.outcome.directory_response}`,
                  'liability shifted',
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </p>
            </div>
          )}

          <div className="p-4 max-h-[calc(100vh-190px)] overflow-y-auto">
            {tab === 'Timeline' && <Timeline steps={derived.steps} />}
            {tab === 'Payloads' && <PayloadInspector derived={derived} browserNode={browserNode} />}
            {tab === 'Trace' && <Trace events={events} span={span} />}
          </div>
        </section>
      </main>

      <DebugPanel keys={SHOWCASE_ENV_KEYS} />
    </div>
  );
}

// ── Small presentational bits ───────────────────────────────────────────────

function Field({ label, id }: { label: string; id: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="sf-field" id={id} />
    </label>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-0 cursor-pointer transition-colors ${
          checked ? 'bg-accent' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
      <span>
        <span className="block text-[12.5px] font-medium leading-tight">{label}</span>
        {hint && <span className="block text-[11px] leading-tight text-muted">{hint}</span>}
      </span>
    </label>
  );
}

